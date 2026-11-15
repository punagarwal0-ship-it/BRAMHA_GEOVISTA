"""
NASA Harmonized Landsat-Sentinel (HLS) v2.0 Data Provider for GEOVISTA Intelligence.

Products:
- HLSL30: Landsat 8/9 Operational Land Imager (OLI) Harmonized Surface Reflectance (30m)
- HLSS30: Sentinel-2 Multi-Spectral Instrument (MSI) Harmonized Surface Reflectance (30m)

Documentation & CMR Short Names:
- HLSL30 v002 / HLSS30 v002
- Grid: Global UTM tiling system aligned to Sentinel-2 Military Grid Reference System (MGRS)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

from app.core.exceptions import DataDownloadError
from app.data.providers.base_provider import SceneMetadata
from app.data.providers.nasa_earthdata import NASAEarthdataProvider

logger = logging.getLogger(__name__)


class HLSProvider(NASAEarthdataProvider):
    """Data provider for NASA Harmonized Landsat-Sentinel-2 (HLS) v2.0."""

    name = "hls"
    requires_auth = True  # Requires NASA Earthdata Login

    SCALE_FACTOR = 0.0001
    FILL_VALUE = -9999

    # Standard bands common across HLSS30 and HLSL30
    COMMON_BANDS = [
        "B02",   # Blue
        "B03",   # Green
        "B04",   # Red
        "B05",   # Red Edge 1 (S30) / NIR (L30)
        "B8A",   # Narrow NIR
        "B11",   # SWIR 1
        "B12",   # SWIR 2
        "Fmask", # Quality / cloud / shadow mask
    ]

    def __init__(
        self,
        products: list[str] | None = None,  # ["HLSS30", "HLSL30"]
        username: Optional[str] = None,
        password: Optional[str] = None,
        token: Optional[str] = None,
    ) -> None:
        super().__init__(username=username, password=password, token=token)
        self.products = products or ["HLSS30", "HLSL30"]

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float = 30.0,
        limit: int = 100,
        **kwargs: Any,
    ) -> list[SceneMetadata]:
        """Search NASA CMR for HLS granules across both HLSS30 and HLSL30."""
        self.validate_bbox(bbox)
        all_scenes: list[SceneMetadata] = []

        for prod in self.products:
            granules = self._search_cmr(
                short_name=prod,
                version="002",
                bbox=bbox,
                start_date=start_date,
                end_date=end_date,
                page_size=limit // len(self.products),
            )

            for g in granules:
                scene = self._parse_cmr_granule(g)
                if scene.cloud_cover_pct is not None and scene.cloud_cover_pct > max_cloud_cover:
                    continue
                scene.product = prod
                scene.resolution_m = 30.0
                all_scenes.append(scene)

        logger.info("Found %d HLS scenes (%s)", len(all_scenes), ", ".join(self.products))
        return all_scenes

    @staticmethod
    def parse_fmask(fmask: np.ndarray) -> dict[str, np.ndarray]:
        """
        Parse HLS Fmask 8-bit quality band.

        Bit Definitions:
          Bit 0: Cirrus (0=no, 1=yes)
          Bit 1: Cloud (0=no, 1=yes)
          Bit 2: Adjacent to Cloud/Shadow (0=no, 1=yes)
          Bit 3: Cloud Shadow (0=no, 1=yes)
          Bit 4: Snow/Ice (0=no, 1=yes)
          Bit 5: Water (0=no, 1=yes)
          Bit 6-7: Aerosol level (00=climatology, 01=low, 10=moderate, 11=high)
        """
        fmask_uint = fmask.astype(np.uint8)
        return {
            "cirrus": (fmask_uint & (1 << 0)) > 0,
            "cloud": (fmask_uint & (1 << 1)) > 0,
            "adjacent_cloud": (fmask_uint & (1 << 2)) > 0,
            "cloud_shadow": (fmask_uint & (1 << 3)) > 0,
            "snow_ice": (fmask_uint & (1 << 4)) > 0,
            "water": (fmask_uint & (1 << 5)) > 0,
            "high_aerosol": (fmask_uint & 0b11000000) == 0b11000000,
        }

    @staticmethod
    def calibrate_surface_reflectance(raw_band: np.ndarray) -> np.ndarray:
        """Apply official HLS 0.0001 scale factor and mask fill values."""
        valid_mask = raw_band != HLSProvider.FILL_VALUE
        calibrated = np.full(raw_band.shape, np.nan, dtype=np.float32)
        calibrated[valid_mask] = raw_band[valid_mask] * HLSProvider.SCALE_FACTOR
        return calibrated
