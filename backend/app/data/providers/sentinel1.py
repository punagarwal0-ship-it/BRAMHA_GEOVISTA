"""
Sentinel-1 C-Band Synthetic Aperture Radar (SAR) Provider for GEOVISTA Intelligence.

Products:
- Sentinel-1 Ground Range Detected (GRD) — primary for flood and coastal monitoring
- Sentinel-1 Single Look Complex (SLC) — required for InSAR phase/coherence deformation

Sensor Attributes:
- Center frequency: 5.405 GHz (C-band)
- Polarizations: Dual-pol (VV + VH or HH + HV)
- Resolution: ~10m (IW GRD)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from app.data.providers.asf import ASFProvider
from app.data.providers.base_provider import SceneMetadata

logger = logging.getLogger(__name__)


class Sentinel1Provider(ASFProvider):
    """Data provider for Sentinel-1A and Sentinel-1B SAR missions via ASF."""

    name = "sentinel1"

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        default_processing_level: str = "GRD",
    ) -> None:
        super().__init__(username=username, password=password)
        self.default_processing_level = default_processing_level

    def search_grd(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        polarization: str = "VV+VH",
        beam_mode: str = "IW",
        limit: int = 50,
    ) -> list[SceneMetadata]:
        """Search Sentinel-1 Ground Range Detected (GRD) IW mode scenes."""
        return self.search(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            platform="SENTINEL-1",
            processing_level="GRD_HD" if self.default_processing_level == "GRD" else "GRD",
            beam_mode=beam_mode,
            polarization=polarization,
            limit=limit,
        )

    def search_slc(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        flight_direction: Optional[str] = None,
        limit: int = 50,
    ) -> list[SceneMetadata]:
        """Search Sentinel-1 Single Look Complex (SLC) scenes for InSAR interferometry."""
        kwargs: dict[str, Any] = {}
        if flight_direction:
            kwargs["flightDirection"] = flight_direction

        return self.search(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            platform="SENTINEL-1",
            processing_level="SLC",
            beam_mode="IW",
            limit=limit,
            **kwargs,
        )

    def get_collection_info(self) -> dict:
        return {
            "name": "Copernicus Sentinel-1 C-SAR",
            "provider": "ESA / ASF DAAC",
            "frequency_band": "C-band (5.405 GHz)",
            "wavelength_cm": 5.55,
            "resolution_m": 10.0,
            "revisit_days": 6,  # 12 days for single satellite
            "beam_modes": ["IW (Interferometric Wide)", "EW (Extra-Wide)", "SM (Stripmap)"],
            "polarizations": ["VV", "VH", "HH", "HV"],
            "preprocessing_notice": (
                "Raw GRD requires: thermal noise removal -> radiometric calibration to sigma0 "
                "-> range-doppler terrain correction -> Lee speckle filter."
            )
        }
