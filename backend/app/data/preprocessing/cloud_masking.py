"""
Cloud and shadow masking module for GEOVISTA Intelligence.

Supports:
  - Sentinel-2 Scene Classification Layer (SCL)
  - Landsat Collection 2 QA_PIXEL bitmask
  - MODIS MOD13Q1 pixel reliability
  - HLS Fmask
"""

from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)


class CloudMasker:
    """Unified cloud masking for multiple satellite sensors.

    All masking methods return arrays where masked pixels are set to NaN.
    Input ``data`` arrays may be 2D (H, W) or 3D (C, H, W).  The mask is
    always derived from the accompanying QA/classification band and applied
    consistently across all channels.
    """

    # ------------------------------------------------------------------
    # Sentinel-2 SCL masking
    # ------------------------------------------------------------------

    # Default SCL classes to mask:
    #   2  = Dark area pixels
    #   3  = Cloud shadows
    #   8  = Cloud medium probability
    #   9  = Cloud high probability
    #   10 = Thin cirrus
    #   11 = Snow / Ice
    _S2_DEFAULT_MASK_CLASSES = [2, 3, 8, 9, 10, 11]

    def mask_sentinel2_scl(
        self,
        data: np.ndarray,
        scl: np.ndarray,
        mask_classes: list[int] | None = None,
    ) -> np.ndarray:
        """Mask pixels using the Sentinel-2 Scene Classification Layer (SCL).

        Args:
            data: Image array, shape (H, W) or (C, H, W).  Any numeric dtype.
            scl:  SCL band array, shape (H, W).  Integer class values.
            mask_classes: SCL class values to mask.  Defaults to
                [2, 3, 8, 9, 10, 11] (dark area, shadow, cloud med/high,
                cirrus, snow).

        Returns:
            Float64 copy of ``data`` with masked pixels set to NaN.
        """
        if mask_classes is None:
            mask_classes = self._S2_DEFAULT_MASK_CLASSES

        result = data.astype(np.float64)
        bad_mask = np.isin(scl, mask_classes)  # (H, W) boolean

        if result.ndim == 3:
            result[:, bad_mask] = np.nan
        else:
            result[bad_mask] = np.nan

        masked_frac = bad_mask.mean()
        logger.debug(
            "S2 SCL masking: %.1f%% of pixels masked (classes=%s)",
            masked_frac * 100,
            mask_classes,
        )
        return result

    # ------------------------------------------------------------------
    # Landsat Collection 2 QA_PIXEL masking
    # ------------------------------------------------------------------

    # QA_PIXEL bit positions (Collection 2)
    _L8_BIT_DILATED_CLOUD = 1
    _L8_BIT_CLOUD = 3
    _L8_BIT_CLOUD_SHADOW = 4
    _L8_BIT_SNOW = 5

    def mask_landsat_qa(
        self,
        data: np.ndarray,
        qa_pixel: np.ndarray,
        mask_cloud: bool = True,
        mask_shadow: bool = True,
        mask_snow: bool = False,
    ) -> np.ndarray:
        """Mask using Landsat Collection 2 QA_PIXEL band.

        Bit positions (0-indexed):
            bit 1 = Dilated cloud
            bit 3 = Cloud
            bit 4 = Cloud shadow
            bit 5 = Snow

        Args:
            data: Image array, shape (H, W) or (C, H, W).
            qa_pixel: QA_PIXEL band as uint16 array, shape (H, W).
            mask_cloud: Mask cloud (bit 3) and dilated cloud (bit 1) pixels.
            mask_shadow: Mask cloud shadow pixels (bit 4).
            mask_snow: Mask snow/ice pixels (bit 5).

        Returns:
            Float64 copy of ``data`` with masked pixels set to NaN.
        """
        result = data.astype(np.float64)
        qa = qa_pixel.astype(np.int32)

        bad_mask = np.zeros(qa.shape, dtype=bool)

        if mask_cloud:
            bad_mask |= (qa >> self._L8_BIT_CLOUD & 1).astype(bool)
            bad_mask |= (qa >> self._L8_BIT_DILATED_CLOUD & 1).astype(bool)
        if mask_shadow:
            bad_mask |= (qa >> self._L8_BIT_CLOUD_SHADOW & 1).astype(bool)
        if mask_snow:
            bad_mask |= (qa >> self._L8_BIT_SNOW & 1).astype(bool)

        if result.ndim == 3:
            result[:, bad_mask] = np.nan
        else:
            result[bad_mask] = np.nan

        logger.debug(
            "Landsat QA masking: %.1f%% of pixels masked", bad_mask.mean() * 100
        )
        return result

    # ------------------------------------------------------------------
    # MODIS MOD13Q1 pixel reliability
    # ------------------------------------------------------------------

    def mask_modis_pixel_reliability(
        self,
        data: np.ndarray,
        pixel_reliability: np.ndarray,
        keep_marginal: bool = True,
    ) -> np.ndarray:
        """Mask MODIS MOD13Q1 using the pixel reliability ancillary product.

        Reliability values:
            -1 = Fill / No data  → always masked
             0 = Good data       → always kept
             1 = Marginal data   → kept if keep_marginal=True
             2 = Snow / Ice      → always masked
             3 = Cloudy          → always masked

        Args:
            data: Image array, shape (H, W) or (C, H, W).
            pixel_reliability: Reliability layer, shape (H, W).  Signed int8/int16.
            keep_marginal: Whether to keep pixels with reliability == 1.

        Returns:
            Float64 copy of ``data`` with bad pixels set to NaN.
        """
        result = data.astype(np.float64)
        pr = pixel_reliability.astype(np.int16)

        bad_mask = (pr == -1) | (pr == 2) | (pr == 3)
        if not keep_marginal:
            bad_mask |= pr == 1

        if result.ndim == 3:
            result[:, bad_mask] = np.nan
        else:
            result[bad_mask] = np.nan

        logger.debug(
            "MODIS PR masking: %.1f%% of pixels masked (keep_marginal=%s)",
            bad_mask.mean() * 100,
            keep_marginal,
        )
        return result

    # ------------------------------------------------------------------
    # HLS Fmask masking
    # ------------------------------------------------------------------

    # Fmask bit positions
    _HLS_BIT_CIRRUS = 0
    _HLS_BIT_CLOUD = 1
    _HLS_BIT_ADJ_CLOUD = 2
    _HLS_BIT_CLOUD_SHADOW = 3
    _HLS_BIT_SNOW_ICE = 4
    _HLS_BIT_WATER = 5

    def mask_hls_fmask(
        self,
        data: np.ndarray,
        fmask: np.ndarray,
        mask_water: bool = False,
    ) -> np.ndarray:
        """Mask HLS (Harmonized Landsat-Sentinel-2) using the Fmask band.

        Bit positions (0-indexed):
            bit 0 = Cirrus
            bit 1 = Cloud
            bit 2 = Adjacent cloud
            bit 3 = Cloud shadow
            bit 4 = Snow / Ice
            bit 5 = Water

        Water is NOT masked by default because it may be the feature of interest.

        Args:
            data: Image array, shape (H, W) or (C, H, W).
            fmask: Fmask band as uint8 array, shape (H, W).
            mask_water: If True, also mask water pixels (bit 5).

        Returns:
            Float64 copy of ``data`` with masked pixels set to NaN.
        """
        result = data.astype(np.float64)
        fm = fmask.astype(np.int32)

        bad_bits = [
            self._HLS_BIT_CIRRUS,
            self._HLS_BIT_CLOUD,
            self._HLS_BIT_ADJ_CLOUD,
            self._HLS_BIT_CLOUD_SHADOW,
            self._HLS_BIT_SNOW_ICE,
        ]
        if mask_water:
            bad_bits.append(self._HLS_BIT_WATER)

        bad_mask = np.zeros(fm.shape, dtype=bool)
        for bit in bad_bits:
            bad_mask |= ((fm >> bit) & 1).astype(bool)

        if result.ndim == 3:
            result[:, bad_mask] = np.nan
        else:
            result[bad_mask] = np.nan

        logger.debug(
            "HLS Fmask masking: %.1f%% of pixels masked", bad_mask.mean() * 100
        )
        return result

    # ------------------------------------------------------------------
    # Valid fraction utility
    # ------------------------------------------------------------------

    def compute_valid_fraction(self, data: np.ndarray) -> float:
        """Compute the fraction of non-NaN pixels in an array.

        Args:
            data: Array of any shape; NaN indicates masked/invalid.

        Returns:
            Fraction in [0.0, 1.0].
        """
        total = data.size
        if total == 0:
            return 0.0
        valid = int(np.sum(~np.isnan(data.astype(np.float64))))
        return valid / total
