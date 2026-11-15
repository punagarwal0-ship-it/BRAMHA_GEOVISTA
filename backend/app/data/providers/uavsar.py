"""
NASA / JPL Airborne Polarimetric L-Band SAR (UAVSAR) Ingestion Adapter for GEOVISTA Intelligence.

Attributes:
- Platform: Gulfstream-III Aircraft
- Center Frequency: 1.257 GHz (L-band, 23.8 cm)
- Polarizations: Full quad-pol (HH, HV, VH, VV)
- Resolution: ~1 m (SLC), ~5 m (GRD, PolSAR)
- Campaign-based research flights across specialized experimental sites.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from app.data.providers.asf import ASFProvider
from app.data.providers.base_provider import SceneMetadata

logger = logging.getLogger(__name__)


class UAVSARProvider(ASFProvider):
    """Adapter for NASA JPL UAVSAR polarimetric & interferometric airborne campaigns."""

    name = "uavsar"

    def search_campaign(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        flight_line: Optional[str] = None,
        limit: int = 25,
    ) -> list[SceneMetadata]:
        """Search UAVSAR flight campaign data via ASF DAAC."""
        kwargs: dict[str, Any] = {}
        if flight_line:
            kwargs["flightLine"] = flight_line

        return self.search(
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            platform="UAVSAR",
            limit=limit,
            **kwargs,
        )

    @staticmethod
    def parse_annotation_file(ann_path: Path) -> dict[str, Any]:
        """
        Parse UAVSAR .ann metadata file into structured key-value parameters.
        Extracts peg latitude/longitude, heading, altitude, pixel spacing.
        """
        if not ann_path.exists():
            raise FileNotFoundError(f"UAVSAR annotation file not found: {ann_path}")

        metadata: dict[str, str] = {}
        with open(ann_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith(";"):
                    continue
                if "=" in line:
                    key, _, val = line.partition("=")
                    clean_key = key.strip().split("(")[0].strip()
                    clean_val = val.strip().split(";")[0].strip()
                    metadata[clean_key] = clean_val

        return metadata

    def get_collection_info(self) -> dict:
        return {
            "name": "NASA JPL UAVSAR (Uninhabited Aerial Vehicle SAR)",
            "provider": "NASA JPL / ASF DAAC",
            "type": "Airborne Polarimetric L-band SAR",
            "frequency_ghz": 1.257,
            "resolution_m": 5.0,
            "coverage": "Research campaign flight lines (North America, Central America, select global)",
            "campaign_notice": "Not a continuous satellite constellation; localized research tracks only.",
        }
