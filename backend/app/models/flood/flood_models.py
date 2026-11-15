"""
Flood Detection and Surface Water Monitoring Models for GEOVISTA Intelligence.

Includes:
1. SAR Empirical Backscatter Thresholding Baseline (Martinis / Twele et al.)
2. SAR Dual-Pol Random Forest Pixel Classifier
3. FloodUNet for SAR-based water extent and inundation segmentation
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn

from app.models.landcover.unet import UNet

logger = logging.getLogger(__name__)


class SARFloodThresholdBaseline:
    """
    Empirical SAR thresholding baseline for flood detection.

    Principle:
    Smooth standing water causes specular reflection of radar pulses away from the antenna,
    resulting in very low backscatter coefficient (sigma naught in dB).

    Physical Factors Accounted For:
    - Polarization: VV is primary; VH has higher volumetric sensitivity.
    - DEM Slope Masking: Steep terrain (> 5 deg) produces radar shadows or dry slopes that can mimic water.
    - Typical Sentinel-1 VV Water Threshold: -16.0 to -18.0 dB.
    """

    def __init__(
        self,
        vv_threshold_db: float = -16.0,
        vh_threshold_db: float = -23.0,
        max_slope_deg: float = 5.0,
    ) -> None:
        self.vv_threshold_db = vv_threshold_db
        self.vh_threshold_db = vh_threshold_db
        self.max_slope_deg = max_slope_deg

    def detect_flood(
        self,
        vv_db: np.ndarray,
        vh_db: Optional[np.ndarray] = None,
        slope_deg: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Produce binary flood inundation map (1 = Water/Flood, 0 = Non-water).
        Masks pixels with NaN or slope > max_slope_deg.
        """
        water_mask = vv_db < self.vv_threshold_db

        if vh_db is not None:
            water_mask &= vh_db < self.vh_threshold_db

        if slope_deg is not None:
            # Mask out steep slopes where radar shadows cause false positives
            water_mask &= slope_deg <= self.max_slope_deg

        water_mask &= ~np.isnan(vv_db)
        return water_mask.astype(np.float32)

    def compute_flood_extent_sqkm(self, flood_mask: np.ndarray, pixel_size_m: float = 10.0) -> float:
        """Calculate total inundated area in km²."""
        inundated_pixels = int(np.sum(flood_mask == 1.0))
        return float(inundated_pixels * (pixel_size_m ** 2) / 1e6)


class FloodRandomForest:
    """Random Forest classifier using SAR backscatter, polarization ratios, and local texture."""

    def __init__(self, n_estimators: int = 100, max_depth: int = 10, random_state: int = 42) -> None:
        from sklearn.ensemble import RandomForestClassifier
        self.clf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
        )

    def fit(self, X_sar: np.ndarray, y_flood: np.ndarray) -> None:
        """X_sar: [N, 3] features (VV_dB, VH_dB, VV/VH ratio)."""
        valid = ~np.isnan(X_sar).any(axis=1) & (y_flood != 255)
        self.clf.fit(X_sar[valid], y_flood[valid])

    def predict(self, X_sar: np.ndarray) -> np.ndarray:
        return self.clf.predict(X_sar)

    def predict_proba(self, X_sar: np.ndarray) -> np.ndarray:
        return self.clf.predict_proba(X_sar)[:, 1]


class FloodUNet(UNet):
    """U-Net adapted for binary flood inundation segmentation from SAR inputs."""

    def __init__(self, in_channels: int = 2, base_features: int = 32, bilinear: bool = True) -> None:
        # 2 input channels: VV dB and VH dB; 1 output channel: binary water logit
        super().__init__(in_channels=in_channels, num_classes=1, base_features=base_features, bilinear=bilinear)

    def predict_flood_probability(self, x: torch.Tensor) -> torch.Tensor:
        """Return sigmoid inundation probability [B, 1, H, W]."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            return torch.sigmoid(logits)
