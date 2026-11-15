"""
Alaska Satellite Facility (ASF) Base SAR Data Provider for GEOVISTA Intelligence.

Provides unified discovery and authentication against the ASF Search API:
Endpoint: https://api.daac.asf.alaska.edu/services/search/param
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import requests

from app.core.exceptions import AuthenticationError, DataDownloadError
from app.core.settings import settings
from app.data.providers.base_provider import BaseDataProvider, SceneMetadata

logger = logging.getLogger(__name__)


class ASFProvider(BaseDataProvider):
    """Base provider for all SAR products distributed through Alaska Satellite Facility."""

    name = "asf"
    requires_auth = True
    SEARCH_ENDPOINT = "https://api.daac.asf.alaska.edu/services/search/param"

    def __init__(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        timeout: int = 30,
    ) -> None:
        self.username = username or settings.asf_username or settings.nasa_earthdata_username
        self.password = password or settings.asf_password or settings.nasa_earthdata_password
        self.timeout = timeout
        self._session: Optional[requests.Session] = None

    def authenticate(self) -> bool:
        """Verify authentication against Earthdata / ASF URS."""
        if not self.username or not self.password:
            logger.warning("ASF / Earthdata credentials not configured. Search works; downloads require auth.")
            return False
        session = requests.Session()
        session.auth = (self.username, self.password)
        self._session = session
        return True

    def _query_asf(self, params: dict[str, Any]) -> list[dict]:
        """Query ASF Search API with parameters and output JSON format."""
        query_params = {**params, "output": "json"}
        logger.debug("Querying ASF API with params: %s", query_params)

        try:
            resp = requests.get(self.SEARCH_ENDPOINT, params=query_params, timeout=self.timeout)
            resp.raise_for_status()
            results = resp.json()
            if isinstance(results, list) and len(results) > 0 and isinstance(results[0], list):
                return results[0]
            return results if isinstance(results, list) else []
        except Exception as e:
            logger.warning("ASF API search query failed: %s", e)
            return []

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        platform: Optional[str] = None,
        processing_level: Optional[str] = None,
        beam_mode: Optional[str] = None,
        polarization: Optional[str] = None,
        limit: int = 100,
        **kwargs: Any,
    ) -> list[SceneMetadata]:
        """Search ASF catalog by bounding box, date range, and SAR parameters."""
        self.validate_bbox(bbox)
        w, s, e, n = bbox
        bbox_str = f"{w},{s},{e},{n}"

        params: dict[str, Any] = {
            "bbox": bbox_str,
            "start": f"{start_date}T00:00:00Z",
            "end": f"{end_date}T23:59:59Z",
            "maxResults": limit,
        }
        if platform:
            params["platform"] = platform
        if processing_level:
            params["processingLevel"] = processing_level
        if beam_mode:
            params["beamMode"] = beam_mode
        if polarization:
            params["polarization"] = polarization

        raw_results = self._query_asf(params)
        scenes: list[SceneMetadata] = []

        for item in raw_results:
            scene = self._parse_asf_item(item)
            if scene:
                scenes.append(scene)

        logger.info("Found %d ASF scenes for platform=%s", len(scenes), platform)
        return scenes

    def _parse_asf_item(self, item: dict[str, Any]) -> Optional[SceneMetadata]:
        """Parse an ASF Search JSON result item into SceneMetadata."""
        granule_name = item.get("granuleName") or item.get("sceneName") or item.get("fileID")
        if not granule_name:
            return None

        # Coordinates parsing
        wkt = item.get("stringFootprint")
        coords = []
        # Approximate bbox from ASF properties or use fallback
        try:
            # item often includes faradayRotation, flightDirection, etc.
            bbox = [
                float(item.get("nearStartLon", 0.0)),
                float(item.get("farEndLat", 0.0)),
                float(item.get("farStartLon", 0.0)),
                float(item.get("nearEndLat", 0.0)),
            ]
            if bbox == [0.0, 0.0, 0.0, 0.0]:
                bbox = [-180.0, -90.0, 180.0, 90.0]
        except Exception:
            bbox = [-180.0, -90.0, 180.0, 90.0]

        download_url = item.get("downloadUrl", "")
        polarization = item.get("polarization", "VV,VH")
        bands = [p.strip() for p in polarization.split(",") if p.strip()]

        return SceneMetadata(
            scene_id=granule_name,
            provider="ASF",
            collection=item.get("platform", "SAR"),
            product=item.get("processingLevel", "GRD"),
            acquired_at=item.get("startTime", ""),
            bbox=bbox,
            footprint_geojson={"type": "Polygon", "coordinates": []},
            cloud_cover_pct=None,  # Radar penetrates clouds
            resolution_m=float(item.get("resolution", 10.0) or 10.0),
            bands=bands,
            asset_urls={"granule": download_url},
            metadata={
                "beam_mode": item.get("beamMode"),
                "flight_direction": item.get("flightDirection"),
                "orbit": item.get("orbit"),
                "path_number": item.get("pathNumber"),
                "frame_number": item.get("frameNumber"),
                "file_size_bytes": item.get("sizeMB", 0) * 1024 * 1024,
            }
        )

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """Download raw SAR granule zip/SAFE archive from ASF with authentication."""
        output_dir.mkdir(parents=True, exist_ok=True)
        url = scene.asset_urls.get("granule")
        if not url:
            raise DataDownloadError(f"No download URL available for scene {scene.scene_id}")

        out_path = output_dir / f"{scene.scene_id}.zip"
        if out_path.exists() and out_path.stat().st_size > 0:
            return {"granule": out_path}

        if not self._session:
            self.authenticate()

        logger.info("Downloading ASF SAR scene %s from %s", scene.scene_id, url)
        try:
            with (self._session or requests).get(url, stream=True, timeout=120) as r:
                r.raise_for_status()
                with open(out_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=4 * 1024 * 1024):
                        if chunk:
                            f.write(chunk)
            return {"granule": out_path}
        except Exception as e:
            raise DataDownloadError(f"ASF granule download failed for {scene.scene_id}: {e}")

    def get_collection_info(self) -> dict:
        return {
            "name": "Alaska Satellite Facility SAR Archive",
            "provider": "ASF / NASA DAAC",
            "api_endpoint": self.SEARCH_ENDPOINT,
            "requires_auth": True,
        }
