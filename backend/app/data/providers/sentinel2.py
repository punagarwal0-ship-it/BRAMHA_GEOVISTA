"""
Sentinel-2 Level-2A provider for GEOVISTA Intelligence.

Data source  : Microsoft Planetary Computer STAC API (public, no auth required)
Collection   : sentinel-2-l2a
Fallback     : Copernicus Data Space Ecosystem STAC API

Band mapping (official ESA band IDs → semantic names)
------------------------------------------------------
  B02 : Blue             10 m
  B03 : Green            10 m
  B04 : Red              10 m
  B08 : NIR              10 m
  B8A : RedEdge4         20 m
  B11 : SWIR1            20 m
  B12 : SWIR2            20 m
  SCL : SceneClassification 20 m

Scale factor
------------
  Digital Number × 0.0001 → surface reflectance [0, 1]
  (Some older products use 10 000 as the base; check ``PROCESSING_BASELINE``.)

SCL (Scene Classification Layer) class codes
--------------------------------------------
  0  = No data
  1  = Saturated / Defective
  2  = Dark Area Pixels
  3  = Cloud Shadows
  4  = Vegetation
  5  = Not Vegetated
  6  = Water
  7  = Unclassified
  8  = Cloud Medium Probability
  9  = Cloud High Probability
  10 = Thin Cirrus
  11 = Snow or Ice

Masks applied by apply_scl_mask
--------------------------------
  Cloudy     : SCL ∈ {8, 9}
  Cloud Shadow: SCL ∈ {3}
  Snow/Ice   : SCL ∈ {11}
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import requests

from app.data.providers.base_provider import BaseDataProvider, SceneMetadata

try:
    from app.core.exceptions import (
        AuthenticationError,
        DataDownloadError,
        DataNotFoundError,
        DataProviderError,
    )
except ImportError:
    class DataProviderError(Exception): pass  # type: ignore[no-redef]
    class AuthenticationError(DataProviderError): pass  # type: ignore[no-redef]
    class DataNotFoundError(DataProviderError): pass  # type: ignore[no-redef]
    class DataDownloadError(DataProviderError): pass  # type: ignore[no-redef]

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

PC_STAC_ENDPOINT = "https://planetarycomputer.microsoft.com/api/stac/v1"
CDSE_STAC_ENDPOINT = "https://catalogue.dataspace.copernicus.eu/stac"

COLLECTION = "sentinel-2-l2a"

# ---------------------------------------------------------------------------
# Band metadata
# ---------------------------------------------------------------------------

BAND_INFO: dict[str, dict] = {
    "B02":  {"name": "Blue",             "resolution_m": 10,  "wavelength_nm": 492},
    "B03":  {"name": "Green",            "resolution_m": 10,  "wavelength_nm": 560},
    "B04":  {"name": "Red",              "resolution_m": 10,  "wavelength_nm": 665},
    "B08":  {"name": "NIR",              "resolution_m": 10,  "wavelength_nm": 833},
    "B8A":  {"name": "RedEdge4",         "resolution_m": 20,  "wavelength_nm": 865},
    "B11":  {"name": "SWIR1",            "resolution_m": 20,  "wavelength_nm": 1614},
    "B12":  {"name": "SWIR2",            "resolution_m": 20,  "wavelength_nm": 2202},
    "SCL":  {"name": "SceneClass",       "resolution_m": 20,  "wavelength_nm": None},
    "B05":  {"name": "RedEdge1",         "resolution_m": 20,  "wavelength_nm": 704},
    "B06":  {"name": "RedEdge2",         "resolution_m": 20,  "wavelength_nm": 740},
    "B07":  {"name": "RedEdge3",         "resolution_m": 20,  "wavelength_nm": 783},
    "B09":  {"name": "WaterVapour",      "resolution_m": 60,  "wavelength_nm": 945},
    "B01":  {"name": "CoastalAerosol",   "resolution_m": 60,  "wavelength_nm": 443},
    "AOT":  {"name": "AOT",              "resolution_m": 10,  "wavelength_nm": None},
    "WVP":  {"name": "WaterVapourProd",  "resolution_m": 10,  "wavelength_nm": None},
}

DEFAULT_BANDS = ["B02", "B03", "B04", "B08", "B8A", "B11", "B12", "SCL"]

REFLECTANCE_SCALE = 0.0001

# SCL classes to mask
SCL_CLOUD_MEDIUM = 8
SCL_CLOUD_HIGH = 9
SCL_CLOUD_SHADOW = 3
SCL_SNOW_ICE = 11


class Sentinel2L2AProvider(BaseDataProvider):
    """Provider for Sentinel-2 Level-2A via Microsoft Planetary Computer STAC.

    Authentication is NOT required for the Planetary Computer public STAC.
    COG (Cloud Optimised GeoTIFF) assets are signed on-the-fly for download.

    Parameters
    ----------
    max_cloud_cover:
        Default maximum cloud cover percentage to filter scenes (0-100).
    use_planetary_computer:
        If True (default) use Planetary Computer; if False fall back to
        Copernicus Data Space Ecosystem STAC.
    """

    name = "Sentinel2_L2A"
    requires_auth = False

    RESOLUTION_M = 10.0

    def __init__(
        self,
        max_cloud_cover: float = 30.0,
        use_planetary_computer: bool = True,
    ) -> None:
        self._max_cloud_cover = max_cloud_cover
        self._stac_endpoint = (
            PC_STAC_ENDPOINT if use_planetary_computer else CDSE_STAC_ENDPOINT
        )
        self._use_pc = use_planetary_computer
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "GEOVISTA/1.0 Sentinel2Provider"})

    # ------------------------------------------------------------------
    # Authentication (public data, no-op)
    # ------------------------------------------------------------------

    def authenticate(self) -> bool:
        """No authentication required for Planetary Computer public STAC."""
        logger.info(
            "[%s] No authentication required for Planetary Computer public STAC.",
            self.name,
        )
        return True

    # ------------------------------------------------------------------
    # STAC search helpers
    # ------------------------------------------------------------------

    def _stac_search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float,
        max_items: int = 500,
    ) -> list[dict]:
        """Execute a STAC /search POST against the configured endpoint.

        Returns raw STAC Item dicts (feature list).
        """
        # Try pystac-client first, fall back to raw httpx/requests
        try:
            return self._stac_search_pystac(bbox, start_date, end_date, max_cloud_cover, max_items)
        except ImportError:
            logger.debug("[%s] pystac-client not installed, using raw STAC API.", self.name)
        except Exception as exc:
            logger.warning("[%s] pystac-client search failed: %s. Falling back.", self.name, exc)

        return self._stac_search_raw(bbox, start_date, end_date, max_cloud_cover, max_items)

    def _stac_search_pystac(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float,
        max_items: int,
    ) -> list[dict]:
        """Search using pystac-client library."""
        from pystac_client import Client  # type: ignore[import-untyped]

        catalog = Client.open(self._stac_endpoint)
        datetime_range = f"{start_date}T00:00:00Z/{end_date}T23:59:59Z"

        search = catalog.search(
            collections=[COLLECTION],
            bbox=bbox,
            datetime=datetime_range,
            query={"eo:cloud_cover": {"lte": max_cloud_cover}},
            max_items=max_items,
            sortby=[{"field": "datetime", "direction": "asc"}],
        )
        return [item.to_dict() for item in search.items()]

    def _stac_search_raw(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float,
        max_items: int,
    ) -> list[dict]:
        """Search using raw STAC /search POST with pagination."""
        url = f"{self._stac_endpoint}/search"
        payload: dict = {
            "collections": [COLLECTION],
            "bbox": bbox,
            "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lte": max_cloud_cover}},
            "limit": min(max_items, 100),
            "sortby": [{"field": "properties.datetime", "direction": "asc"}],
        }

        all_features: list[dict] = []
        next_token = None

        while True:
            if next_token:
                payload["token"] = next_token

            resp = self._session.post(url, json=payload, timeout=60)
            if resp.status_code == 400:
                # Some STAC endpoints don't support query filters; retry without
                payload.pop("query", None)
                resp = self._session.post(url, json=payload, timeout=60)

            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            all_features.extend(features)

            # Manual cloud filter if endpoint didn't support query
            if "query" not in payload:
                all_features = [
                    f for f in all_features
                    if f.get("properties", {}).get("eo:cloud_cover", 0) <= max_cloud_cover
                ]

            links = {l["rel"]: l for l in data.get("links", [])}
            if "next" in links and len(all_features) < max_items:
                next_href = links["next"].get("href", "")
                next_body = links["next"].get("body", {})
                next_token = next_body.get("token")
                if not next_token and not next_href:
                    break
            else:
                break

        return all_features[:max_items]

    def _parse_stac_item(self, item: dict) -> SceneMetadata:
        """Convert a STAC Item dict to SceneMetadata."""
        props = item.get("properties", {})
        item_id = item.get("id", "unknown")

        # Bbox
        bbox_raw = item.get("bbox", [0, 0, 0, 0])
        if len(bbox_raw) == 4:
            bbox = [float(x) for x in bbox_raw]
        else:
            bbox = [0.0, 0.0, 0.0, 0.0]

        # Footprint
        footprint = item.get("geometry", {"type": "Polygon", "coordinates": []})

        # Temporal
        acquired_at = props.get("datetime") or props.get("start_datetime", "")

        # Cloud cover
        cloud_cover = props.get("eo:cloud_cover")
        if cloud_cover is not None:
            cloud_cover = float(cloud_cover)

        # Asset URLs – COG per band
        asset_urls: dict[str, str] = {}
        for band_id, asset in item.get("assets", {}).items():
            href = asset.get("href", "")
            if href:
                asset_urls[band_id] = href

        # Available bands (asset keys)
        bands = [b for b in asset_urls if b in BAND_INFO]
        if not bands:
            bands = DEFAULT_BANDS

        return SceneMetadata(
            scene_id=item_id,
            provider=self.name,
            collection=COLLECTION,
            product="S2MSI2A",
            acquired_at=acquired_at,
            bbox=bbox,
            footprint_geojson=footprint,
            cloud_cover_pct=cloud_cover,
            resolution_m=self.RESOLUTION_M,
            bands=bands,
            asset_urls=asset_urls,
            metadata={
                "platform": props.get("platform", ""),
                "instruments": props.get("instruments", []),
                "constellation": props.get("constellation", "sentinel-2"),
                "s2:mgrs_tile": props.get("s2:mgrs_tile", ""),
                "s2:datatake_id": props.get("s2:datatake_id", ""),
                "s2:product_type": props.get("s2:product_type", "S2MSI2A"),
                "s2:processing_baseline": props.get("s2:processing_baseline", ""),
                "sun_elevation": props.get("sun_elevation"),
                "view:sun_azimuth": props.get("view:sun_azimuth"),
            },
        )

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        max_cloud_cover: float | None = None,
        max_items: int = 500,
        **kwargs,
    ) -> list[SceneMetadata]:
        """Search for Sentinel-2 L2A scenes.

        Parameters
        ----------
        bbox:
            [minlon, minlat, maxlon, maxlat] EPSG:4326.
        start_date, end_date:
            ISO 8601 date strings.
        max_cloud_cover:
            Maximum cloud cover [0-100].  Defaults to instance default.
        max_items:
            Maximum scenes to return.

        Returns
        -------
        list[SceneMetadata]
            Matching scenes, sorted by acquisition date.
        """
        self.validate_bbox(bbox)
        self.validate_dates(start_date, end_date)

        cloud_limit = max_cloud_cover if max_cloud_cover is not None else self._max_cloud_cover

        # Try PC; fall back to CDSE
        stac_items: list[dict] = []
        try:
            stac_items = self._stac_search(bbox, start_date, end_date, cloud_limit, max_items)
        except Exception as exc:
            if self._use_pc:
                logger.warning(
                    "[%s] Planetary Computer STAC failed (%s). Trying Copernicus STAC.",
                    self.name, exc,
                )
                old_ep = self._stac_endpoint
                self._stac_endpoint = CDSE_STAC_ENDPOINT
                try:
                    stac_items = self._stac_search(bbox, start_date, end_date, cloud_limit, max_items)
                except Exception as exc2:
                    self._stac_endpoint = old_ep
                    raise DataProviderError(
                        f"[{self.name}] Both PC and Copernicus STAC endpoints failed. "
                        f"PC error: {exc}. CDSE error: {exc2}"
                    ) from exc2
            else:
                raise DataProviderError(f"[{self.name}] STAC search failed: {exc}") from exc

        scenes = [self._parse_stac_item(item) for item in stac_items]
        logger.info(
            "[%s] Found %d S2-L2A scenes (cloud≤%.0f%%) for %s→%s",
            self.name, len(scenes), cloud_limit, start_date, end_date,
        )
        return scenes

    def _sign_asset_url(self, url: str) -> str:
        """Sign a Planetary Computer asset URL for download (if applicable).

        PC signs its COG URLs via the token endpoint. This is optional; many
        assets are readable unsigned from public blobs.
        """
        if "blob.core.windows.net" not in url:
            return url
        try:
            # planetary-computer library provides signing
            import planetary_computer as pc  # type: ignore[import-untyped]
            return pc.sign(url)
        except ImportError:
            logger.debug(
                "[%s] planetary-computer library not installed; using unsigned URL.", self.name
            )
            return url
        except Exception as exc:
            logger.warning("[%s] URL signing failed (%s); using unsigned URL.", self.name, exc)
            return url

    def _download_cog(
        self,
        url: str,
        output_path: Path,
        chunk_size: int = 2 * 1024 * 1024,
        timeout: int = 300,
    ) -> Path:
        """Download a COG asset via streaming HTTP."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        signed_url = self._sign_asset_url(url)

        with self._session.get(signed_url, stream=True, timeout=timeout) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("Content-Length", 0))
            pbar = None
            if HAS_TQDM:
                pbar = tqdm(
                    total=total or None,
                    unit="B",
                    unit_scale=True,
                    desc=output_path.name,
                    leave=False,
                )
            try:
                with open(output_path, "wb") as fh:
                    for chunk in resp.iter_content(chunk_size=chunk_size):
                        if chunk:
                            fh.write(chunk)
                            if pbar:
                                pbar.update(len(chunk))
            finally:
                if pbar:
                    pbar.close()

        return output_path

    def download_scene(
        self,
        scene: SceneMetadata,
        output_dir: Path,
        bands: list[str] | None = None,
    ) -> dict[str, Path]:
        """Download COG assets for the given scene.

        Parameters
        ----------
        scene:
            Scene metadata with asset_urls.
        output_dir:
            Destination directory.
        bands:
            Subset of band IDs to download.  None → DEFAULT_BANDS.

        Returns
        -------
        dict[str, Path]
            band_id → local file path.
        """
        self._ensure_output_dir(output_dir)
        target_bands = bands if bands else DEFAULT_BANDS
        results: dict[str, Path] = {}

        for band_id in target_bands:
            url = scene.asset_urls.get(band_id)
            if not url:
                logger.warning(
                    "[%s] Band %s not found in scene %s asset_urls.",
                    self.name, band_id, scene.scene_id,
                )
                continue

            output_path = output_dir / f"{scene.scene_id}_{band_id}.tif"
            try:
                self._download_cog(url, output_path)
                results[band_id] = output_path
                logger.info("[%s] Downloaded %s → %s", self.name, band_id, output_path)
            except Exception as exc:
                raise DataDownloadError(
                    f"[{self.name}] Failed to download band {band_id} for {scene.scene_id}: {exc}"
                ) from exc

        return results

    def get_collection_info(self) -> dict:
        return {
            "name": self.name,
            "collection": COLLECTION,
            "product": "Sentinel-2 MSI Level-2A Surface Reflectance",
            "provider": "ESA / Microsoft Planetary Computer",
            "resolution_m": {"optical": 10, "shortwave": 20, "SCL": 20},
            "temporal_resolution": "5 days (single satellite), 2-3 days (combined)",
            "temporal_coverage": "2017-03-28 to present",
            "bands": BAND_INFO,
            "scale_factor": REFLECTANCE_SCALE,
            "auth_required": False,
            "data_access": "Microsoft Planetary Computer (public COG)",
            "fallback": "Copernicus Data Space Ecosystem STAC",
        }

    # ------------------------------------------------------------------
    # SCL masking
    # ------------------------------------------------------------------

    def apply_scl_mask(
        self,
        data_array: np.ndarray,
        scl: np.ndarray,
        mask_cloud: bool = True,
        mask_shadow: bool = True,
        mask_snow: bool = False,
    ) -> np.ndarray:
        """Mask pixels in *data_array* according to the SCL classification band.

        Parameters
        ----------
        data_array:
            2-D or 3-D float array (H, W) or (C, H, W) of surface reflectance.
        scl:
            2-D uint8 array (H, W) of SCL class values, same spatial extent as
            *data_array* (may need resampling from 20 m to 10 m).
        mask_cloud:
            Mask SCL classes 8 (medium probability) and 9 (high probability).
        mask_shadow:
            Mask SCL class 3 (cloud shadow).
        mask_snow:
            Mask SCL class 11 (snow / ice).

        Returns
        -------
        np.ndarray
            Copy of *data_array* with masked pixels set to np.nan.
        """
        result = data_array.astype(np.float32).copy()

        bad = np.zeros(scl.shape, dtype=bool)
        if mask_cloud:
            bad |= (scl == SCL_CLOUD_MEDIUM) | (scl == SCL_CLOUD_HIGH)
        if mask_shadow:
            bad |= scl == SCL_CLOUD_SHADOW
        if mask_snow:
            bad |= scl == SCL_SNOW_ICE

        n_masked = int(np.sum(bad))
        logger.debug(
            "[%s] SCL mask: %d / %d pixels masked (cloud=%s, shadow=%s, snow=%s).",
            self.name, n_masked, scl.size, mask_cloud, mask_shadow, mask_snow,
        )

        if result.ndim == 2:
            result[bad] = np.nan
        elif result.ndim == 3:
            result[:, bad] = np.nan
        else:
            raise ValueError(
                f"data_array must be 2-D or 3-D, got shape {result.shape}."
            )

        return result

    def compute_ndvi(self, nir: np.ndarray, red: np.ndarray) -> np.ndarray:
        """Compute NDVI from NIR (B08) and Red (B04) bands.

        Parameters
        ----------
        nir, red:
            2-D float arrays already scaled to surface reflectance [0, 1].

        Returns
        -------
        np.ndarray
            NDVI values in [-1, 1], nan where denominator is zero or either
            input is nan.
        """
        with np.errstate(divide="ignore", invalid="ignore"):
            ndvi = np.where(
                (nir + red) > 0,
                (nir - red) / (nir + red),
                np.nan,
            ).astype(np.float32)
        return ndvi

    def compute_evi(
        self,
        nir: np.ndarray,
        red: np.ndarray,
        blue: np.ndarray,
        G: float = 2.5,
        C1: float = 6.0,
        C2: float = 7.5,
        L: float = 1.0,
    ) -> np.ndarray:
        """Compute EVI2 (Enhanced Vegetation Index) from scaled reflectances.

        Returns
        -------
        np.ndarray
            EVI values, clamped to [-1, 1].
        """
        with np.errstate(divide="ignore", invalid="ignore"):
            denom = nir + C1 * red - C2 * blue + L
            evi = np.where(denom != 0, G * (nir - red) / denom, np.nan).astype(np.float32)
        return np.clip(evi, -1.0, 1.0)
