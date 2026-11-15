"""
Base data provider interface for GEOVISTA Intelligence.
All satellite data providers inherit from BaseDataProvider.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SceneMetadata:
    """Metadata container for a single satellite scene / granule."""

    scene_id: str
    provider: str
    collection: str
    product: str
    acquired_at: str            # ISO 8601 datetime string
    bbox: list[float]           # [minlon, minlat, maxlon, maxlat] EPSG:4326
    footprint_geojson: dict     # GeoJSON Polygon geometry
    cloud_cover_pct: float | None
    resolution_m: float
    bands: list[str]
    asset_urls: dict[str, str]  # band_name -> download URL
    metadata: dict = field(default_factory=dict)
    is_synthetic: bool = False

    def __post_init__(self) -> None:
        if len(self.bbox) != 4:
            raise ValueError(
                f"bbox must have exactly 4 elements [minlon, minlat, maxlon, maxlat], "
                f"got {len(self.bbox)}"
            )

    def to_dict(self) -> dict:
        return {
            "scene_id": self.scene_id,
            "provider": self.provider,
            "collection": self.collection,
            "product": self.product,
            "acquired_at": self.acquired_at,
            "bbox": self.bbox,
            "footprint_geojson": self.footprint_geojson,
            "cloud_cover_pct": self.cloud_cover_pct,
            "resolution_m": self.resolution_m,
            "bands": self.bands,
            "asset_urls": self.asset_urls,
            "metadata": self.metadata,
            "is_synthetic": self.is_synthetic,
        }


class BaseDataProvider(ABC):
    """Abstract base class that every satellite data provider must implement.

    Subclass Contract
    -----------------
    - ``name``          : Human-readable provider name (class attribute).
    - ``requires_auth`` : Whether authentication is mandatory (class attribute).
    - Implement all @abstractmethod methods.
    - Raise ``DataProviderError`` (or its subclasses) on expected failure.
    - Never silently swallow exceptions; log and re-raise.
    """

    name: str = "base"
    requires_auth: bool = False

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    def authenticate(self) -> bool:
        """Authenticate with the upstream data service.

        Returns
        -------
        bool
            True when authentication succeeded; False when credentials are
            absent (non-fatal for public providers).

        Raises
        ------
        AuthenticationError
            When credentials are present but rejected.
        """
        ...

    @abstractmethod
    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        **kwargs,
    ) -> list[SceneMetadata]:
        """Search for scenes that intersect *bbox* within the date range.

        Parameters
        ----------
        bbox:
            [minlon, minlat, maxlon, maxlat] in EPSG:4326.
        start_date, end_date:
            ISO 8601 date strings, e.g. "2023-01-01".
        **kwargs:
            Provider-specific filter parameters (cloud cover, product type …).

        Returns
        -------
        list[SceneMetadata]
            Matching scenes, ordered by acquisition date ascending.
        """
        ...

    @abstractmethod
    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """Download one scene (or selected bands) to *output_dir*.

        Parameters
        ----------
        scene:
            Metadata for the scene to download.
        output_dir:
            Destination directory; created if it does not exist.
        bands:
            Subset of ``scene.bands`` to download.  ``None`` → all bands.

        Returns
        -------
        dict[str, Path]
            Mapping of band name → local file path for every downloaded file.
        """
        ...

    @abstractmethod
    def get_collection_info(self) -> dict:
        """Return a human-readable description of the data collection.

        Should include at minimum: name, short_name, version, resolution_m,
        temporal_coverage, bands, and any important caveats.
        """
        ...

    # ------------------------------------------------------------------
    # Concrete helpers
    # ------------------------------------------------------------------

    def validate_bbox(self, bbox: list[float]) -> None:
        """Validate that *bbox* is a well-formed WGS-84 bounding box.

        Parameters
        ----------
        bbox:
            [minlon, minlat, maxlon, maxlat]

        Raises
        ------
        ValueError
            If the bbox does not conform to expected ranges or ordering.
        """
        if len(bbox) != 4:
            raise ValueError(
                f"bbox must have exactly 4 elements, got {len(bbox)}: {bbox}"
            )

        minlon, minlat, maxlon, maxlat = bbox

        if not (-180.0 <= minlon <= 180.0 and -180.0 <= maxlon <= 180.0):
            raise ValueError(
                f"Longitude values must be in [-180, 180], got minlon={minlon}, maxlon={maxlon}"
            )
        if not (-90.0 <= minlat <= 90.0 and -90.0 <= maxlat <= 90.0):
            raise ValueError(
                f"Latitude values must be in [-90, 90], got minlat={minlat}, maxlat={maxlat}"
            )
        if minlon >= maxlon:
            raise ValueError(
                f"minlon ({minlon}) must be strictly less than maxlon ({maxlon})"
            )
        if minlat >= maxlat:
            raise ValueError(
                f"minlat ({minlat}) must be strictly less than maxlat ({maxlat})"
            )

    def validate_dates(self, start_date: str, end_date: str) -> None:
        """Validate ISO 8601 date strings and their ordering.

        Parameters
        ----------
        start_date, end_date:
            Date strings in "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ" format.

        Raises
        ------
        ValueError
            If dates are malformed or start_date > end_date.
        """
        from datetime import datetime

        fmt_candidates = [
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S",
        ]

        def _parse(ds: str) -> datetime:
            for fmt in fmt_candidates:
                try:
                    return datetime.strptime(ds, fmt)
                except ValueError:
                    continue
            raise ValueError(
                f"Cannot parse date string '{ds}'. "
                "Expected ISO 8601 format, e.g. '2023-01-01' or '2023-01-01T00:00:00Z'."
            )

        t_start = _parse(start_date)
        t_end = _parse(end_date)

        if t_start > t_end:
            raise ValueError(
                f"start_date ({start_date}) must not be after end_date ({end_date})."
            )

    def search_with_retry(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_retries: int = 3,
        retry_delay: float = 2.0,
        **kwargs,
    ) -> list[SceneMetadata]:
        """Call ``self.search`` with exponential-backoff retry on transient errors.

        Parameters
        ----------
        bbox, start_date, end_date:
            Forwarded to ``self.search``.
        max_retries:
            Maximum number of additional attempts after the first failure.
        retry_delay:
            Base delay in seconds between retries (doubled each time).
        **kwargs:
            Forwarded to ``self.search``.

        Returns
        -------
        list[SceneMetadata]
            Results from the first successful ``search`` call.

        Raises
        ------
        Exception
            Re-raises the last exception when all retries are exhausted.
        """
        self.validate_bbox(bbox)
        self.validate_dates(start_date, end_date)

        last_exc: Exception | None = None
        delay = retry_delay

        for attempt in range(1, max_retries + 2):  # +1 for initial try
            try:
                logger.debug(
                    "[%s] search attempt %d/%d  bbox=%s  dates=%s→%s",
                    self.name,
                    attempt,
                    max_retries + 1,
                    bbox,
                    start_date,
                    end_date,
                )
                return self.search(bbox, start_date, end_date, **kwargs)
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if attempt <= max_retries:
                    logger.warning(
                        "[%s] search attempt %d failed (%s). Retrying in %.1fs …",
                        self.name,
                        attempt,
                        exc,
                        delay,
                    )
                    time.sleep(delay)
                    delay *= 2.0
                else:
                    logger.error(
                        "[%s] search failed after %d attempts: %s",
                        self.name,
                        attempt,
                        exc,
                    )

        raise last_exc  # type: ignore[misc]

    def _ensure_output_dir(self, output_dir: Path) -> Path:
        """Create *output_dir* (and parents) if it does not exist."""
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r}, requires_auth={self.requires_auth})"
