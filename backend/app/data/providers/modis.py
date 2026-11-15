"""
MODIS MOD13Q1 v061 vegetation index provider for GEOVISTA Intelligence.

Product: MOD13Q1 – MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid v061
CMR short_name: MOD13Q1  |  version: 061

Key specifications
------------------
- Temporal resolution : 16-day composites
- Spatial resolution  : 250 m
- Projection          : MODIS Sinusoidal (custom, based on EPSG:6974)
- Format              : HDF-EOS (HDF4) – requires GDAL built with HDF4 support

HDF subdatasets (official names, used as keys throughout)
---------------------------------------------------------
  '250m 16 days NDVI'
  '250m 16 days EVI'
  '250m 16 days pixel reliability'
  '250m 16 days VI Quality'
  '250m 16 days red reflectance'
  '250m 16 days NIR reflectance'
  '250m 16 days blue reflectance'
  '250m 16 days MIR reflectance'
  '250m 16 days view zenith angle'
  '250m 16 days sun zenith angle'
  '250m 16 days relative azimuth angle'
  '250m 16 days composite day of the year'

Scale factors
-------------
  NDVI / EVI                 : × 0.0001
  Reflectances (red/NIR/…)   : × 0.0001
  Angles (view/sun/azimuth)  : × 0.01

Fill values
-----------
  NDVI / EVI                 : -28672
  Reflectances               : -1000

Valid ranges
------------
  NDVI / EVI                 : [-2000, 10000]
  Reflectances               : [0, 10000]

Pixel Reliability QA legend
----------------------------
  -1 = Fill / No data
   0 = Good data  (use with confidence)
   1 = Marginal data (useful but look at detailed QA)
   2 = Snow/Ice
   3 = Cloudy

VI Quality bitfield
-------------------
  Bits 0-1 : MODLAND QA flag
    00 = VI produced, good quality
    01 = VI produced, check other QA
    10 = Pixel produced, most probably cloudy
    11 = Pixel not produced (other reasons)
  Bits 2-5 : VI usefulness (0=highest, 15=lowest)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import numpy as np

from app.data.providers.nasa_earthdata import NASAEarthdataProvider
from app.data.providers.base_provider import SceneMetadata

try:
    from app.core.exceptions import DataProviderError, PreprocessingError
except ImportError:
    class DataProviderError(Exception): pass  # type: ignore[no-redef]
    class PreprocessingError(Exception): pass  # type: ignore[no-redef]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODIS_SINUSOIDAL_WKT = (
    'PROJCS["MODIS Sinusoidal",'
    'GEOGCS["GCS_Sphere_MODIS_Web_Mercator",'
    'DATUM["Not_specified_based_on_Authalic_Sphere",'
    'SPHEROID["Sphere",6371007.181,0]],'
    'PRIMEM["Greenwich",0],'
    'UNIT["Degree",0.017453292519943295]],'
    'PROJECTION["Sinusoidal"],'
    'PARAMETER["central_meridian",0],'
    'PARAMETER["false_easting",0],'
    'PARAMETER["false_northing",0],'
    'UNIT["Meter",1]]'
)

SUBDATASET_NAMES: list[str] = [
    "250m 16 days NDVI",
    "250m 16 days EVI",
    "250m 16 days pixel reliability",
    "250m 16 days VI Quality",
    "250m 16 days red reflectance",
    "250m 16 days NIR reflectance",
    "250m 16 days blue reflectance",
    "250m 16 days MIR reflectance",
    "250m 16 days view zenith angle",
    "250m 16 days sun zenith angle",
    "250m 16 days relative azimuth angle",
    "250m 16 days composite day of the year",
]

SCALE_FACTORS: dict[str, float] = {
    "250m 16 days NDVI":                    0.0001,
    "250m 16 days EVI":                     0.0001,
    "250m 16 days red reflectance":         0.0001,
    "250m 16 days NIR reflectance":         0.0001,
    "250m 16 days blue reflectance":        0.0001,
    "250m 16 days MIR reflectance":         0.0001,
    "250m 16 days view zenith angle":       0.01,
    "250m 16 days sun zenith angle":        0.01,
    "250m 16 days relative azimuth angle":  0.01,
}

FILL_VALUES: dict[str, float] = {
    "250m 16 days NDVI":                    -28672,
    "250m 16 days EVI":                     -28672,
    "250m 16 days red reflectance":         -1000,
    "250m 16 days NIR reflectance":         -1000,
    "250m 16 days blue reflectance":        -1000,
    "250m 16 days MIR reflectance":         -1000,
}

VALID_RANGES: dict[str, tuple[float, float]] = {
    "250m 16 days NDVI":               (-2000, 10000),
    "250m 16 days EVI":                (-2000, 10000),
    "250m 16 days red reflectance":    (0, 10000),
    "250m 16 days NIR reflectance":    (0, 10000),
    "250m 16 days blue reflectance":   (0, 10000),
    "250m 16 days MIR reflectance":    (0, 10000),
}

# Pixel Reliability class codes
PR_GOOD      = 0
PR_MARGINAL  = 1
PR_SNOW_ICE  = 2
PR_CLOUDY    = 3
PR_FILL      = -1


class MODISMod13Q1Provider(NASAEarthdataProvider):
    """Provider for MODIS MOD13Q1 Vegetation Indices (16-Day, 250m, v061).

    Inherits CMR search and authenticated download from NASAEarthdataProvider.

    Notes
    -----
    HDF4 files require GDAL compiled with HDF4 support.  If that support is
    absent ``open_hdf_subdatasets`` will raise a clear ``DataProviderError``
    rather than an obscure GDAL error.

    Example
    -------
    >>> provider = MODISMod13Q1Provider()
    >>> provider.authenticate()
    >>> scenes = provider.search([72.0, 18.0, 73.0, 19.0], "2023-01-01", "2023-12-31")
    >>> paths = provider.download_scene(scenes[0], Path("/data/modis"))
    >>> arrays = provider.open_hdf_subdatasets(list(paths.values())[0])
    >>> ndvi = arrays["250m 16 days NDVI"]
    >>> qa   = arrays["250m 16 days pixel reliability"]
    >>> ndvi_clean = provider.apply_qa_mask(ndvi, qa, keep_marginal=True)
    """

    name = "MODIS_MOD13Q1"
    requires_auth = True

    COLLECTION_SHORT_NAME = "MOD13Q1"
    COLLECTION_VERSION = "061"
    RESOLUTION_M = 250.0
    DEFAULT_BANDS = SUBDATASET_NAMES

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search(
        self,
        bbox: list[float],
        start_date: str,
        end_date: str,
        **kwargs,
    ) -> list[SceneMetadata]:
        """Search CMR for MOD13Q1 granules covering *bbox* within the date range.

        Parameters
        ----------
        bbox:
            [minlon, minlat, maxlon, maxlat] EPSG:4326.
        start_date, end_date:
            ISO 8601 date strings, e.g. "2023-01-01".
        **kwargs:
            Additional CMR parameters (e.g. ``day_night_flag="DAY"``).

        Returns
        -------
        list[SceneMetadata]
            Matching MOD13Q1 granules.
        """
        self.validate_bbox(bbox)
        self.validate_dates(start_date, end_date)
        raw_granules = self._search_cmr(
            short_name=self.COLLECTION_SHORT_NAME,
            version=self.COLLECTION_VERSION,
            bbox=bbox,
            start_date=start_date,
            end_date=end_date,
            page_size=self.CMR_PAGE_SIZE,
        )
        scenes = [self._parse_cmr_granule(g) for g in raw_granules]
        logger.info(
            "[%s] Found %d MOD13Q1 granules for bbox=%s, %s→%s",
            self.name, len(scenes), bbox, start_date, end_date,
        )
        return scenes

    def get_collection_info(self) -> dict:
        return {
            "name": self.name,
            "short_name": self.COLLECTION_SHORT_NAME,
            "version": self.COLLECTION_VERSION,
            "product": "MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid",
            "resolution_m": self.RESOLUTION_M,
            "temporal_resolution": "16-day composite",
            "projection": "MODIS Sinusoidal (EPSG:6974 / custom)",
            "format": "HDF-EOS (HDF4)",
            "temporal_coverage": "2000-02-18 to present",
            "bands": SUBDATASET_NAMES,
            "scale_factors": SCALE_FACTORS,
            "fill_values": FILL_VALUES,
            "valid_ranges": VALID_RANGES,
            "notes": (
                "HDF4 files require GDAL with HDF4 support. "
                "Use open_hdf_subdatasets() to read individual layers."
            ),
        }

    # ------------------------------------------------------------------
    # HDF reading
    # ------------------------------------------------------------------

    def open_hdf_subdatasets(
        self,
        hdf_path: Path,
        apply_scale: bool = True,
        mask_fill: bool = True,
    ) -> dict[str, np.ndarray]:
        """Open all MODIS subdatasets from an HDF4 file.

        Parameters
        ----------
        hdf_path:
            Path to the downloaded .hdf file.
        apply_scale:
            If True, apply the official scale factor so values are in
            physical units (NDVI in [-0.2, 1.0], reflectances in [0, 1]).
        mask_fill:
            If True, replace fill values with np.nan (requires float cast).

        Returns
        -------
        dict[str, np.ndarray]
            Mapping of subdataset name → 2-D NumPy array.

        Raises
        ------
        DataProviderError
            If GDAL is unavailable or HDF4 support is not compiled in.
        FileNotFoundError
            If *hdf_path* does not exist.
        """
        if not hdf_path.exists():
            raise FileNotFoundError(f"HDF file not found: {hdf_path}")

        # Check GDAL availability and HDF4 support
        try:
            from osgeo import gdal
        except ImportError as exc:
            raise DataProviderError(
                "GDAL (osgeo) is not installed. Install it via conda: "
                "  conda install -c conda-forge gdal\n"
                "or use the GDAL wheel appropriate for your platform."
            ) from exc

        gdal.UseExceptions()

        ds = gdal.Open(str(hdf_path), gdal.GA_ReadOnly)
        if ds is None:
            raise DataProviderError(
                f"GDAL could not open {hdf_path}. "
                "Ensure GDAL is compiled with HDF4 support "
                "(check: gdalinfo --formats | grep -i hdf4)."
            )

        subdatasets = ds.GetSubDatasets()
        if not subdatasets:
            raise DataProviderError(
                f"No subdatasets found in {hdf_path}. "
                "The file may be corrupt or not a valid HDF-EOS file."
            )

        result: dict[str, np.ndarray] = {}

        for sd_path, sd_desc in subdatasets:
            # Match against known subdataset names
            matched_name: str | None = None
            for known in SUBDATASET_NAMES:
                if known in sd_desc:
                    matched_name = known
                    break

            if matched_name is None:
                # Still read it under the raw description key
                matched_name = sd_desc.strip()

            sub_ds = gdal.Open(sd_path, gdal.GA_ReadOnly)
            if sub_ds is None:
                logger.warning("[%s] Could not open subdataset: %s", self.name, sd_path)
                continue

            band = sub_ds.GetRasterBand(1)
            arr = band.ReadAsArray().astype(np.float32)

            fill = FILL_VALUES.get(matched_name)
            vrange = VALID_RANGES.get(matched_name)
            scale = SCALE_FACTORS.get(matched_name, 1.0)

            if mask_fill and fill is not None:
                arr = np.where(arr == fill, np.nan, arr)

            if vrange is not None:
                # Mask out-of-range raw values
                lo, hi = vrange
                arr = np.where((arr < lo) | (arr > hi), np.nan, arr)

            if apply_scale and scale != 1.0:
                arr = arr * scale

            result[matched_name] = arr
            sub_ds = None  # close GDAL dataset

        ds = None  # close main dataset
        logger.debug(
            "[%s] Opened %d subdatasets from %s", self.name, len(result), hdf_path.name
        )
        return result

    # ------------------------------------------------------------------
    # QA masking
    # ------------------------------------------------------------------

    def apply_qa_mask(
        self,
        ndvi: np.ndarray,
        pixel_reliability: np.ndarray,
        keep_marginal: bool = True,
    ) -> np.ndarray:
        """Mask NDVI (or EVI) array using the Pixel Reliability QA band.

        Parameters
        ----------
        ndvi:
            2-D float32 array of NDVI (or EVI) values, with fill already
            converted to np.nan by ``open_hdf_subdatasets``.
        pixel_reliability:
            2-D float32 array of Pixel Reliability values (0, 1, 2, 3, -1).
            Values are raw integers (not scaled).
        keep_marginal:
            If True, keep pixels with PR=1 (marginal); if False, mask them too.

        Returns
        -------
        np.ndarray
            Copy of *ndvi* with cloudy (PR=3), snow/ice (PR=2), fill (PR=-1),
            and optionally marginal (PR=1) pixels replaced by np.nan.
        """
        result = ndvi.copy().astype(np.float32)

        # Always mask fill and cloud
        bad_mask = (
            (pixel_reliability == PR_FILL) |
            (pixel_reliability == PR_SNOW_ICE) |
            (pixel_reliability == PR_CLOUDY)
        )

        if not keep_marginal:
            bad_mask = bad_mask | (pixel_reliability == PR_MARGINAL)

        result[bad_mask] = np.nan
        n_masked = int(np.sum(bad_mask))
        total = ndvi.size
        logger.debug(
            "[%s] QA mask removed %d / %d pixels (%.1f%%).",
            self.name, n_masked, total, 100 * n_masked / max(total, 1),
        )
        return result

    def parse_vi_quality(self, vi_quality: np.ndarray) -> dict[str, np.ndarray]:
        """Decode the VI Quality 16-bit bitfield array.

        Parameters
        ----------
        vi_quality:
            2-D integer array of VI Quality values (raw, unscaled).

        Returns
        -------
        dict[str, np.ndarray]
            Boolean masks per bit-field:
            - ``modland_qa``    : uint8 [0-3] MODLAND QA code
            - ``vi_usefulness`` : uint8 [0-15] VI usefulness index
            - ``good_quality``  : bool  mask where MODLAND QA == 0
            - ``check_other``   : bool  mask where MODLAND QA == 1
            - ``probably_cloud``: bool  mask where MODLAND QA == 2
            - ``not_produced``  : bool  mask where MODLAND QA == 3
        """
        vi_int = vi_quality.astype(np.uint16)

        modland_qa = (vi_int & 0b0000_0000_0000_0011).astype(np.uint8)
        vi_usefulness = ((vi_int & 0b0000_0000_0011_1100) >> 2).astype(np.uint8)

        return {
            "modland_qa": modland_qa,
            "vi_usefulness": vi_usefulness,
            "good_quality": modland_qa == 0,
            "check_other": modland_qa == 1,
            "probably_cloud": modland_qa == 2,
            "not_produced": modland_qa == 3,
        }

    # ------------------------------------------------------------------
    # CRS / projection utilities
    # ------------------------------------------------------------------

    def extract_sinusoidal_crs(self) -> str:
        """Return the WKT string for the MODIS Sinusoidal projection.

        Returns
        -------
        str
            WKT CRS string.  Can be passed to rasterio.crs.CRS.from_wkt()
            or osr.SpatialReference().ImportFromWkt().

        Notes
        -----
        MODIS uses a custom sinusoidal projection on the authalic sphere
        (R = 6 371 007.181 m).  It is sometimes assigned the authority
        EPSG:6974 but that code is not universally available; use this WKT
        for unambiguous CRS definition.
        """
        return MODIS_SINUSOIDAL_WKT

    def reproject_to_wgs84(
        self,
        arr: np.ndarray,
        hdf_path: Path,
        subdataset_name: str,
        dst_resolution_deg: float = 0.0025,
    ) -> tuple[np.ndarray, dict]:
        """Reproject a MODIS sinusoidal array to WGS-84 (EPSG:4326).

        Parameters
        ----------
        arr:
            Source array (from open_hdf_subdatasets), already scaled.
        hdf_path:
            Original HDF file path (needed to read geotransform).
        subdataset_name:
            Exact subdataset name as in SUBDATASET_NAMES.
        dst_resolution_deg:
            Output pixel size in degrees (~250 m ≈ 0.0025°).

        Returns
        -------
        tuple[np.ndarray, dict]
            Reprojected array and rasterio-style profile dict.
        """
        try:
            import rasterio
            from rasterio.crs import CRS
            from rasterio.warp import calculate_default_transform, reproject, Resampling
        except ImportError as exc:
            raise DataProviderError(
                "rasterio is required for reprojection. Install via: pip install rasterio"
            ) from exc

        try:
            from osgeo import gdal
        except ImportError as exc:
            raise DataProviderError("GDAL (osgeo) is required.") from exc

        gdal.UseExceptions()
        sub_path = None
        ds_main = gdal.Open(str(hdf_path), gdal.GA_ReadOnly)
        for sd_path, sd_desc in ds_main.GetSubDatasets():
            if subdataset_name in sd_desc:
                sub_path = sd_path
                break
        ds_main = None

        if sub_path is None:
            raise DataProviderError(
                f"Subdataset '{subdataset_name}' not found in {hdf_path}."
            )

        sub_ds = gdal.Open(sub_path, gdal.GA_ReadOnly)
        gt = sub_ds.GetGeoTransform()
        rows, cols = arr.shape
        sub_ds = None

        src_crs = CRS.from_wkt(MODIS_SINUSOIDAL_WKT)
        dst_crs = CRS.from_epsg(4326)

        # Build an in-memory rasterio dataset
        import io
        import rasterio.io
        with rasterio.io.MemoryFile() as memfile:
            with memfile.open(
                driver="GTiff",
                height=rows,
                width=cols,
                count=1,
                dtype=rasterio.float32,
                crs=src_crs,
                transform=rasterio.Affine(gt[1], gt[2], gt[0], gt[4], gt[5], gt[3]),
                nodata=np.nan,
            ) as src:
                src.write(arr, 1)

                transform_dst, width_dst, height_dst = calculate_default_transform(
                    src_crs, dst_crs, cols, rows, *src.bounds
                )
                dst_arr = np.full((height_dst, width_dst), np.nan, dtype=np.float32)
                reproject(
                    source=rasterio.band(src, 1),
                    destination=dst_arr,
                    src_transform=src.transform,
                    src_crs=src_crs,
                    dst_transform=transform_dst,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear,
                )
                profile = {
                    "driver": "GTiff",
                    "dtype": "float32",
                    "width": width_dst,
                    "height": height_dst,
                    "count": 1,
                    "crs": dst_crs,
                    "transform": transform_dst,
                    "nodata": np.nan,
                }

        return dst_arr, profile
