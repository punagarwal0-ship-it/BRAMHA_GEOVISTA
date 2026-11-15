"""
Landsat 8 & 9 Collection 2 Level-2 Surface Reflectance Provider for GEOVISTA Intelligence.

Products:
- Landsat 8 OLI/TIRS Collection 2 Level-2 (L8 OLI)
- Landsat 9 OLI-2/TIRS-2 Collection 2 Level-2 (L9 OLI-2)

Catalog Access:
- Microsoft Planetary Computer STAC API (collection: `landsat-c2-l2`)
- Fallback USGS M2M STAC
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

from app.core.exceptions import DataDownloadError, PreprocessingError
from app.data.providers.base_provider import BaseDataProvider, SceneMetadata

logger = logging.getLogger(__name__)


class LandsatProvider(BaseDataProvider):
    """Data provider for Landsat 8 and Landsat 9 Collection 2 Level-2."""

    name = "landsat"
    requires_auth = False  # Public via Microsoft Planetary Computer STAC

    # Official USGS scale and offset parameters for C2 L2 Surface Reflectance
    SR_SCALE_FACTOR = 0.0000275
    SR_OFFSET = -0.2
    ST_SCALE_FACTOR = 0.00341802  # Surface temperature (Kelvin)
    ST_OFFSET = 149.0
    FILL_VALUE = 0

    # Band mapping on Planetary Computer / USGS
    BAND_ASSETS = {
        "coastal": "coastal",    # Band 1 (30m)
        "blue": "blue",          # Band 2 (30m)
        "green": "green",        # Band 3 (30m)
        "red": "red",            # Band 4 (30m)
        "nir08": "nir08",        # Band 5 (30m)
        "swir16": "swir16",      # Band 6 (30m)
        "swir22": "swir22",      # Band 7 (30m)
        "lwir11": "lwir11",      # Band 10 Thermal (100m resampled to 30m)
        "qa_pixel": "qa_pixel",  # Surface reflectance quality
        "qa_radsat": "qa_radsat",# Radiometric saturation
    }

    STAC_ENDPOINT = "https://planetarycomputer.microsoft.com/api/stac/v1"

    def __init__(self, use_pc: bool = True) -> None:
        self.use_pc = use_pc

    def authenticate(self) -> bool:
        """Microsoft Planetary Computer STAC is publicly searchable."""
        return True

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float = 30.0,
        platforms: list[str] | None = None,  # e.g. ["landsat-8", "landsat-9"]
        limit: int = 100,
        **kwargs: Any,
    ) -> list[SceneMetadata]:
        """Search Landsat Collection 2 Level-2 granules intersecting bbox within date range."""
        self.validate_bbox(bbox)
        import requests

        search_url = f"{self.STAC_ENDPOINT}/search"
        payload: dict[str, Any] = {
            "collections": ["landsat-c2-l2"],
            "bbox": bbox,
            "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
            "limit": limit,
            "query": {
                "eo:cloud_cover": {"lte": max_cloud_cover}
            }
        }
        if platforms:
            payload["query"]["platform"] = {"in": platforms}

        logger.info(
            "Searching Landsat Collection 2 L2: bbox=%s, dates=%s to %s, max_cloud=%s%%",
            bbox, start_date, end_date, max_cloud_cover
        )

        try:
            resp = requests.post(search_url, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning("Landsat STAC search failed or timed out: %s", e)
            return []

        features = data.get("features", [])
        scenes: list[SceneMetadata] = []

        for feat in features:
            props = feat.get("properties", {})
            assets = feat.get("assets", {})
            feat_bbox = feat.get("bbox", bbox)
            geometry = feat.get("geometry", {})

            asset_urls = {}
            for band_key, asset_name in self.BAND_ASSETS.items():
                if asset_name in assets:
                    asset_urls[band_key] = assets[asset_name].get("href", "")

            scene = SceneMetadata(
                scene_id=feat.get("id", ""),
                provider="USGS/NASA",
                collection="landsat-c2-l2",
                product=props.get("platform", "landsat"),
                acquired_at=props.get("datetime", ""),
                bbox=feat_bbox,
                footprint_geojson=geometry,
                cloud_cover_pct=float(props.get("eo:cloud_cover", 0.0)),
                resolution_m=30.0,
                bands=list(asset_urls.keys()),
                asset_urls=asset_urls,
                metadata={
                    "landsat_product_id": props.get("landsat:product_id"),
                    "sun_elevation": props.get("view:sun_elevation"),
                    "sun_azimuth": props.get("view:sun_azimuth"),
                    "processing_level": props.get("landsat:processing_level", "L2SP"),
                }
            )
            scenes.append(scene)

        logger.info("Found %d Landsat scenes", len(scenes))
        return scenes

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """Download or sign requested bands for a Landsat scene."""
        import requests

        output_dir.mkdir(parents=True, exist_ok=True)
        downloaded: dict[str, Path] = {}
        target_bands = bands or list(scene.asset_urls.keys())

        for band in target_bands:
            url = scene.asset_urls.get(band)
            if not url:
                continue

            # Sign URL via Planetary Computer signing API if necessary
            sign_url = f"https://planetarycomputer.microsoft.com/api/sas/v1/sign?href={url}"
            try:
                sign_resp = requests.get(sign_url, timeout=10)
                if sign_resp.status_code == 200:
                    url = sign_resp.json().get("href", url)
            except Exception:
                pass  # Fallback to direct URL

            out_file = output_dir / f"{scene.scene_id}_{band}.tif"
            if out_file.exists() and out_file.stat().st_size > 0:
                downloaded[band] = out_file
                continue

            try:
                logger.info("Downloading Landsat band %s for scene %s", band, scene.scene_id)
                with requests.get(url, stream=True, timeout=60) as r:
                    r.raise_for_status()
                    with open(out_file, "wb") as f:
                        for chunk in r.iter_content(chunk_size=1024 * 1024):
                            if chunk:
                                f.write(chunk)
                downloaded[band] = out_file
            except Exception as e:
                raise DataDownloadError(f"Failed to download Landsat band {band}: {e}")

        return downloaded

    def get_collection_info(self) -> dict:
        return {
            "name": "Landsat 8-9 Collection 2 Level-2",
            "provider": "USGS / NASA",
            "resolution_m": 30.0,
            "revisit_days": 8,
            "bands": list(self.BAND_ASSETS.keys()),
            "sr_scale": self.SR_SCALE_FACTOR,
            "sr_offset": self.SR_OFFSET,
        }

    @staticmethod
    def parse_qa_pixel(qa: np.ndarray) -> dict[str, np.ndarray]:
        """
        Parse Landsat Collection 2 QA_PIXEL 16-bit bitmask.

        Bit Definitions:
          Bit 0: Fill (0=no, 1=yes)
          Bit 1: Dilated Cloud (0=no, 1=yes)
          Bit 2: Cirrus (0=no, 1=yes)
          Bit 3: Cloud (0=no, 1=yes)
          Bit 4: Cloud Shadow (0=no, 1=yes)
          Bit 5: Snow (0=no, 1=yes)
          Bit 6: Clear (0=no, 1=yes)
          Bit 7: Water (0=no, 1=yes)
        """
        qa_int = qa.astype(np.uint16)
        return {
            "fill": (qa_int & (1 << 0)) > 0,
            "dilated_cloud": (qa_int & (1 << 1)) > 0,
            "cirrus": (qa_int & (1 << 2)) > 0,
            "cloud": (qa_int & (1 << 3)) > 0,
            "cloud_shadow": (qa_int & (1 << 4)) > 0,
            "snow": (qa_int & (1 << 5)) > 0,
            "clear": (qa_int & (1 << 6)) > 0,
            "water": (qa_int & (1 << 7)) > 0,
        }

    @staticmethod
    def calibrate_surface_reflectance(raw_band: np.ndarray) -> np.ndarray:
        """Apply official USGS scale factor and offset to Landsat surface reflectance."""
        valid_mask = raw_band != LandsatProvider.FILL_VALUE
        calibrated = np.full(raw_band.shape, np.nan, dtype=np.float32)
        calibrated[valid_mask] = (
            raw_band[valid_mask] * LandsatProvider.SR_SCALE_FACTOR + LandsatProvider.SR_OFFSET
        )
        return calibrated
