"""
SAR preprocessing module for GEOVISTA Intelligence.

IMPORTANT NOTES ON SAR PREPROCESSING:
- Raw SAR amplitude values are NOT directly usable for ML.
- Proper preprocessing requires: thermal noise removal -> radiometric calibration ->
  terrain correction -> speckle filtering (optional for GRD).
- For InSAR/deformation analysis, SLC processing requires specialist software
  (SNAP, ISCE2, MintPy) which is NOT implemented here.
- This module handles post-calibration sigma0 processing for GRD products.
- Input sigma0 is assumed to already be terrain-corrected and calibrated.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from scipy.ndimage import uniform_filter, variance

logger = logging.getLogger(__name__)


class SARPreprocessor:
    """SAR-specific preprocessing pipeline for calibrated GRD sigma0 products."""

    # ------------------------------------------------------------------
    # dB conversion
    # ------------------------------------------------------------------

    def linear_to_db(self, sigma0_linear: np.ndarray) -> np.ndarray:
        """Convert linear sigma0 to dB: 10 * log10(sigma0).

        Zeros and negative values (physically invalid) are set to NaN before
        conversion.

        Args:
            sigma0_linear: Linear-scale backscatter array.

        Returns:
            dB-scale array with invalid pixels as NaN.
        """
        result = sigma0_linear.astype(np.float64)
        invalid_mask = result <= 0
        if np.any(invalid_mask):
            logger.debug(
                "linear_to_db: masking %d invalid (<=0) pixels", np.sum(invalid_mask)
            )
        result[invalid_mask] = np.nan
        with np.errstate(divide="ignore", invalid="ignore"):
            db = 10.0 * np.log10(result)
        return db

    def db_to_linear(self, sigma0_db: np.ndarray) -> np.ndarray:
        """Convert dB sigma0 back to linear scale: 10^(sigma0_db / 10).

        NaN pixels in the input remain NaN in the output.
        """
        return np.power(10.0, sigma0_db.astype(np.float64) / 10.0)

    # ------------------------------------------------------------------
    # Speckle filtering
    # ------------------------------------------------------------------

    def apply_lee_filter(self, arr: np.ndarray, window_size: int = 7) -> np.ndarray:
        """Lee speckle filter for SAR intensity images.

        Reduces multiplicative speckle noise while preserving edges using
        local statistics. Operates on linear-scale (not dB) intensity.

        Algorithm:
            filtered = mean + k * (arr - mean)
            where k = var_signal / (var_signal + var_noise)
            and   var_signal = max(0, local_var - var_noise)
            and   var_noise  = mean(local_var) across the whole image (ENL estimate).

        Args:
            arr: 2D or 3D (bands, H, W) linear-scale intensity array.
            window_size: Size of the local statistics window (odd integer).

        Returns:
            Filtered array, same shape and dtype as input.
        """
        if arr.ndim == 3:
            return np.stack(
                [self.apply_lee_filter(arr[b], window_size) for b in range(arr.shape[0])],
                axis=0,
            )

        arr_f = arr.astype(np.float64)
        mean_local = uniform_filter(arr_f, size=window_size)
        mean_sq_local = uniform_filter(arr_f ** 2, size=window_size)
        var_local = mean_sq_local - mean_local ** 2
        var_local = np.maximum(var_local, 0)

        # Noise variance estimated as global mean of local variances
        noise_var = float(np.nanmean(var_local))

        signal_var = np.maximum(var_local - noise_var, 0)
        with np.errstate(invalid="ignore", divide="ignore"):
            k = np.where(
                (signal_var + noise_var) > 0,
                signal_var / (signal_var + noise_var),
                0.0,
            )

        filtered = mean_local + k * (arr_f - mean_local)
        # Restore NaN mask from input
        filtered[np.isnan(arr_f)] = np.nan
        return filtered

    def apply_refined_lee_filter(
        self, arr: np.ndarray, window_size: int = 7
    ) -> np.ndarray:
        """Refined Lee filter with improved edge preservation.

        Uses directional sub-windows to identify edge pixels and applies
        anisotropic filtering only in homogeneous sub-windows.

        Args:
            arr: 2D linear-scale intensity array.
            window_size: Size of the main window (odd integer, >= 7 recommended).

        Returns:
            Filtered array with same shape.
        """
        if arr.ndim == 3:
            return np.stack(
                [self.apply_refined_lee_filter(arr[b], window_size) for b in range(arr.shape[0])],
                axis=0,
            )

        arr_f = arr.astype(np.float64)
        h, w = arr_f.shape
        half = window_size // 2

        # Pad array
        padded = np.pad(arr_f, half, mode="reflect")
        output = np.empty_like(arr_f)

        # 8 directional sub-window offsets for a 3x3 arrangement
        # We use 3x3 non-overlapping sub-windows within the main window
        # and pick the one with minimum CV (coefficient of variation = std/mean)
        sub = max(1, window_size // 3)
        offsets = [
            (0, 0), (0, sub), (0, 2 * sub),
            (sub, 0),          (sub, 2 * sub),
            (2 * sub, 0), (2 * sub, sub), (2 * sub, 2 * sub),
        ]

        for row in range(h):
            for col in range(w):
                win = padded[row: row + window_size, col: col + window_size]
                best_cv = np.inf
                best_mean = float(np.nanmean(win))
                best_var = float(np.nanvar(win))

                for dr, dc in offsets:
                    sub_win = win[dr: dr + sub, dc: dc + sub]
                    sub_mean = float(np.nanmean(sub_win))
                    sub_std = float(np.nanstd(sub_win))
                    if sub_mean > 0:
                        cv = sub_std / sub_mean
                        if cv < best_cv:
                            best_cv = cv
                            best_mean = sub_mean
                            best_var = float(np.nanvar(sub_win))

                noise_var_est = best_mean ** 2 * (1.0 / max(best_cv, 1e-6) ** 2 - 1) if best_cv > 0 else best_var
                signal_var = max(0.0, best_var - noise_var_est)
                denom = best_var if best_var > 0 else 1e-10
                k = signal_var / denom
                output[row, col] = best_mean + k * (arr_f[row, col] - best_mean)

        output[np.isnan(arr_f)] = np.nan
        return output

    # ------------------------------------------------------------------
    # Polarimetric features
    # ------------------------------------------------------------------

    def compute_vv_vh_ratio(self, vv: np.ndarray, vh: np.ndarray) -> np.ndarray:
        """VV/VH ratio in dB.

        Useful for flood detection: open water has characteristically high
        VV/VH ratio due to specular reflection suppressing VH.

        Args:
            vv: VV polarisation in dB.
            vh: VH polarisation in dB.

        Returns:
            Ratio array in dB (vv_dB - vh_dB). NaN where either input is NaN.
        """
        vv = vv.astype(np.float64)
        vh = vh.astype(np.float64)
        return vv - vh  # subtraction in dB is division in linear

    def compute_rfdi(self, vv: np.ndarray, vh: np.ndarray) -> np.ndarray:
        """Radar Forest Degradation Index.

        RFDI = (VV - VH) / (VV + VH)

        Computed in linear scale. High RFDI indicates surface/volume scattering
        contrast useful for detecting forest degradation.

        Args:
            vv: VV polarisation (linear or dB; if dB, convert first).
            vh: VH polarisation (same scale as vv).

        Returns:
            RFDI array in [-1, 1]. NaN where denominator is zero or inputs NaN.
        """
        vv = vv.astype(np.float64)
        vh = vh.astype(np.float64)
        denominator = vv + vh
        with np.errstate(invalid="ignore", divide="ignore"):
            rfdi = np.where(denominator == 0, np.nan, (vv - vh) / denominator)
        return rfdi

    # ------------------------------------------------------------------
    # Incidence angle normalisation
    # ------------------------------------------------------------------

    def normalize_incidence_angle(
        self,
        sigma0: np.ndarray,
        incidence_angle: np.ndarray,
        reference_angle_deg: float = 35.0,
        n_exponent: float = 1.5,
    ) -> np.ndarray:
        """Correct sigma0 for incidence angle variation (cosine correction).

        sigma0_corrected = sigma0 * (cos(ref_angle) / cos(local_angle))^n

        **IMPORTANT**: This is an approximation. The appropriate exponent n
        depends on surface type (vegetation ~1.0, bare soil ~2.0); the default
        1.5 is a common compromise. Proper correction is scene-dependent.

        Args:
            sigma0: Linear-scale sigma0 array.
            incidence_angle: Per-pixel local incidence angle in degrees.
            reference_angle_deg: Reference angle to normalise to (degrees).
            n_exponent: Exponent for cosine correction (default 1.5).

        Returns:
            Angle-normalised sigma0 (linear scale).
        """
        sigma0 = sigma0.astype(np.float64)
        inc_rad = np.deg2rad(incidence_angle.astype(np.float64))
        ref_rad = np.deg2rad(reference_angle_deg)

        cos_ref = np.cos(ref_rad)
        cos_inc = np.cos(inc_rad)

        with np.errstate(invalid="ignore", divide="ignore"):
            correction = np.where(
                cos_inc > 0,
                (cos_ref / cos_inc) ** n_exponent,
                np.nan,
            )

        corrected = sigma0 * correction
        corrected[np.isnan(sigma0)] = np.nan
        logger.debug(
            "Incidence angle normalization: ref=%.1f deg, n=%.2f", reference_angle_deg, n_exponent
        )
        return corrected

    # ------------------------------------------------------------------
    # Nodata masking
    # ------------------------------------------------------------------

    def apply_nodata_mask_sar(
        self, arr: np.ndarray, threshold: float = -50.0
    ) -> np.ndarray:
        """Mask extremely low dB values as likely nodata in SAR products.

        Values below ``threshold`` dB are set to NaN. The default -50 dB is
        well below any physically realistic backscatter and indicates a no-data
        region in most SAR products.

        Args:
            arr: SAR array in dB.
            threshold: Lower dB bound; below this value pixels are masked.

        Returns:
            Array with same shape; masked pixels set to NaN.
        """
        result = arr.astype(np.float64)
        result[result < threshold] = np.nan
        return result

    # ------------------------------------------------------------------
    # Texture features (GLCM)
    # ------------------------------------------------------------------

    def compute_texture_features(
        self,
        arr: np.ndarray,
        window_size: int = 7,
    ) -> dict[str, np.ndarray]:
        """Compute local GLCM-inspired texture features for SAR.

        **Warning**: This is computationally expensive. Apply to small patches,
        not full scenes (a 10 000 × 10 000 pixel scene will be very slow).

        Computed features:
            - contrast: local variance (proxy for GLCM contrast)
            - dissimilarity: mean absolute deviation from local mean
            - homogeneity: inverse of local variance
            - energy: local mean of squared values
            - correlation: normalised local covariance (stddev-normalised mean)

        Args:
            arr: 2D SAR image array (single band).
            window_size: Local window size for statistics.

        Returns:
            Dict mapping feature_name -> 2D array of same spatial shape.
        """
        if arr.ndim != 2:
            raise ValueError("compute_texture_features expects a 2D array")

        arr_f = arr.astype(np.float64)
        mean_local = uniform_filter(arr_f, size=window_size)
        mean_sq_local = uniform_filter(arr_f ** 2, size=window_size)
        var_local = np.maximum(mean_sq_local - mean_local ** 2, 0)
        std_local = np.sqrt(var_local)

        contrast = var_local

        # Dissimilarity: mean|x - mean| approximated via uniform filter on abs deviation
        abs_dev = uniform_filter(np.abs(arr_f - mean_local), size=window_size)
        dissimilarity = abs_dev

        with np.errstate(invalid="ignore", divide="ignore"):
            homogeneity = np.where(var_local > 0, 1.0 / (1.0 + var_local), 1.0)

        energy = mean_sq_local  # sum of squared intensities (localised)

        # Correlation: normalised deviation of local mean from global mean
        global_mean = float(np.nanmean(arr_f))
        global_std = float(np.nanstd(arr_f))
        with np.errstate(invalid="ignore", divide="ignore"):
            correlation = np.where(
                (std_local > 0) & (global_std > 0),
                (mean_local - global_mean) / (std_local * global_std),
                0.0,
            )

        return {
            "contrast": contrast,
            "dissimilarity": dissimilarity,
            "homogeneity": homogeneity,
            "energy": energy,
            "correlation": correlation,
        }

    # ------------------------------------------------------------------
    # Flood detection preparation
    # ------------------------------------------------------------------

    def prepare_for_flood_detection(
        self,
        vv_db: np.ndarray,
        vh_db: np.ndarray,
        dem: np.ndarray | None = None,
    ) -> dict[str, np.ndarray]:
        """Prepare SAR bands for a flood detection ML model.

        Returns a dict with:
            - ``vv``: VV polarisation (dB)
            - ``vh``: VH polarisation (dB)
            - ``ratio``: VV/VH ratio (dB)
            - ``rfdi``: Radar Forest Degradation Index (linear)
            - ``slope``: terrain slope in degrees (only if DEM provided)

        **IMPORTANT**: Invalid/masked pixels are represented as NaN, never 0.
        Zeros are physically meaningful backscatter values.

        Args:
            vv_db: VV sigma0 in dB.
            vh_db: VH sigma0 in dB.
            dem: Optional DEM array in metres (same spatial extent & resolution).

        Returns:
            Dict of feature arrays (each same shape as vv_db).
        """
        vv_db = vv_db.astype(np.float64)
        vh_db = vh_db.astype(np.float64)

        ratio = self.compute_vv_vh_ratio(vv_db, vh_db)

        # Convert to linear for RFDI
        vv_lin = self.db_to_linear(vv_db)
        vh_lin = self.db_to_linear(vh_db)
        rfdi = self.compute_rfdi(vv_lin, vh_lin)

        result: dict[str, np.ndarray] = {
            "vv": vv_db,
            "vh": vh_db,
            "ratio": ratio,
            "rfdi": rfdi,
        }

        if dem is not None:
            dem_f = dem.astype(np.float64)
            # Approximate slope from gradient magnitude (degrees)
            dy, dx = np.gradient(dem_f)
            slope = np.degrees(np.arctan(np.sqrt(dx ** 2 + dy ** 2)))
            slope[np.isnan(dem_f)] = np.nan
            result["slope"] = slope

        return result
