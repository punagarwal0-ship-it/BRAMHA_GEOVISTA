"""
Data Quality Validation and Preprocessing Verification for GEOVISTA Intelligence.

Validates:
- Array dimensionality, dtype, and NaN statistics
- Spatial resolution consistency across sensor layers
- Resampling integrity (ensuring categorical maps did not undergo interpolation)
- Missing values and quality mask fractions
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class QualityReport:
    layer_name: str
    shape: tuple[int, ...]
    dtype: str
    total_pixels: int
    valid_pixels: int
    valid_fraction: float
    min_value: float
    max_value: float
    mean_value: float
    std_value: float
    is_categorical: bool
    unique_classes: list[int] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class DataValidator:
    """Verifies that preprocessed geospatial arrays satisfy scientific constraints."""

    @staticmethod
    def audit_array(
        arr: np.ndarray,
        name: str,
        is_categorical: bool = False,
        expected_range: tuple[float, float] | None = None,
    ) -> QualityReport:
        """Run statistical and data integrity checks on an array."""
        total = int(arr.size)
        valid_mask = ~np.isnan(arr)
        valid_count = int(np.sum(valid_mask))
        valid_frac = float(valid_count / total) if total > 0 else 0.0

        warnings: list[str] = []
        if valid_frac < 0.2:
            warnings.append(f"High invalid/cloud pixel fraction ({1.0 - valid_frac:.1%} masked/NaN)")

        if valid_count > 0:
            valid_vals = arr[valid_mask]
            min_v = float(np.min(valid_vals))
            max_v = float(np.max(valid_vals))
            mean_v = float(np.mean(valid_vals))
            std_v = float(np.std(valid_vals))
        else:
            min_v = max_v = mean_v = std_v = float("nan")
            warnings.append("Array contains 100% NaN/masked values.")

        classes = []
        if is_categorical and valid_count > 0:
            unique = np.unique(arr[valid_mask])
            # Check for non-integer artifacts caused by incorrect bilinear interpolation
            non_int = np.any(np.mod(unique, 1) != 0)
            if non_int:
                warnings.append("CRITICAL: Categorical layer contains non-integer interpolated values! Bilinear resampling was improperly applied.")
            classes = [int(u) for u in unique if not np.isnan(u)][:30]

        if expected_range and valid_count > 0:
            if min_v < expected_range[0] - 1e-4 or max_v > expected_range[1] + 1e-4:
                warnings.append(f"Values outside physical range [{expected_range[0]}, {expected_range[1]}]: [{min_v:.3f}, {max_v:.3f}]")

        return QualityReport(
            layer_name=name,
            shape=arr.shape,
            dtype=str(arr.dtype),
            total_pixels=total,
            valid_pixels=valid_count,
            valid_fraction=valid_frac,
            min_value=min_v,
            max_value=max_v,
            mean_value=mean_v,
            std_value=std_v,
            is_categorical=is_categorical,
            unique_classes=classes,
            warnings=warnings,
        )

    @staticmethod
    def check_resolution_compatibility(res1_m: float, res2_m: float) -> str | None:
        """Flag resolution mismatches between paired sensor layers."""
        ratio = max(res1_m, res2_m) / min(res1_m, res2_m)
        if ratio > 3.0:
            return (
                f"Resolution mismatch warning: Sensor 1 ({res1_m}m) and Sensor 2 ({res2_m}m) "
                f"differ by a factor of {ratio:.1f}x. Coarser layers cannot imply equal spatial detail."
            )
        return None
