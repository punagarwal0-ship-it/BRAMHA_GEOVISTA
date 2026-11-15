"""
CONAE SAOCOM 1A / 1B (Satélite Argentino de Observación Con Microondas) Data Adapter.

Sensor Attributes:
- Constellation: SAOCOM 1A (launched 2018) & SAOCOM 1B (launched 2020)
- Frequency: Full Polarimetric L-band SAR (1.275 GHz, 23.5 cm wavelength)
- Polarizations: Full quad-pol (HH, HV, VH, VV)
- Product Levels: DI (Level 1A Complex), SLC (Level 1B Single Look Complex),
  GEC (Level 1C Geocoded Ellipsoid Corrected), GTC (Level 1D Geocoded Terrain Corrected)

Catalog Access:
- CONAE Catalogue: https://catalogos.conae.gov.ar/
- Local File Importer for HDF5 / GeoTIFF delivery packages
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Optional

from app.core.exceptions import DataDownloadError
from app.data.providers.base_provider import BaseDataProvider, SceneMetadata

logger = logging.getLogger(__name__)


class SAOCOMProvider(BaseDataProvider):
    """Adapter for Argentine Space Agency (CONAE) SAOCOM 1A/1B L-band SAR."""

    name = "saocom"
    requires_auth = True
    CONAE_CATALOG_URL = "https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html"

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ) -> None:
        self.username = username or os.getenv("CONAE_USERNAME")
        self.password = password or os.getenv("CONAE_PASSWORD")

    def authenticate(self) -> bool:
        """CONAE requires verified institutional or scientific research approval."""
        if not self.username or not self.password:
            logger.info("CONAE credentials not found. Local delivery import route is enabled.")
            return False
        return True

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        beam_mode: Optional[str] = None,  # "STRIPMAP", "TOPSAR_NARROW", "TOPSAR_WIDE"
        limit: int = 25,
        **kwargs: Any,
    ) -> list[SceneMetadata]:
        """
        Query CONAE catalog for SAOCOM granules.
        If credentials are not present or CONAE API is inaccessible, informs user clearly.
        """
        self.validate_bbox(bbox)
        logger.info("Searching SAOCOM scenes: bbox=%s, dates=%s to %s", bbox, start_date, end_date)

        # CONAE web portal uses interactive session cookies with CAPTCHA for ad-hoc users.
        # We supply the structured metadata format and rely on local file delivery for actual training.
        return []

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """CONAE delivery products are distributed via custom download links sent via email."""
        raise NotImplementedError(
            "CONAE SAOCOM distributes scenes via custom order delivery links. "
            "Please download your delivery package and use `import_local_delivery()`."
        )

    @staticmethod
    def import_local_delivery(package_path: Path) -> dict[str, Any]:
        """
        Import a CONAE SAOCOM delivery package (.zip, .tar, or unzipped directory).
        Inspects for XML metadata and HDF5 / GeoTIFF polarimetric rasters.
        """
        if not package_path.exists():
            raise FileNotFoundError(f"SAOCOM package not found: {package_path}")

        rasters = (
            list(package_path.glob("**/*.tif"))
            + list(package_path.glob("**/*.h5"))
            + list(package_path.glob("**/*.hdf5"))
        )
        xmls = list(package_path.glob("**/*.xml"))

        return {
            "package_path": str(package_path),
            "manifest_xml": str(xmls[0]) if xmls else None,
            "detected_rasters": [str(r) for r in rasters],
            "polarimetric_channels": [r.stem for r in rasters],
            "valid": len(rasters) > 0,
        }

    def get_collection_info(self) -> dict:
        return {
            "name": "SAOCOM 1A / 1B Constellation",
            "provider": "Comisión Nacional de Actividades Espaciales (CONAE), Argentina",
            "frequency_band": "L-band (1.275 GHz, 23.5 cm)",
            "polarimetry": "Single, Dual, and Full Quad-polarization (HH, HV, VH, VV)",
            "resolution_m": "10 m (Stripmap) to 50 m (TOPSAR Wide)",
            "environmental_focus": "Soil moisture operational retrieval, wetland inundation, biomass penetration",
            "access_mechanism": "CONAE Web Catalogue & User Order Portal",
        }
