"""
Label Management and Ground Truth Alignment for GEOVISTA Intelligence.

Handles:
- Loading and class remapping for ESA WorldCover (10m)
- JRC Global Surface Water occurrence mapping
- Synthetic and heuristic change detection mask tagging
- Strict non-interpolative categorical alignment
- Class distribution reporting and uncertainty tracking
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)


# Standard ESA WorldCover 2020/2021 10m Classes
WORLDCOVER_CLASS_MAP = {
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

# Continuous 0-indexed training target IDs
LULC_ID_TO_TRAIN_IDX = {
    10: 0,   # Trees
    20: 1,   # Shrubland
    30: 2,   # Grassland
    40: 3,   # Cropland
    50: 4,   # Built-up
    60: 5,   # Bare
    70: 6,   # Snow/Ice
    80: 7,   # Water
    90: 8,   # Wetland
    95: 9,   # Mangroves
    100: 10, # Moss/Lichen
}


@dataclass
class LabelProvenance:
    task: str
    label_source: str
    is_authoritative: bool
    is_pseudo_label: bool
    reference_year: Optional[int]
    resolution_m: float
    uncertainties: list[str] = field(default_factory=list)
    class_mapping: dict[int, str] = field(default_factory=dict)


class LabelManager:
    """Manages ground-truth loading, verification, and categorical alignment."""

    @staticmethod
    def get_provenance(task: str) -> LabelProvenance:
        """Return official provenance specifications for each of the 6 tasks."""
        if task == "vegetation":
            return LabelProvenance(
                task="vegetation",
                label_source="MODIS MOD13Q1 / Sentinel-2 Surface Reflectance time series",
                is_authoritative=True,
                is_pseudo_label=False,
                reference_year=None,
                resolution_m=250.0,
                uncertainties=[
                    "Pixel reliability flag indicates sub-pixel clouds and high aerosol noise.",
                    "16-day composites represent maximum-value synthesis, not instantaneous ground state.",
                ],
            )
        elif task == "landcover":
            return LabelProvenance(
                task="landcover",
                label_source="ESA WorldCover (10m)",
                is_authoritative=True,
                is_pseudo_label=False,
                reference_year=2021,
                resolution_m=10.0,
                uncertainties=[
                    "Temporal mismatch if training on imagery acquired > 1 year after reference map.",
                    "Regional confusion between shrubland and open woodland.",
                ],
                class_mapping=WORLDCOVER_CLASS_MAP,
            )
        elif task == "change_detection":
            return LabelProvenance(
                task="change_detection",
                label_source="Bi-temporal coregistered pairs / Unsupervised difference baseline",
                is_authoritative=False,
                is_pseudo_label=True,
                reference_year=None,
                resolution_m=10.0,
                uncertainties=[
                    "Unless paired with an official disaster/deforestation callset, labels are heuristic thresholds.",
                    "Must be recorded as weak supervisory signals in evaluation reports.",
                ],
            )
        elif task == "flood":
            return LabelProvenance(
                task="flood",
                label_source="Copernicus Emergency Management Service (EMS) / Sentinel-1 SAR backscatter",
                is_authoritative=True,
                is_pseudo_label=False,
                reference_year=None,
                resolution_m=10.0,
                uncertainties=[
                    "Airport runways and smooth asphalt cause specular radar reflection identical to calm water.",
                    "Wind-induced surface waves roughen water surfaces, increasing backscatter and causing false negatives.",
                ],
            )
        elif task == "coastal":
            return LabelProvenance(
                task="coastal",
                label_source="MNDWI Water Index & SAR Edge Delineation",
                is_authoritative=False,
                is_pseudo_label=True,
                reference_year=None,
                resolution_m=10.0,
                uncertainties=[
                    "Without co-incident tidal gauge data, observed changes reflect instantaneous tide levels.",
                    "Cannot claim physical erosion without tide normalization.",
                ],
            )
        elif task == "deformation":
            return LabelProvenance(
                task="deformation",
                label_source="External InSAR unwrapped phase / Coherence loss proxy",
                is_authoritative=False,
                is_pseudo_label=True,
                reference_year=None,
                resolution_m=10.0,
                uncertainties=[
                    "Raw SAR amplitude cannot measure millimeter surface displacement.",
                    "Coherence drop is an indicator of surface disturbance, not physical deformation.",
                    "Full InSAR requires external processing chains (SNAP, ISCE2, StaMPS, MintPy).",
                ],
            )
        else:
            raise ValueError(f"Unknown task: {task}")

    @staticmethod
    def remap_worldcover_to_train_indices(raw_label: np.ndarray) -> np.ndarray:
        """
        Convert ESA WorldCover raw codes (10, 20, ..., 100) to continuous 0-10 class indices.
        Unmapped pixels or nodata are assigned 255 (PyTorch standard ignore_index).
        """
        remapped = np.full(raw_label.shape, 255, dtype=np.uint8)
        for raw_code, train_idx in LULC_ID_TO_TRAIN_IDX.items():
            remapped[raw_label == raw_code] = train_idx
        return remapped

    @staticmethod
    def align_categorical_label(
        source_label: np.ndarray,
        target_shape: tuple[int, int],
    ) -> np.ndarray:
        """
        Resize categorical label array to target shape strictly using NEAREST neighbor logic.
        NEVER uses bilinear/bicubic interpolation, which invents non-existent intermediate class IDs.
        """
        src_h, src_w = source_label.shape
        dst_h, dst_w = target_shape
        if (src_h, src_w) == (dst_h, dst_w):
            return source_label.copy()

        # Pure NumPy nearest-neighbor 2D grid resampling
        row_indices = np.round(np.linspace(0, src_h - 1, dst_h)).astype(np.intp)
        col_indices = np.round(np.linspace(0, src_w - 1, dst_w)).astype(np.intp)
        return source_label[np.ix_(row_indices, col_indices)]

    @staticmethod
    def compute_class_distribution(label_arr: np.ndarray, num_classes: int = 11) -> dict[int, float]:
        """Compute relative percentage of each class for class-weighted loss balancing."""
        valid_mask = label_arr != 255
        total_valid = int(np.sum(valid_mask))
        if total_valid == 0:
            return {c: 0.0 for c in range(num_classes)}

        dist: dict[int, float] = {}
        for c in range(num_classes):
            cnt = int(np.sum(label_arr == c))
            dist[c] = float(cnt / total_valid)
        return dist
