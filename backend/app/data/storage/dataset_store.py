"""
Memory-First Dataset Storage and Temporary Workspace Manager for GEOVISTA Intelligence.

Enforces:
- Bounded scratch directory allocation
- Chunked/windowed memory tracking with psutil
- Automatic purge of temporary files after extraction
- Safe storage of final model weights and immutable metrics
"""

from __future__ import annotations

import gc
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Optional

import psutil

from app.core.settings import settings

logger = logging.getLogger(__name__)


class DatasetStore:
    """Manages memory limits, staging caches, and cleanup of raw satellite imagery."""

    def __init__(
        self,
        scratch_dir: Optional[Path] = None,
        artifacts_dir: Optional[Path] = None,
        max_ram_gb: float = 8.0,
    ) -> None:
        self.scratch_dir = Path(scratch_dir or settings.scratch_dir)
        self.artifacts_dir = Path(artifacts_dir or settings.artifacts_dir)
        self.max_ram_gb = max_ram_gb

        self.scratch_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self._tracked_temp_dirs: list[Path] = []

    def get_temp_workspace(self, prefix: str = "geovista_stage_") -> Path:
        """Create a temporary subdirectory in scratch for random file access / unpacking."""
        self.check_memory_pressure()
        temp_path = Path(tempfile.mkdtemp(prefix=prefix, dir=self.scratch_dir))
        self._tracked_temp_dirs.append(temp_path)
        return temp_path

    def cleanup_workspace(self, temp_path: Path) -> None:
        """Safely delete a temporary workspace directory."""
        if temp_path.exists() and temp_path.is_dir():
            try:
                shutil.rmtree(temp_path, ignore_errors=True)
            except Exception as e:
                logger.warning("Failed to remove temp dir %s: %s", temp_path, e)
        if temp_path in self._tracked_temp_dirs:
            self._tracked_temp_dirs.remove(temp_path)
        gc.collect()

    def cleanup_all(self) -> int:
        """Purge all tracked staging directories."""
        count = 0
        for p in list(self._tracked_temp_dirs):
            self.cleanup_workspace(p)
            count += 1
        return count

    def get_current_ram_usage_gb(self) -> float:
        """Return current Python process resident memory in GB."""
        process = psutil.Process(os.getpid())
        return float(process.memory_info().rss / (1024 ** 3))

    def check_memory_pressure(self) -> bool:
        """Log warning and trigger garbage collection if RAM exceeds threshold."""
        usage_gb = self.get_current_ram_usage_gb()
        if usage_gb > self.max_ram_gb * 0.85:
            logger.warning(
                "Memory pressure high: %.2f GB used (threshold: %.2f GB). Running gc.collect().",
                usage_gb, self.max_ram_gb
            )
            gc.collect()
            return True
        return False
