"""
Raster preprocessing module for GEOVISTA Intelligence.
Handles clipping, reprojection, resampling, index computation,
windowed reading, and patch extraction for large satellite rasters.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Generator, Optional

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.mask import mask as rio_mask
from rasterio.transform import from_bounds
from rasterio.warp import calculate_default_transform, reproject
from rasterio.windows import Window
from shapely.geometry import shape, mapping
from shapely.ops import transform as shapely_transform
import pyproj

logger = logging.getLogger(__name__)


class RasterPreprocessor:
    """Handles all raster-based preprocessing operations."""

    # ------------------------------------------------------------------
    # Clipping
    # ------------------------------------------------------------------

    def clip_to_aoi(
        self,
        input_path: Path,
        aoi_geojson: dict,
        output_path: Path,
        nodata: float | None = None,
        all_touched: bool = False,
    ) -> Path:
        """Clip raster to AOI geometry.

        Reprojects the AOI geometry to the raster's native CRS before clipping
        so the caller can supply coordinates in any CRS (defaults to EPSG:4326).
        Preserves nodata and all band metadata.

        Args:
            input_path: Path to the source raster.
            aoi_geojson: GeoJSON Feature or Geometry dict (assumed EPSG:4326
                         unless 'crs' key is present in a FeatureCollection wrapper).
            output_path: Destination path for the clipped raster.
            nodata: Override nodata value; if None uses the source file's nodata.
            all_touched: If True, include pixels that touch the geometry edge.

        Returns:
            output_path on success.
        """
        input_path = Path(input_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with rasterio.open(input_path) as src:
            raster_crs = src.crs
            src_nodata = nodata if nodata is not None else src.nodata

            # Extract geometry from Feature or Geometry dict
            if aoi_geojson.get("type") == "Feature":
                geom = shape(aoi_geojson["geometry"])
            else:
                geom = shape(aoi_geojson)

            # Reproject AOI from EPSG:4326 to raster CRS if needed
            if raster_crs and not raster_crs.to_epsg() == 4326:
                transformer = pyproj.Transformer.from_crs(
                    "EPSG:4326", raster_crs.to_string(), always_xy=True
                )
                geom = shapely_transform(transformer.transform, geom)

            geom_geojson = [mapping(geom)]

            out_image, out_transform = rio_mask(
                src,
                geom_geojson,
                crop=True,
                nodata=src_nodata,
                all_touched=all_touched,
                filled=True,
            )

            out_meta = src.meta.copy()
            out_meta.update(
                {
                    "driver": "GTiff",
                    "height": out_image.shape[1],
                    "width": out_image.shape[2],
                    "transform": out_transform,
                    "nodata": src_nodata,
                    "compress": "lzw",
                    "tiled": True,
                }
            )

            with rasterio.open(output_path, "w", **out_meta) as dst:
                dst.write(out_image)

        logger.info("Clipped %s -> %s", input_path.name, output_path.name)
        return output_path

    # ------------------------------------------------------------------
    # Reprojection
    # ------------------------------------------------------------------

    def reproject_raster(
        self,
        input_path: Path,
        target_crs: str,
        output_path: Path,
        resampling: Resampling = Resampling.bilinear,
        target_resolution: tuple[float, float] | None = None,
    ) -> Path:
        """Reproject raster to target CRS.

        **Important**: Never use bilinear for categorical data (e.g. land-cover,
        SCL). The caller is responsible for specifying Resampling.nearest for
        such bands.

        Args:
            input_path: Source raster path.
            target_crs: Target CRS string (e.g. "EPSG:4326", "EPSG:32632").
            output_path: Destination path.
            resampling: Resampling algorithm. Default bilinear (continuous data).
            target_resolution: Optional (x_res, y_res) in target CRS units.

        Returns:
            output_path on success.
        """
        input_path = Path(input_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        dst_crs = CRS.from_string(target_crs)

        with rasterio.open(input_path) as src:
            transform, width, height = calculate_default_transform(
                src.crs,
                dst_crs,
                src.width,
                src.height,
                *src.bounds,
                resolution=target_resolution,
            )

            kwargs = src.meta.copy()
            kwargs.update(
                {
                    "crs": dst_crs,
                    "transform": transform,
                    "width": width,
                    "height": height,
                    "driver": "GTiff",
                    "compress": "lzw",
                    "tiled": True,
                }
            )

            with rasterio.open(output_path, "w", **kwargs) as dst:
                for band_idx in range(1, src.count + 1):
                    reproject(
                        source=rasterio.band(src, band_idx),
                        destination=rasterio.band(dst, band_idx),
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=transform,
                        dst_crs=dst_crs,
                        resampling=resampling,
                    )

        logger.info(
            "Reprojected %s -> %s (CRS=%s, method=%s)",
            input_path.name,
            output_path.name,
            target_crs,
            resampling.name,
        )
        return output_path

    # ------------------------------------------------------------------
    # Resampling to reference
    # ------------------------------------------------------------------

    def resample_to_reference(
        self,
        input_path: Path,
        reference_path: Path,
        output_path: Path,
        resampling: Resampling = Resampling.bilinear,
    ) -> Path:
        """Resample input raster to exactly match a reference grid.

        The output will share the same CRS, transform, width and height as the
        reference raster.

        Args:
            input_path: Source raster path.
            reference_path: Reference raster whose grid is used as the target.
            output_path: Destination path.
            resampling: Resampling algorithm.

        Returns:
            output_path on success.
        """
        input_path = Path(input_path)
        reference_path = Path(reference_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with rasterio.open(reference_path) as ref:
            dst_crs = ref.crs
            dst_transform = ref.transform
            dst_width = ref.width
            dst_height = ref.height

        with rasterio.open(input_path) as src:
            kwargs = src.meta.copy()
            kwargs.update(
                {
                    "crs": dst_crs,
                    "transform": dst_transform,
                    "width": dst_width,
                    "height": dst_height,
                    "driver": "GTiff",
                    "compress": "lzw",
                    "tiled": True,
                }
            )

            with rasterio.open(output_path, "w", **kwargs) as dst:
                for band_idx in range(1, src.count + 1):
                    dest_band = np.empty((dst_height, dst_width), dtype=kwargs.get("dtype", src.dtypes[0]))
                    reproject(
                        source=rasterio.band(src, band_idx),
                        destination=dest_band,
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=dst_transform,
                        dst_crs=dst_crs,
                        resampling=resampling,
                    )
                    dst.write(dest_band, band_idx)

        logger.info(
            "Resampled %s to reference grid of %s -> %s",
            input_path.name,
            reference_path.name,
            output_path.name,
        )
        return output_path

    # ------------------------------------------------------------------
    # Array-level operations
    # ------------------------------------------------------------------

    def apply_nodata_mask(
        self,
        arr: np.ndarray,
        nodata_value: float,
        replacement: float = np.nan,
    ) -> np.ndarray:
        """Replace nodata values with NaN or a specified replacement.

        Handles integer arrays by converting to float64 when replacement is NaN.
        """
        result = arr.astype(np.float64)
        if np.isnan(nodata_value):
            mask = np.isnan(arr)
        else:
            mask = arr == nodata_value
        result[mask] = replacement
        return result

    def apply_valid_range_mask(
        self,
        arr: np.ndarray,
        valid_min: float,
        valid_max: float,
    ) -> np.ndarray:
        """Set out-of-range values to NaN.

        Converts to float64 to allow NaN representation.
        """
        result = arr.astype(np.float64)
        result[(result < valid_min) | (result > valid_max)] = np.nan
        return result

    def apply_scale_offset(
        self,
        arr: np.ndarray,
        scale: float,
        offset: float = 0.0,
        fill_value: float | None = None,
    ) -> np.ndarray:
        """Apply multiplicative scale + additive offset.

        Physical value = arr * scale + offset.

        Args:
            arr: Input array (integer or float).
            scale: Multiplicative scale factor.
            offset: Additive offset (applied after scale).
            fill_value: Nodata value to mask before applying scale/offset.

        Returns:
            Float64 array in physical units.
        """
        result = arr.astype(np.float64)
        if fill_value is not None:
            nodata_mask = result == fill_value
            result[nodata_mask] = np.nan
        result = result * scale + offset
        return result

    # ------------------------------------------------------------------
    # Windowed reading
    # ------------------------------------------------------------------

    def create_windowed_reader(
        self,
        input_path: Path,
        window_size: tuple[int, int] = (512, 512),
        overlap: int = 64,
    ) -> Generator[tuple[np.ndarray, Window, rasterio.transform.Affine], None, None]:
        """Generator yielding (window_data, window, transform) for large rasters.

        Tiles the raster into overlapping windows so it can be processed
        without loading the full scene into memory.

        Args:
            input_path: Source raster path.
            window_size: (height, width) of each tile in pixels.
            overlap: Overlap in pixels between adjacent tiles.

        Yields:
            (data_array [bands, H, W], Window, tile_transform)
        """
        input_path = Path(input_path)
        tile_h, tile_w = window_size
        step_h = tile_h - overlap
        step_w = tile_w - overlap

        with rasterio.open(input_path) as src:
            full_h = src.height
            full_w = src.width

            row_off = 0
            while row_off < full_h:
                col_off = 0
                while col_off < full_w:
                    actual_h = min(tile_h, full_h - row_off)
                    actual_w = min(tile_w, full_w - col_off)
                    win = Window(col_off, row_off, actual_w, actual_h)
                    win_transform = rasterio.windows.transform(win, src.transform)
                    data = src.read(window=win)
                    yield data, win, win_transform
                    col_off += step_w
                row_off += step_h

    # ------------------------------------------------------------------
    # Patch extraction for ML
    # ------------------------------------------------------------------

    def extract_patches(
        self,
        arr: np.ndarray,
        patch_size: int,
        stride: int,
        min_valid_fraction: float = 0.7,
    ) -> list[np.ndarray]:
        """Extract valid patches for ML training.

        Skips patches with too many NaN/masked pixels.

        Args:
            arr: Array of shape [C, H, W] or [H, W].
            patch_size: Side length of each square patch (pixels).
            stride: Step size between patch start positions.
            min_valid_fraction: Minimum fraction of non-NaN pixels required.

        Returns:
            List of patch arrays, each shape [C, patch_size, patch_size] or
            [patch_size, patch_size] depending on input ndim.
        """
        if arr.ndim == 2:
            arr = arr[np.newaxis, ...]  # treat as single band

        _, h, w = arr.shape
        patches: list[np.ndarray] = []

        for row in range(0, h - patch_size + 1, stride):
            for col in range(0, w - patch_size + 1, stride):
                patch = arr[:, row : row + patch_size, col : col + patch_size]
                valid_pixels = np.sum(~np.isnan(patch))
                total_pixels = patch.size
                if valid_pixels / total_pixels >= min_valid_fraction:
                    patches.append(patch)

        logger.debug("Extracted %d valid patches (size=%d, stride=%d)", len(patches), patch_size, stride)
        return patches

    # ------------------------------------------------------------------
    # Spectral indices
    # ------------------------------------------------------------------

    def compute_ndvi(self, red: np.ndarray, nir: np.ndarray) -> np.ndarray:
        """NDVI = (NIR - Red) / (NIR + Red).

        Returns values in [-1, 1]. Division by zero (sum == 0) produces NaN.
        """
        red = red.astype(np.float64)
        nir = nir.astype(np.float64)
        denominator = nir + red
        with np.errstate(invalid="ignore", divide="ignore"):
            ndvi = np.where(denominator == 0, np.nan, (nir - red) / denominator)
        return ndvi

    def compute_evi(
        self, red: np.ndarray, nir: np.ndarray, blue: np.ndarray
    ) -> np.ndarray:
        """EVI = 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1).

        Returns NaN where denominator is zero or inputs contain NaN.
        """
        red = red.astype(np.float64)
        nir = nir.astype(np.float64)
        blue = blue.astype(np.float64)
        denominator = nir + 6.0 * red - 7.5 * blue + 1.0
        with np.errstate(invalid="ignore", divide="ignore"):
            evi = np.where(denominator == 0, np.nan, 2.5 * (nir - red) / denominator)
        return evi

    def compute_mndwi(self, green: np.ndarray, swir1: np.ndarray) -> np.ndarray:
        """MNDWI = (Green - SWIR1) / (Green + SWIR1). Water detection index.

        High values indicate open water.
        """
        green = green.astype(np.float64)
        swir1 = swir1.astype(np.float64)
        denominator = green + swir1
        with np.errstate(invalid="ignore", divide="ignore"):
            mndwi = np.where(denominator == 0, np.nan, (green - swir1) / denominator)
        return mndwi

    def compute_nbr(self, nir: np.ndarray, swir2: np.ndarray) -> np.ndarray:
        """NBR = (NIR - SWIR2) / (NIR + SWIR2). Normalized Burn Ratio.

        Useful for burn severity mapping. Low values indicate burned areas.
        """
        nir = nir.astype(np.float64)
        swir2 = swir2.astype(np.float64)
        denominator = nir + swir2
        with np.errstate(invalid="ignore", divide="ignore"):
            nbr = np.where(denominator == 0, np.nan, (nir - swir2) / denominator)
        return nbr

    def compute_bsi(
        self,
        red: np.ndarray,
        swir1: np.ndarray,
        nir: np.ndarray,
        blue: np.ndarray,
    ) -> np.ndarray:
        """BSI = ((SWIR1+Red)-(NIR+Blue)) / ((SWIR1+Red)+(NIR+Blue)). Bare Soil Index.

        High values indicate bare soil / low vegetation.
        """
        red = red.astype(np.float64)
        swir1 = swir1.astype(np.float64)
        nir = nir.astype(np.float64)
        blue = blue.astype(np.float64)

        numerator = (swir1 + red) - (nir + blue)
        denominator = (swir1 + red) + (nir + blue)
        with np.errstate(invalid="ignore", divide="ignore"):
            bsi = np.where(denominator == 0, np.nan, numerator / denominator)
        return bsi
