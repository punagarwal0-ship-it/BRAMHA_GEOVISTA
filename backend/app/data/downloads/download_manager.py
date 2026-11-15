"""
Robust, chunked asynchronous download manager for GEOVISTA Intelligence.

Features:
- Configurable concurrency (asyncio Semaphore)
- Chunked streaming I/O with progress tracking
- Resumable downloads via HTTP Range headers
- Exponential backoff retry logic (3 attempts default)
- Safe cleanup of partially downloaded files
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Callable, Optional

import aiofiles  # type: ignore
import httpx     # type: ignore

from app.core.exceptions import DataDownloadError

logger = logging.getLogger(__name__)


class DownloadManager:
    """Manages asynchronous satellite granule downloads with retry and resume."""

    def __init__(
        self,
        scratch_dir: Path,
        max_concurrent: int = 4,
        max_retries: int = 3,
        timeout_seconds: int = 180,
    ) -> None:
        self.scratch_dir = Path(scratch_dir)
        self.scratch_dir.mkdir(parents=True, exist_ok=True)
        self.max_concurrent = max_concurrent
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def download_file(
        self,
        url: str,
        output_path: Path,
        auth_headers: Optional[dict[str, str]] = None,
        chunk_size: int = 1024 * 1024,  # 1 MB chunk
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> Path:
        """Download a single remote URL to a local destination with retries and resumption."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        part_path = output_path.with_suffix(output_path.suffix + ".part")

        async with self._semaphore:
            for attempt in range(1, self.max_retries + 1):
                try:
                    headers = dict(auth_headers or {})
                    existing_bytes = part_path.stat().st_size if part_path.exists() else 0
                    if existing_bytes > 0:
                        headers["Range"] = f"bytes={existing_bytes}-"

                    timeout = httpx.Timeout(self.timeout_seconds, read=60.0)
                    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                        async with client.stream("GET", url, headers=headers) as resp:
                            if resp.status_code == 416:  # Range not satisfiable (already completed)
                                part_path.rename(output_path)
                                return output_path

                            if resp.status_code not in (200, 206):
                                raise DataDownloadError(
                                    f"HTTP {resp.status_code} ({resp.reason_phrase}) for {url}"
                                )

                            mode = "ab" if resp.status_code == 206 else "wb"
                            total_bytes = int(resp.headers.get("content-length", 0)) + existing_bytes
                            downloaded = existing_bytes

                            async with aiofiles.open(part_path, mode) as f:
                                async for chunk in resp.aiter_bytes(chunk_size):
                                    await f.write(chunk)
                                    downloaded += len(chunk)
                                    if progress_callback and total_bytes > 0:
                                        progress_callback(downloaded, total_bytes)

                    # Atomically rename .part to final destination
                    if part_path.exists():
                        part_path.rename(output_path)
                    logger.info("Successfully downloaded: %s", output_path.name)
                    return output_path

                except Exception as e:
                    logger.warning(
                        "Download attempt %d/%d failed for %s: %s",
                        attempt, self.max_retries, url, e
                    )
                    if attempt < self.max_retries:
                        await asyncio.sleep(2 ** attempt)
                    else:
                        if part_path.exists():
                            try:
                                part_path.unlink()
                            except OSError:
                                pass
                        raise DataDownloadError(
                            f"Permanent download failure after {self.max_retries} attempts: {url} -> {e}"
                        ) from e

        return output_path

    async def download_many(
        self,
        tasks: list[tuple[str, Path, Optional[dict[str, str]]]],
    ) -> dict[str, Path | Exception]:
        """Download multiple files concurrently."""
        results: dict[str, Path | Exception] = {}

        async def _wrap(url: str, out: Path, headers: Optional[dict[str, str]]):
            try:
                res = await self.download_file(url, out, auth_headers=headers)
                results[url] = res
            except Exception as e:
                results[url] = e

        await asyncio.gather(*[_wrap(u, o, h) for u, o, h in tasks])
        return results

    def cleanup_incomplete(self) -> int:
        """Purge orphan .part files from scratch directory."""
        removed = 0
        for p in self.scratch_dir.glob("**/*.part"):
            try:
                p.unlink()
                removed += 1
            except OSError:
                pass
        return removed
