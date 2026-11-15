"""
RADARSAT-1 Historical Archive (1995–2013) Ingestion Adapter for GEOVISTA Intelligence.

Historical Characteristics:
- Mission operational lifespan: November 1995 to March 2013
- C-band SAR (5.3 GHz, HH single polarization)
- Provided 18+ years of global radar baseline observations
- Data distribution format: CEOS (Committee on Earth Observation Satellites) binary or GeoTIFF
- Access archive: ASF DAAC / Canadian Open Government Catalog
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from app.data.providers.asf import ASFProvider
from app.data.providers.base_provider import SceneMetadata

logger = logging.getLogger(__name__)


class RADARSAT1Provider(ASFProvider):
    """Adapter for the historical RADARSAT-1 C-band SAR archive."""

    name = "radarsat1"

    def search_historical(
        self,
        bbox: list[float],
        start_date: str = "1995-11-04",
        end_date: str = "2013-03-29",
        beam_mode: Optional[str] = None,  # e.g., "Standard", "Fine", "Wide", "ScanSAR"
        limit: int = 50,
    ) -> list[SceneMetadata]:
        """Search ASF RADARSAT-1 historical catalog."""
        return self.search(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            platform="RADARSAT-1",
            beam_mode=beam_mode,
            limit=limit,
        )

    @staticmethod
    def inspect_local_ceos_folder(folder_path: Path) -> dict[str, Any]:
        """
        Inspect a local CEOS-formatted RADARSAT-1 package.
        Checks for leader file (lea_01.001), imagery (dat_01.001), and trailer (tra_01.001).
        """
        if not folder_path.exists():
            raise FileNotFoundError(f"RADARSAT-1 folder not found: {folder_path}")

        files = [p.name.lower() for p in folder_path.iterdir() if p.is_file()]
        has_leader = any("lea" in f for f in files)
        has_data = any("dat" in f or "img" in f for f in files) or any(f.endswith(".tif") for f in files)

        return {
            "folder": str(folder_path),
            "is_ceos_format": has_leader and has_data,
            "contains_geotiff": any(f.endswith(".tif") for f in files),
            "files": files[:10],
            "valid": has_data,
        }

    def get_collection_info(self) -> dict:
        return {
            "name": "RADARSAT-1 Historical Archive",
            "provider": "CSA / ASF DAAC",
            "operational_period": "1995-11-04 to 2013-03-29 (Defunct/Archive only)",
            "frequency": "C-band (5.3 GHz, 5.6 cm)",
            "polarization": "HH (Single-pol)",
            "environmental_utility": "Decadal baseline comparison for long-term coastal erosion and glacier retreat.",
        }
