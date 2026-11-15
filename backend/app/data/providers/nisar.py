"""
NISAR (NASA-ISRO SAR Mission) Data Discovery and Ingestion Adapter for GEOVISTA Intelligence.

Products & Level Spec:
- L-SAR: 1.25 GHz (L-band)
- S-SAR: 3.2 GHz (S-band)
- RSLC: Range-Doppler Single Look Complex
- GCOV: Geocoded Calibrated Polarimetric Covariance
- GUNW: Geocoded Unwrapped Interferograms

Catalog: ASF DAAC / CMR
Documentation: https://nisar-docs.asf.alaska.edu/
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from app.data.providers.asf import ASFProvider
from app.data.providers.base_provider import SceneMetadata

logger = logging.getLogger(__name__)


class NISARProvider(ASFProvider):
    """Adapter for NASA-ISRO Synthetic Aperture Radar (NISAR) data products."""

    name = "nisar"

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None) -> None:
        super().__init__(username=username, password=password)

    def search_gcov(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        frequency_band: str = "L",  # "L" or "S"
        limit: int = 50,
    ) -> list[SceneMetadata]:
        """Search for NISAR Geocoded Covariance (GCOV) products."""
        return self.search(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            platform="NISAR",
            processing_level="GCOV",
            limit=limit,
        )

    def search_gunw(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        limit: int = 50,
    ) -> list[SceneMetadata]:
        """Search for NISAR Geocoded Unwrapped Interferograms (GUNW) for deformation."""
        return self.search(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            platform="NISAR",
            processing_level="GUNW",
            limit=limit,
        )

    @staticmethod
    def inspect_local_hdf5(hdf5_path: Path) -> dict[str, Any]:
        """
        Inspect layers inside a NISAR HDF5 file (h5py format).
        Safely extracts grid mapping, projection, and polarimetric terms (HHHH, HVHV, etc.).
        """
        if not hdf5_path.exists():
            raise FileNotFoundError(f"NISAR HDF5 file not found: {hdf5_path}")

        try:
            import h5py  # type: ignore
            with h5py.File(hdf5_path, "r") as f:
                # NISAR standard science group hierarchy: /science/LSAR/GCOV/grids/frequencyA
                keys = list(f.keys())
                return {
                    "root_groups": keys,
                    "file_path": str(hdf5_path),
                    "file_size_mb": round(hdf5_path.stat().st_size / (1024 * 1024), 2),
                }
        except ImportError:
            return {
                "file_path": str(hdf5_path),
                "notice": "h5py not installed; install h5py to inspect full internal HDF5 datasets.",
            }

    def get_collection_info(self) -> dict:
        return {
            "name": "NASA-ISRO SAR Mission (NISAR)",
            "provider": "NASA JPL / ISRO / ASF DAAC",
            "frequencies": ["L-band (1.25 GHz, 24 cm)", "S-band (3.2 GHz, 9.3 cm)"],
            "orbit_revisit_days": 12,
            "swath_width_km": 240,
            "spatial_resolution_m": "3 to 10 m",
            "operational_status": "Discovery enabled; actual science streaming subject to mission commissioning",
            "formats": "HDF5 / NetCDF",
        }
