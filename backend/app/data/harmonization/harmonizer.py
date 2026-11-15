"""
Multi-source data harmonization for GEOVISTA Intelligence.

Harmonizes satellite data from different sensors (Sentinel-2, Landsat, MODIS,
Sentinel-1 SAR) to a common reference grid with consistent CRS, resolution,
units, and NaN-based masking.

Key principles:
  - Each sensor's physical characteristics are documented, not hidden.
  - Resolution differences are explicitly noted.
  - Reprojection and resampling methods are always logged.
  - NaN is used consistently for masked/invalid data.
  - Units are always preserved in metadata.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_bounds, Affine
from rasterio.warp import calculate_default_transform, reproject

from app.data.preprocessing.cloud_masking import CloudMasker
from app.data.preprocessing.raster_preprocessor import RasterPreprocessor
from app.data.preprocessing.sar_preprocessor import SARPreprocessor

logger = logging.getLogger(__name__)


@dataclass
class HarmonizedDataset:
    """Harmonized multi-source dataset with consistent CRS, resolution, and grid.

    All band arrays are stored in physical units (reflectance, sigma0 dB, etc.)
    with NaN for masked/invalid pixels.
    """

    source_id: str
    collection: str
    acquired_at: str
    crs: str
    transform: Affine
    shape: tuple[int, int]            # (rows, cols)
    bands: dict[str, np.ndarray]      # band_name -> 2D array (physical units)
    qa_masks: dict[str, np.ndarray]   # mask_name -> 2D boolean (True = valid)
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Sensor definitions (scale factors, nodata, band names)
# ---------------------------------------------------------------------------

_COLLECTION_CONFIGS: dict[str, dict] = {
    "sentinel-2-l2a": {
        "scale": 1e-4,          # DN → reflectance (0.0001 per DN)
        "offset": 0.0,
        "nodata": 0,
        "bands": ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B11", "B12"],
        "qa_band": "SCL",
        "native_resolution_m": 10,
    },
    "landsat-c2-l2": {
        "scale": 2.75e-5,       # C2 L2 surface reflectance scale
        "offset": -0.2,
        "nodata": 0,
        "bands": ["B1", "B2", "B3", "B4", "B5", "B6", "B7"],
        "qa_band": "QA_PIXEL",
        "native_resolution_m": 30,
    },
    "mod13q1": {
        "scale": 1e-4,          # MOD13Q1 NDVI/EVI are already indices; reflectance bands 0.0001
        "offset": 0.0,
        "nodata": -28672,
        "bands": ["red", "nir", "blue", "mir"],
        "qa_band": "pixel_reliability",
        "native_resolution_m": 250,
    },
    "hls": {
        "scale": 1e-4,
        "offset": -0.0,
        "nodata": -9999,
        "bands": ["B02", "B03", "B04", "B05", "B06", "B07"],
        "qa_band": "Fmask",
        "native_resolution_m": 30,
    },
    "sentinel-1-grd": {
        "scale": 1.0,           # Already calibrated sigma0 (linear or dB depending on product)
        "offset": 0.0,
        "nodata": None,
        "bands": ["VV", "VH"],
        "qa_band": None,
        "native_resolution_m": 10,
    },
}


class DataHarmonizer:
    """Harmonizes data from different satellite sources to a common grid.

    Resolution and CRS differences are always logged.  NaN is used for all
    masked/invalid data.  Categorical layers (SCL, QA) are always resampled
    with nearest-neighbour.
    """

    def __init__(self) -> None:
        self._raster = RasterPreprocessor()
        self._cloud = CloudMasker()
        self._sar = SARPreprocessor()

    # ------------------------------------------------------------------
    # Reference grid definition
    # ------------------------------------------------------------------

    def define_reference_grid(
        self,
        bbox: list[float],
        target_crs: str = "EPSG:4326",
        target_resolution_deg: float | None = None,
        target_resolution_m: float | None = None,
    ) -> dict:
        """Define a common reference grid for an AOI.

        Exactly one of ``target_resolution_deg`` or ``target_resolution_m``
        must be provided.

        Args:
            bbox: [west, south, east, north] in target_crs units.
            target_crs: Output CRS (default EPSG:4326).
            target_resolution_deg: Pixel size in degrees (geographic CRS).
            target_resolution_m: Pixel size in metres (projected CRS).

        Returns:
            Dict with keys: crs, transform, width, height, bbox, resolution.
        """
        if target_resolution_deg is None and target_resolution_m is None:
            raise ValueError("Provide either target_resolution_deg or target_resolution_m.")
        if target_resolution_deg is not None and target_resolution_m is not None:
            raise ValueError("Provide only one of target_resolution_deg or target_resolution_m.")

        west, south, east, north = bbox

        if target_resolution_deg is not None:
            res = target_resolution_deg
        else:
            # Convert metres to approximate degrees using mid-latitude
            import math
            mid_lat = (south + north) / 2.0
            # 1 degree latitude ≈ 111_320 m; longitude varies by cos(lat)
            res_lat = target_resolution_m / 111_320.0
            res_lon = target_resolution_m / (111_320.0 * max(math.cos(math.radians(mid_lat)), 1e-6))
            res = (res_lat + res_lon) / 2.0  # isotropic approximation

        width = max(1, int(round((east - west) / res)))
        height = max(1, int(round((north - south) / res)))
        transform = from_bounds(west, south, east, north, width, height)

        logger.info(
            "Reference grid: CRS=%s, shape=(%d, %d), res=%.6f",
            target_crs, height, width, res,
        )
        return {
            "crs": target_crs,
            "transform": transform,
            "width": width,
            "height": height,
            "bbox": bbox,
            "resolution": res,
        }

    # ------------------------------------------------------------------
    # Optical harmonization
    # ------------------------------------------------------------------

    def harmonize_optical(
        self,
        source_path: Path,
        collection: str,
        reference_grid: dict,
        apply_cloud_mask: bool = True,
        qa_path: Path | None = None,
    ) -> HarmonizedDataset:
        """Harmonize an optical scene to the reference grid.

        Steps:
          1. Read all bands from source file.
          2. Apply scale + offset to convert DN → reflectance.
          3. Mask nodata.
          4. Apply cloud/QA mask (if qa_path provided or embedded).
          5. Reproject + resample to reference grid (bilinear for continuous,
             nearest for QA/SCL bands).

        Args:
            source_path: Path to multi-band GeoTIFF or NetCDF scene.
            collection: Sensor collection key (see _COLLECTION_CONFIGS).
            reference_grid: Dict from define_reference_grid().
            apply_cloud_mask: Whether to apply the sensor's default cloud mask.
            qa_path: Optional separate QA raster.  If None, QA is read from
                     the last band of source_path where applicable.

        Returns:
            HarmonizedDataset with reflectance bands in [0, 1] range.
        """
        source_path = Path(source_path)
        cfg = _COLLECTION_CONFIGS.get(collection)
        if cfg is None:
            raise ValueError(f"Unknown collection: {collection!r}. Known: {list(_COLLECTION_CONFIGS)}")

        ref_crs = CRS.from_string(reference_grid["crs"])
        ref_transform = reference_grid["transform"]
        ref_width = reference_grid["width"]
        ref_height = reference_grid["height"]

        bands_out: dict[str, np.ndarray] = {}
        qa_masks_out: dict[str, np.ndarray] = {}
        metadata: dict = {
            "collection": collection,
            "source_path": str(source_path),
            "scale": cfg["scale"],
            "offset": cfg["offset"],
            "native_resolution_m": cfg["native_resolution_m"],
        }

        with rasterio.open(source_path) as src:
            src_crs = src.crs
            source_id = source_path.stem

            if src_crs != ref_crs:
                logger.info(
                    "Reprojecting %s from %s to %s", source_path.name, src_crs, ref_crs
                )

            # Read all bands
            raw_data = src.read().astype(np.float64)  # shape [B, H, W]
            nodata = cfg["nodata"]

            # Apply nodata mask
            if nodata is not None:
                raw_data[raw_data == nodata] = np.nan

            # Apply scale + offset
            raw_data = raw_data * cfg["scale"] + cfg["offset"]

            # Clip to valid reflectance range
            if collection in ("sentinel-2-l2a", "landsat-c2-l2", "mod13q1", "hls"):
                raw_data = np.clip(raw_data, -0.2, 1.5)

            # Read QA band
            qa_array: np.ndarray | None = None
            if apply_cloud_mask:
                qa_src_path = qa_path if qa_path is not None else source_path
                try:
                    with rasterio.open(qa_src_path) as qa_src:
                        qa_array = qa_src.read(1)  # single-band QA
                except Exception as exc:
                    logger.warning("Could not read QA band: %s", exc)

            # Reproject each band to reference grid
            for band_idx, band_name in enumerate(cfg["bands"][: raw_data.shape[0]]):
                src_band = raw_data[band_idx]

                if src_crs != ref_crs or src.transform != ref_transform:
                    dest = np.full((ref_height, ref_width), np.nan, dtype=np.float64)
                    reproject(
                        source=src_band,
                        destination=dest,
                        src_transform=src.transform,
                        src_crs=src_crs,
                        dst_transform=ref_transform,
                        dst_crs=ref_crs,
                        resampling=Resampling.bilinear,
                        src_nodata=np.nan,
                        dst_nodata=np.nan,
                    )
                    bands_out[band_name] = dest
                else:
                    bands_out[band_name] = src_band

            # Cloud mask
            if apply_cloud_mask and qa_array is not None:
                qa_reprojected = np.zeros((ref_height, ref_width), dtype=qa_array.dtype)
                reproject(
                    source=qa_array,
                    destination=qa_reprojected,
                    src_transform=src.transform,
                    src_crs=src_crs,
                    dst_transform=ref_transform,
                    dst_crs=ref_crs,
                    resampling=Resampling.nearest,
                )

                # Build combined cloud mask (True = valid)
                if collection == "sentinel-2-l2a":
                    # Apply mask to first band to determine valid pixels
                    _dummy = np.zeros((ref_height, ref_width), dtype=np.float64)
                    masked = self._cloud.mask_sentinel2_scl(_dummy, qa_reprojected)
                    valid_mask = ~np.isnan(masked)
                elif collection == "landsat-c2-l2":
                    _dummy = np.zeros((ref_height, ref_width), dtype=np.float64)
                    masked = self._cloud.mask_landsat_qa(_dummy, qa_reprojected)
                    valid_mask = ~np.isnan(masked)
                elif collection == "mod13q1":
                    _dummy = np.zeros((ref_height, ref_width), dtype=np.float64)
                    masked = self._cloud.mask_modis_pixel_reliability(_dummy, qa_reprojected)
                    valid_mask = ~np.isnan(masked)
                elif collection == "hls":
                    _dummy = np.zeros((ref_height, ref_width), dtype=np.float64)
                    masked = self._cloud.mask_hls_fmask(_dummy, qa_reprojected)
                    valid_mask = ~np.isnan(masked)
                else:
                    valid_mask = np.ones((ref_height, ref_width), dtype=bool)

                # Apply valid_mask: set all bands to NaN where invalid
                for band_name in list(bands_out.keys()):
                    bands_out[band_name][~valid_mask] = np.nan

                qa_masks_out["cloud_valid"] = valid_mask

        acquired_at = metadata.get("acquired_at", "unknown")

        return HarmonizedDataset(
            source_id=source_id,
            collection=collection,
            acquired_at=acquired_at,
            crs=reference_grid["crs"],
            transform=ref_transform,
            shape=(ref_height, ref_width),
            bands=bands_out,
            qa_masks=qa_masks_out,
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # SAR harmonization
    # ------------------------------------------------------------------

    def harmonize_sar(
        self,
        source_path: Path,
        collection: str,
        reference_grid: dict,
        apply_speckle_filter: bool = False,
    ) -> HarmonizedDataset:
        """Harmonize a SAR GRD scene to the reference grid.

        **Note**: Input is assumed to be calibrated sigma0 (linear scale).
        This method does NOT apply thermal noise removal, radiometric
        calibration, or terrain correction — those must be done upstream
        (e.g., with ESA SNAP).

        Steps:
          1. Read bands and apply nodata masking.
          2. Convert linear sigma0 -> dB.
          3. Optionally apply Lee speckle filter.
          4. Reproject + resample to reference grid (bilinear).

        Args:
            source_path: Path to calibrated GRD GeoTIFF.
            collection: SAR collection key (e.g. 'sentinel-1-grd').
            reference_grid: Dict from define_reference_grid().
            apply_speckle_filter: Apply Lee filter before reprojection.

        Returns:
            HarmonizedDataset with sigma0 bands in dB.
        """
        source_path = Path(source_path)
        cfg = _COLLECTION_CONFIGS.get(collection, _COLLECTION_CONFIGS["sentinel-1-grd"])

        ref_crs = CRS.from_string(reference_grid["crs"])
        ref_transform = reference_grid["transform"]
        ref_width = reference_grid["width"]
        ref_height = reference_grid["height"]

        bands_out: dict[str, np.ndarray] = {}
        metadata: dict = {
            "collection": collection,
            "source_path": str(source_path),
            "native_resolution_m": cfg["native_resolution_m"],
            "note": "Input assumed to be terrain-corrected calibrated sigma0.",
        }

        with rasterio.open(source_path) as src:
            src_crs = src.crs
            source_id = source_path.stem
            raw_data = src.read().astype(np.float64)  # [B, H, W]
            band_names = cfg["bands"][: raw_data.shape[0]]

            for band_idx, band_name in enumerate(band_names):
                band = raw_data[band_idx]

                # Mask invalid (zero / negative) pixels
                band[band <= 0] = np.nan

                # Convert to dB
                band_db = self._sar.linear_to_db(band)

                # Mask low-dB nodata
                band_db = self._sar.apply_nodata_mask_sar(band_db)

                # Speckle filter (on linear scale before dB, then convert back)
                if apply_speckle_filter:
                    band_lin = self._sar.db_to_linear(band_db)
                    band_lin_filtered = self._sar.apply_lee_filter(band_lin)
                    band_db = self._sar.linear_to_db(band_lin_filtered)

                # Reproject to reference grid
                if src_crs != ref_crs or src.transform != ref_transform:
                    dest = np.full((ref_height, ref_width), np.nan, dtype=np.float64)
                    reproject(
                        source=band_db,
                        destination=dest,
                        src_transform=src.transform,
                        src_crs=src_crs,
                        dst_transform=ref_transform,
                        dst_crs=ref_crs,
                        resampling=Resampling.bilinear,
                        src_nodata=np.nan,
                        dst_nodata=np.nan,
                    )
                    bands_out[band_name] = dest
                else:
                    bands_out[band_name] = band_db

        return HarmonizedDataset(
            source_id=source_id,
            collection=collection,
            acquired_at="unknown",
            crs=reference_grid["crs"],
            transform=ref_transform,
            shape=(ref_height, ref_width),
            bands=bands_out,
            qa_masks={},
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # Temporal stacking
    # ------------------------------------------------------------------

    def stack_temporal(
        self,
        datasets: list[HarmonizedDataset],
        band: str,
        fill_gaps: bool = False,
        gap_fill_method: str = "linear",
    ) -> tuple[np.ndarray, list[str]]:
        """Stack multiple harmonized datasets into a time series.

        **IMPORTANT**: NaN is preserved for masked observations. Gap filling
        is only applied when ``fill_gaps=True`` is explicitly requested.
        Silent gap-filling would corrupt time-series analysis and model training.

        Args:
            datasets: List of harmonized datasets ordered by acquisition time.
            band: Band name to stack across all datasets.
            fill_gaps: If True, fill NaN gaps using gap_fill_method.
            gap_fill_method: 'linear', 'nearest', or 'none'.

        Returns:
            (stack [T, H, W], timestamps)
        """
        if not datasets:
            raise ValueError("datasets list is empty.")

        timestamps: list[str] = []
        arrays: list[np.ndarray] = []

        for ds in datasets:
            if band not in ds.bands:
                raise KeyError(f"Band '{band}' not found in dataset '{ds.source_id}'.")
            arrays.append(ds.bands[band])
            timestamps.append(ds.acquired_at)

        stack = np.stack(arrays, axis=0)  # [T, H, W]

        if fill_gaps:
            stack = self._fill_temporal_gaps(stack, method=gap_fill_method)
            logger.info("Gap filled temporal stack (method=%s)", gap_fill_method)
        else:
            nan_frac = np.isnan(stack).mean()
            if nan_frac > 0:
                logger.info(
                    "Temporal stack has %.1f%% NaN pixels (gap filling not requested).",
                    nan_frac * 100,
                )

        return stack, timestamps

    def _fill_temporal_gaps(self, stack: np.ndarray, method: str) -> np.ndarray:
        """Fill NaN along temporal axis using the specified interpolation method."""
        T, H, W = stack.shape
        filled = stack.copy()

        if method == "none":
            return filled

        t_indices = np.arange(T)

        for r in range(H):
            for c in range(W):
                pixel = filled[:, r, c]
                nan_mask = np.isnan(pixel)
                if nan_mask.all() or not nan_mask.any():
                    continue
                valid_t = t_indices[~nan_mask]
                valid_v = pixel[~nan_mask]
                if method == "linear":
                    filled[:, r, c] = np.interp(t_indices, valid_t, valid_v)
                elif method == "nearest":
                    # For each NaN, take value from nearest valid time step
                    for t in t_indices[nan_mask]:
                        nearest_idx = int(np.abs(valid_t - t).argmin())
                        filled[t, r, c] = valid_v[nearest_idx]

        return filled

    # ------------------------------------------------------------------
    # Compatibility checks
    # ------------------------------------------------------------------

    def check_grid_compatibility(
        self, ds1: HarmonizedDataset, ds2: HarmonizedDataset
    ) -> dict:
        """Check if two datasets share compatible grids.

        Returns a compatibility report with:
            - same_crs (bool)
            - same_shape (bool)
            - same_transform (bool)
            - compatible (bool) — True iff all three match
            - resolution_ratio (float) — ratio of spatial resolutions
        """
        same_crs = ds1.crs == ds2.crs
        same_shape = ds1.shape == ds2.shape
        same_transform = np.allclose(
            list(ds1.transform)[:6], list(ds2.transform)[:6], atol=1e-8
        )

        res1 = abs(ds1.transform.a)  # pixel width in CRS units
        res2 = abs(ds2.transform.a)
        ratio = res1 / res2 if res2 != 0 else float("inf")

        return {
            "same_crs": same_crs,
            "same_shape": same_shape,
            "same_transform": same_transform,
            "compatible": same_crs and same_shape and same_transform,
            "resolution_ratio": ratio,
        }

    def compute_resolution_mismatch_warning(
        self, ds1_res_m: float, ds2_res_m: float
    ) -> str | None:
        """Warn if resolution difference would cause misleading analysis.

        Returns a warning string if the ratio exceeds 3×, else None.
        """
        if ds1_res_m <= 0 or ds2_res_m <= 0:
            return "Cannot compute resolution ratio: non-positive resolution value."

        ratio = max(ds1_res_m, ds2_res_m) / min(ds1_res_m, ds2_res_m)

        if ratio >= 10:
            return (
                f"CRITICAL resolution mismatch: ratio={ratio:.1f}× "
                f"({ds1_res_m}m vs {ds2_res_m}m). "
                "Resampling introduces severe artifacts. Consider a coarser reference grid."
            )
        if ratio >= 3:
            return (
                f"Resolution mismatch: ratio={ratio:.1f}× "
                f"({ds1_res_m}m vs {ds2_res_m}m). "
                "Resampling may reduce spatial accuracy; use results with caution."
            )
        return None
