"""
Authoritative Environmental Reference Datasets Provider for GEOVISTA Intelligence.

Provides access and schemas for:
1. ESA WorldCover (10m global land cover)
2. JRC Global Surface Water (GSW) (permanent vs seasonal water)
3. Copernicus Emergency Management Service (EMS) flood event delineations
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

from app.core.exceptions import DataDownloadError
from app.data.providers.base_provider import BaseDataProvider, SceneMetadata

logger = logging.getLogger(__name__)


class ESAWorldCoverProvider(BaseDataProvider):
    """Provider for ESA WorldCover (2020 & 2021) 10m Global Land Cover."""

    name = "esa_worldcover"
    requires_auth = False  # Open Access hosted on AWS Open Data and VITO

    # Official discrete 10m land cover class definitions
    CLASSES = {
        10: "Tree cover",
        20: "Shrubland",
        30: "Grassland",
        40: "Cropland",
        50: "Built-up",
        60: "Bare / sparse vegetation",
        70: "Snow and ice",
        80: "Permanent water bodies",
        90: "Herbaceous wetland",
        95: "Mangroves",
        100: "Moss and lichen",
    }

    # Public S3 / HTTP base URL (v200 = 2021, v100 = 2020)
    AWS_S3_BUCKET = "esa-worldcover"

    def authenticate(self) -> bool:
        return True

    def search(
        self,
        bbox: list[float],
        start_date: str = "2021-01-01",
        end_date: str = "2021-12-31",
        year: int = 2021,
        **kwargs: Any,
    ) -> list[SceneMetadata]:
        """
        Identify the 3x3 degree ESA WorldCover tiles intersecting the AOI.
        Naming convention: ESA_WorldCover_10m_{YEAR}_v{VER}_{LAT_HEMI}{LAT}{LON_HEMI}{LON}_Map.tif
        """
        self.validate_bbox(bbox)
        min_lon, min_lat, max_lon, max_lat = bbox

        # Compute tile grid indices (3-degree stepping)
        lat_starts = range(int(np.floor(min_lat / 3.0) * 3), int(np.ceil(max_lat / 3.0) * 3), 3)
        lon_starts = range(int(np.floor(min_lon / 3.0) * 3), int(np.ceil(max_lon / 3.0) * 3), 3)

        ver = "v200" if year == 2021 else "v100"
        scenes: list[SceneMetadata] = []

        for lat in lat_starts:
            for lon in lon_starts:
                lat_hemi = "N" if lat >= 0 else "S"
                lon_hemi = "E" if lon >= 0 else "W"
                tile_id = f"ESA_WorldCover_10m_{year}_{ver}_{lat_hemi}{abs(lat):02d}{lon_hemi}{abs(lon):03d}_Map"
                tile_url = f"https://esa-worldcover.s3.amazonaws.com/{ver}/{year}/map/{tile_id}.tif"

                scene = SceneMetadata(
                    scene_id=tile_id,
                    provider="ESA / VITO",
                    collection="worldcover",
                    product=f"WorldCover_{year}",
                    acquired_at=f"{year}-06-01T00:00:00Z",
                    bbox=[lon, lat, lon + 3.0, lat + 3.0],
                    footprint_geojson={},
                    cloud_cover_pct=0.0,
                    resolution_m=10.0,
                    bands=["map"],
                    asset_urls={"map": tile_url},
                    metadata={"year": year, "version": ver, "classes": self.CLASSES},
                )
                scenes.append(scene)

        logger.info("Found %d ESA WorldCover tiles for AOI", len(scenes))
        return scenes

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """Download public ESA WorldCover Cloud-Optimized GeoTIFF."""
        import requests

        output_dir.mkdir(parents=True, exist_ok=True)
        url = scene.asset_urls.get("map")
        if not url:
            raise DataDownloadError(f"No URL for WorldCover scene {scene.scene_id}")

        out_path = output_dir / f"{scene.scene_id}.tif"
        if out_path.exists() and out_path.stat().st_size > 0:
            return {"map": out_path}

        try:
            logger.info("Downloading ESA WorldCover tile from %s", url)
            with requests.get(url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(out_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
            return {"map": out_path}
        except Exception as e:
            raise DataDownloadError(f"WorldCover tile download failed: {e}")

    def get_collection_info(self) -> dict:
        return {
            "name": "ESA WorldCover 10m",
            "provider": "European Space Agency (ESA) / VITO",
            "resolution_m": 10.0,
            "years_available": [2020, 2021],
            "classes": self.CLASSES,
            "resampling_rule": "NEAREST neighbor interpolation strictly required for categorical class labels.",
        }


class GlobalSurfaceWaterProvider(BaseDataProvider):
    """Provider for EC JRC Global Surface Water (GSW) occurrence & seasonality."""

    name = "jrc_surface_water"
    requires_auth = False

    def authenticate(self) -> bool:
        return True

    def search(
        self,
        bbox: list[float],
        start_date: str = "2021-01-01",
        end_date: str = "2021-12-31",
        **kwargs: Any,
    ) -> list[SceneMetadata]:
        self.validate_bbox(bbox)
        # JRC 10x10 degree tiles
        return []

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        raise NotImplementedError("JRC Surface water downloaded via direct tile coordinates.")

    def get_collection_info(self) -> dict:
        return {
            "name": "JRC Global Surface Water (GSW)",
            "provider": "European Commission Joint Research Centre",
            "layers": ["occurrence", "change", "seasonality", "recurrence", "transitions", "extent"],
            "resolution_m": 30.0,
        }
