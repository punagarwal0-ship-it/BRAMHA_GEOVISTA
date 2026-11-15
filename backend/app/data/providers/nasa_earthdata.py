"""
NASA Earthdata base provider for GEOVISTA Intelligence.

Implements authenticated access to NASA's Common Metadata Repository (CMR)
for granule search, plus robust authenticated download via NASA Earthdata URS.

Authentication methods (in priority order):
  1. EARTHDATA_TOKEN environment variable (Bearer token) – preferred.
  2. NASA_EARTHDATA_USERNAME + NASA_EARTHDATA_PASSWORD (URS login).

Usage::

    provider = NASAEarthdataProvider()
    provider.authenticate()
    scenes = provider.search(bbox, "2023-01-01", "2023-06-30")
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.data.providers.base_provider import BaseDataProvider, SceneMetadata

try:
    from app.core.exceptions import (
        AuthenticationError,
        DataDownloadError,
        DataNotFoundError,
        DataProviderError,
    )
except ImportError:  # allow standalone use without full app installed
    class DataProviderError(Exception): pass  # type: ignore[no-redef]
    class AuthenticationError(DataProviderError): pass  # type: ignore[no-redef]
    class DataNotFoundError(DataProviderError): pass  # type: ignore[no-redef]
    class DataDownloadError(DataProviderError): pass  # type: ignore[no-redef]

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

logger = logging.getLogger(__name__)

CMR_GRANULES_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
URS_LOGIN_URL = "https://urs.earthdata.nasa.gov/api/users/tokens"
EARTHDATA_URS = "https://urs.earthdata.nasa.gov"

# HTTP status codes that warrant a retry
_RETRYABLE_CODES = {429, 500, 502, 503, 504}


def _build_session(retries: int = 3, backoff: float = 1.0) -> requests.Session:
    """Build a requests.Session with automatic retry on transient HTTP errors."""
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=backoff,
        status_forcelist=list(_RETRYABLE_CODES),
        allowed_methods={"GET", "POST"},
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


class NASAEarthdataProvider(BaseDataProvider):
    """Base provider for all NASA Earthdata / CMR-indexed data collections.

    Sub-classes (MODIS, HLS, …) should override ``name``, ``COLLECTION_SHORT_NAME``,
    ``COLLECTION_VERSION``, and ``DEFAULT_BANDS``.
    """

    name: str = "NASA_Earthdata"
    requires_auth: bool = True

    COLLECTION_SHORT_NAME: str = ""   # override in subclass
    COLLECTION_VERSION: str = ""      # override in subclass
    DEFAULT_BANDS: list[str] = []     # override in subclass

    # Maximum granules returned per CMR page
    CMR_PAGE_SIZE: int = 100

    def __init__(self) -> None:
        self._session: requests.Session = _build_session()
        self._auth_token: str | None = None
        self._authenticated: bool = False

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def authenticate(self) -> bool:
        """Authenticate using EARTHDATA_TOKEN or username/password.

        Returns
        -------
        bool
            True if authenticated successfully, False if no credentials found
            (providers that allow public access can proceed; restricted collections
            will fail at download time).
        """
        token = os.environ.get("EARTHDATA_TOKEN", "").strip()
        if token:
            self._auth_token = token
            self._session.headers.update({"Authorization": f"Bearer {token}"})
            self._authenticated = True
            logger.info("[%s] Authenticated via EARTHDATA_TOKEN.", self.name)
            return True

        username = os.environ.get("NASA_EARTHDATA_USERNAME", "").strip()
        password = os.environ.get("NASA_EARTHDATA_PASSWORD", "").strip()
        if username and password:
            try:
                self._session.auth = (username, password)
                # Probe URS to validate credentials
                resp = self._session.get(
                    f"{EARTHDATA_URS}/profile",
                    timeout=15,
                    allow_redirects=True,
                )
                if resp.status_code == 200:
                    self._authenticated = True
                    logger.info(
                        "[%s] Authenticated via URS username/password.", self.name
                    )
                    return True
                elif resp.status_code == 401:
                    raise AuthenticationError(
                        "NASA Earthdata URS rejected the provided credentials. "
                        "Verify NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD."
                    )
                else:
                    logger.warning(
                        "[%s] URS probe returned unexpected status %d.",
                        self.name,
                        resp.status_code,
                    )
            except AuthenticationError:
                raise
            except Exception as exc:
                logger.warning(
                    "[%s] URS authentication probe failed: %s. "
                    "Proceeding without confirmed auth.",
                    self.name,
                    exc,
                )
                # Still mark as partially authenticated so downloads can try
                self._authenticated = True
                return True

        logger.warning(
            "[%s] No Earthdata credentials found in environment. "
            "Set EARTHDATA_TOKEN or NASA_EARTHDATA_USERNAME + NASA_EARTHDATA_PASSWORD. "
            "Public CMR searches will work; authenticated downloads will fail.",
            self.name,
        )
        return False

    def _get_auth_headers(self) -> dict:
        """Return Authorization headers for authenticated requests."""
        if self._auth_token:
            return {"Authorization": f"Bearer {self._auth_token}"}
        return {}

    # ------------------------------------------------------------------
    # CMR search
    # ------------------------------------------------------------------

    def _search_cmr(
        self,
        short_name: str,
        version: str,
        bbox: list[float],
        start_date: str,
        end_date: str,
        page_size: int = 100,
        additional_params: dict | None = None,
    ) -> list[dict]:
        """Execute a CMR granule search and return raw granule dicts.

        Parameters
        ----------
        short_name, version:
            CMR collection identifiers.
        bbox:
            [minlon, minlat, maxlon, maxlat] EPSG:4326.
        start_date, end_date:
            ISO 8601 date strings.
        page_size:
            Granules per page (max 2000, but 100 is safer).
        additional_params:
            Extra CMR query params merged into the request.

        Returns
        -------
        list[dict]
            Raw CMR granule feature dicts.
        """
        self.validate_bbox(bbox)
        minlon, minlat, maxlon, maxlat = bbox

        params: dict = {
            "short_name": short_name,
            "version": version,
            "bounding_box": f"{minlon},{minlat},{maxlon},{maxlat}",
            "temporal": f"{start_date}T00:00:00Z,{end_date}T23:59:59Z",
            "page_size": min(page_size, 2000),
            "sort_key": "start_date",
        }
        if additional_params:
            params.update(additional_params)

        all_granules: list[dict] = []
        page_num = 1

        while True:
            params["page_num"] = page_num
            logger.debug(
                "[%s] CMR search page %d  short_name=%s  version=%s",
                self.name,
                page_num,
                short_name,
                version,
            )

            resp = self._session.get(
                CMR_GRANULES_URL,
                params=params,
                headers=self._get_auth_headers(),
                timeout=60,
            )

            if resp.status_code == 401:
                raise AuthenticationError(
                    f"[{self.name}] CMR returned 401. Re-authenticate and retry."
                )
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 30))
                logger.warning(
                    "[%s] CMR rate-limited. Sleeping %ds …", self.name, retry_after
                )
                time.sleep(retry_after)
                continue  # retry same page
            if resp.status_code >= 500:
                raise DataProviderError(
                    f"[{self.name}] CMR server error {resp.status_code}: {resp.text[:200]}"
                )

            resp.raise_for_status()
            data = resp.json()
            granules: list[dict] = data.get("feed", {}).get("entry", [])

            if not granules:
                break

            all_granules.extend(granules)
            logger.debug(
                "[%s] CMR page %d returned %d granules (total so far: %d).",
                self.name,
                page_num,
                len(granules),
                len(all_granules),
            )

            # CMR paginates; stop when we got fewer than page_size results
            if len(granules) < params["page_size"]:
                break

            page_num += 1

        logger.info(
            "[%s] CMR search complete: %d granules found.", self.name, len(all_granules)
        )
        return all_granules

    def _parse_cmr_granule(self, granule: dict) -> SceneMetadata:
        """Convert a raw CMR granule dict into a ``SceneMetadata`` object.

        Sub-classes can override this to customise parsing for their collection.
        """
        # --- Identify the scene ---
        scene_id = granule.get("producer_granule_id") or granule.get("id", "unknown")

        # --- Temporal ---
        acquired_at = granule.get("time_start", "")

        # --- Spatial footprint ---
        bbox = [0.0, 0.0, 0.0, 0.0]
        footprint_geojson: dict = {}

        boxes = granule.get("boxes", [])
        polygons = granule.get("polygons", [])

        if boxes:
            # CMR box format: "minlat minlon maxlat maxlon"
            parts = boxes[0].split()
            if len(parts) == 4:
                minlat, minlon, maxlat, maxlon = (float(p) for p in parts)
                bbox = [minlon, minlat, maxlon, maxlat]
                footprint_geojson = {
                    "type": "Polygon",
                    "coordinates": [[
                        [minlon, minlat],
                        [maxlon, minlat],
                        [maxlon, maxlat],
                        [minlon, maxlat],
                        [minlon, minlat],
                    ]],
                }
        elif polygons:
            # CMR polygon format: list of "lat lon lat lon …" strings
            coords_flat = polygons[0][0].split()
            coords = [
                [float(coords_flat[i + 1]), float(coords_flat[i])]
                for i in range(0, len(coords_flat) - 1, 2)
            ]
            if coords and coords[0] != coords[-1]:
                coords.append(coords[0])
            footprint_geojson = {"type": "Polygon", "coordinates": [coords]}
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            bbox = [min(lons), min(lats), max(lons), max(lats)]

        # --- Assets / download links ---
        asset_urls: dict[str, str] = {}
        for link in granule.get("links", []):
            rel = link.get("rel", "")
            href = link.get("href", "")
            title = link.get("title", link.get("type", "unknown"))
            if "data#" in rel or link.get("type") in (
                "application/x-hdfeos",
                "application/x-hdf",
                "application/octet-stream",
            ):
                asset_urls[title or "data"] = href

        # --- Cloud cover (not all MODIS products provide this) ---
        cloud_cover: float | None = None
        for attr in granule.get("attribute", []):
            if attr.get("name", "").lower() in ("cloud_cover", "cloud_coverage"):
                try:
                    cloud_cover = float(attr["value"])
                except (KeyError, TypeError, ValueError):
                    pass

        return SceneMetadata(
            scene_id=scene_id,
            provider=self.name,
            collection=self.COLLECTION_SHORT_NAME,
            product=granule.get("short_name", self.COLLECTION_SHORT_NAME),
            acquired_at=acquired_at,
            bbox=bbox,
            footprint_geojson=footprint_geojson,
            cloud_cover_pct=cloud_cover,
            resolution_m=getattr(self, "RESOLUTION_M", 0.0),
            bands=list(self.DEFAULT_BANDS),
            asset_urls=asset_urls,
            metadata={
                "granule_ur": granule.get("id", ""),
                "data_center": granule.get("data_center", ""),
                "version": granule.get("version_id", self.COLLECTION_VERSION),
                "day_night_flag": granule.get("day_night_flag", ""),
            },
        )

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    def download_granule(
        self,
        url: str,
        output_path: Path,
        chunk_size: int = 1024 * 1024,
        timeout: int = 600,
        max_retries: int = 3,
    ) -> Path:
        """Download a single granule URL to *output_path* with streaming.

        Features
        --------
        - Chunked streaming (default 1 MB chunks).
        - Resume via HTTP Range header if partial file exists.
        - Automatic retry on network/server errors with exponential backoff.
        - Progress bar via tqdm (if installed).
        - Raises ``DataDownloadError`` on permanent failure.

        Parameters
        ----------
        url:
            Direct download URL (authenticated via session).
        output_path:
            Destination file path; parent directories are created as needed.
        chunk_size:
            Bytes per chunk to write.
        timeout:
            Seconds before an individual HTTP request times out.
        max_retries:
            Maximum retry attempts beyond the first try.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)
        partial_path = output_path.with_suffix(output_path.suffix + ".part")

        # Determine resume offset
        resume_byte = partial_path.stat().st_size if partial_path.exists() else 0

        last_exc: Exception | None = None
        delay = 2.0

        for attempt in range(1, max_retries + 2):
            try:
                headers = dict(self._get_auth_headers())
                if resume_byte:
                    headers["Range"] = f"bytes={resume_byte}-"
                    logger.info(
                        "[%s] Resuming download from byte %d: %s",
                        self.name,
                        resume_byte,
                        url,
                    )

                with self._session.get(
                    url,
                    headers=headers,
                    stream=True,
                    timeout=timeout,
                    allow_redirects=True,
                ) as resp:

                    if resp.status_code == 401:
                        logger.warning(
                            "[%s] 401 on download – attempting re-auth.", self.name
                        )
                        self.authenticate()
                        headers.update(self._get_auth_headers())
                        # retry after re-auth
                        raise AuthenticationError("Re-authenticating; will retry.")

                    if resp.status_code == 429:
                        retry_after = int(resp.headers.get("Retry-After", 60))
                        logger.warning(
                            "[%s] Rate-limited. Sleeping %ds.", self.name, retry_after
                        )
                        time.sleep(retry_after)
                        raise DataProviderError("Rate-limited; will retry.")

                    if resp.status_code not in (200, 206):
                        raise DataDownloadError(
                            f"[{self.name}] HTTP {resp.status_code} for {url}"
                        )

                    total_size = int(resp.headers.get("Content-Length", 0)) + resume_byte

                    mode = "ab" if resume_byte and resp.status_code == 206 else "wb"
                    if mode == "wb":
                        resume_byte = 0  # server didn't honour Range; start over

                    with open(partial_path, mode) as fh:
                        pbar = None
                        if HAS_TQDM:
                            pbar = tqdm(
                                total=total_size or None,
                                initial=resume_byte,
                                unit="B",
                                unit_scale=True,
                                desc=output_path.name,
                                leave=False,
                            )
                        try:
                            for chunk in resp.iter_content(chunk_size=chunk_size):
                                if chunk:
                                    fh.write(chunk)
                                    if pbar:
                                        pbar.update(len(chunk))
                        finally:
                            if pbar:
                                pbar.close()

                # Success – rename partial to final
                partial_path.rename(output_path)
                logger.info(
                    "[%s] Downloaded %s → %s", self.name, url, output_path
                )
                return output_path

            except (DataDownloadError, DataProviderError):
                raise  # permanent / rate-limit → let outer retry handle
            except Exception as exc:
                last_exc = exc
                if attempt <= max_retries:
                    logger.warning(
                        "[%s] Download attempt %d/%d failed (%s). Retry in %.1fs …",
                        self.name,
                        attempt,
                        max_retries + 1,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
                    delay = min(delay * 2.0, 120.0)
                else:
                    break

        # Cleanup incomplete partial file
        if partial_path.exists():
            partial_path.unlink(missing_ok=True)

        raise DataDownloadError(
            f"[{self.name}] Failed to download {url} after {max_retries + 1} attempts. "
            f"Last error: {last_exc}"
        ) from last_exc

    # ------------------------------------------------------------------
    # BaseDataProvider stubs (sub-classes provide real implementations)
    # ------------------------------------------------------------------

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        **kwargs,
    ) -> list[SceneMetadata]:
        """Search CMR for the collection defined by ``COLLECTION_SHORT_NAME``.

        Sub-classes with custom parameters should override this method and
        call ``_search_cmr`` directly.
        """
        if not self.COLLECTION_SHORT_NAME:
            raise NotImplementedError(
                "Sub-classes must set COLLECTION_SHORT_NAME or override search()."
            )
        self.validate_bbox(bbox)
        self.validate_dates(start_date, end_date)
        raw = self._search_cmr(
            short_name=self.COLLECTION_SHORT_NAME,
            version=self.COLLECTION_VERSION,
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            page_size=self.CMR_PAGE_SIZE,
            additional_params=kwargs.get("additional_params"),
        )
        return [self._parse_cmr_granule(g) for g in raw]

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """Download all asset URLs listed in ``scene.asset_urls``."""
        self._ensure_output_dir(output_dir)
        results: dict[str, Path] = {}
        urls = scene.asset_urls

        if not urls:
            raise DataNotFoundError(
                f"[{self.name}] Scene {scene.scene_id!r} has no asset_urls to download."
            )

        for band_or_name, url in urls.items():
            if bands and band_or_name not in bands:
                continue
            fname = output_dir / f"{scene.scene_id}_{band_or_name}"
            # Preserve original extension if URL has one
            suffix = Path(url.split("?")[0]).suffix
            if suffix:
                fname = fname.with_suffix(suffix)
            downloaded = self.download_granule(url, fname)
            results[band_or_name] = downloaded

        return results

    def get_collection_info(self) -> dict:
        return {
            "name": self.name,
            "short_name": self.COLLECTION_SHORT_NAME,
            "version": self.COLLECTION_VERSION,
            "bands": self.DEFAULT_BANDS,
        }
