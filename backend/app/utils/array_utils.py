"""
Array manipulation and spectral processing utilities for GEOVISTA Intelligence.

Features:
- Pure NumPy band normalization and clipping
- Scale factor and offset calibration
- Patch extraction with stride and valid fraction gating
- Memory-safe window generation
- Spectral vegetation, water, and soil index formulas
"""

from __future__ import annotations

import numpy as np


def normalize_band(arr: np.ndarray, min_val: float = 0.0, max_val: float = 1.0, clip: bool = True) -> np.ndarray:
    """Normalize array values to [0, 1] range."""
    valid = ~np.isnan(arr)
    if not np.any(valid):
        return arr.copy()
    c_min = float(np.nanmin(arr)) if min_val is None else min_val
    c_max = float(np.nanmax(arr)) if max_val is None else max_val
    denom = c_max - c_min
    if denom == 0:
        return np.zeros_like(arr, dtype=np.float32)
    res = (arr - c_min) / denom
    if clip:
        res = np.clip(res, 0.0, 1.0)
    return res.astype(np.float32)


def apply_scale_offset(
    arr: np.ndarray,
    scale: float,
    offset: float = 0.0,
    fill_value: float | None = None,
    valid_range: tuple[float, float] | None = None,
) -> np.ndarray:
    """Apply physical scale + offset: physical = (DN * scale) + offset."""
    out = np.full(arr.shape, np.nan, dtype=np.float32)
    mask = np.ones(arr.shape, dtype=bool)
    if fill_value is not None:
        mask &= arr != fill_value
    if valid_range is not None:
        mask &= (arr >= valid_range[0]) & (arr <= valid_range[1])
    out[mask] = (arr[mask].astype(np.float32) * scale) + offset
    return out


def create_patch_grid(
    arr: np.ndarray,
    patch_size: int = 256,
    stride: int = 128,
    min_valid_fraction: float = 0.7,
) -> list[tuple[np.ndarray, int, int]]:
    """
    Extract 2D or 3D patches from an array using a sliding window.
    Returns: list of (patch, row_offset, col_offset).
    Patches with valid (non-NaN) fraction below min_valid_fraction are dropped.
    """
    is_3d = arr.ndim == 3
    if is_3d:
        _, h, w = arr.shape
    else:
        h, w = arr.shape

    patches: list[tuple[np.ndarray, int, int]] = []
    for r in range(0, max(1, h - patch_size + 1), stride):
        for c in range(0, max(1, w - patch_size + 1), stride):
            if is_3d:
                patch = arr[:, r : r + patch_size, c : c + patch_size]
                valid = ~np.isnan(patch[0])
            else:
                patch = arr[r : r + patch_size, c : c + patch_size]
                valid = ~np.isnan(patch)

            if np.mean(valid) >= min_valid_fraction:
                patches.append((patch, r, c))

    return patches


def compute_spectral_indices(bands: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """
    Compute standard optical indices from available physical reflectance bands:
    - NDVI: (NIR - Red) / (NIR + Red)
    - EVI: 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
    - MNDWI: (Green - SWIR1) / (Green + SWIR1)
    - NBR: (NIR - SWIR2) / (NIR + SWIR2)
    """
    indices: dict[str, np.ndarray] = {}
    def _get_band(keys: list[str]) -> np.ndarray | None:
        for k in keys:
            if k in bands and bands[k] is not None:
                return bands[k]
        return None

    red = _get_band(["red", "b04"])
    nir = _get_band(["nir", "nir08", "b08", "b05"])
    green = _get_band(["green", "b03"])
    blue = _get_band(["blue", "b02"])
    swir1 = _get_band(["swir1", "swir16", "b11", "b06"])
    swir2 = _get_band(["swir2", "swir22", "b12", "b07"])

    if red is not None and nir is not None:
        denom = nir + red
        with np.errstate(divide="ignore", invalid="ignore"):
            ndvi = np.where(denom > 0, (nir - red) / denom, np.nan)
        indices["ndvi"] = np.clip(ndvi, -1.0, 1.0)

        if blue is not None:
            denom_evi = nir + 6.0 * red - 7.5 * blue + 1.0
            with np.errstate(divide="ignore", invalid="ignore"):
                evi = np.where(denom_evi > 0, 2.5 * (nir - red) / denom_evi, np.nan)
            indices["evi"] = np.clip(evi, -1.0, 1.5)

    if green is not None and swir1 is not None:
        denom = green + swir1
        with np.errstate(divide="ignore", invalid="ignore"):
            mndwi = np.where(denom > 0, (green - swir1) / denom, np.nan)
        indices["mndwi"] = np.clip(mndwi, -1.0, 1.0)

    if nir is not None and swir2 is not None:
        denom = nir + swir2
        with np.errstate(divide="ignore", invalid="ignore"):
            nbr = np.where(denom > 0, (nir - swir2) / denom, np.nan)
        indices["nbr"] = np.clip(nbr, -1.0, 1.0)

    return indices
