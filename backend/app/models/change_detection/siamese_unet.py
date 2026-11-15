"""
Environmental Change Detection Models for GEOVISTA Intelligence.

Includes:
1. Index-based change detection baseline (dNDVI, dMNDWI, dNBR, SAR backscatter diff)
2. Pair-differencing Random Forest/XGBoost tabular baseline
3. Siamese U-Net deep learning architecture for bi-temporal image pairs
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from app.models.landcover.unet import DoubleConv, Down, Up

logger = logging.getLogger(__name__)


class IndexChangeBaseline:
    """
    Transparent spectral index differencing baseline.
    Computes delta = Post - Pre and applies thresholding.
    """

    @staticmethod
    def detect_vegetation_loss(
        pre_ndvi: np.ndarray,
        post_ndvi: np.ndarray,
        threshold: float = -0.15,
    ) -> np.ndarray:
        """Forest loss / vegetation degradation: post_ndvi - pre_ndvi < threshold."""
        delta = post_ndvi - pre_ndvi
        return (delta < threshold).astype(np.float32)

    @staticmethod
    def detect_water_change(
        pre_mndwi: np.ndarray,
        post_mndwi: np.ndarray,
        threshold: float = 0.20,
    ) -> np.ndarray:
        """Water expansion / inundation: post_mndwi - pre_mndwi > threshold."""
        delta = post_mndwi - pre_mndwi
        return (delta > threshold).astype(np.float32)

    @staticmethod
    def detect_sar_backscatter_change(
        pre_vv_db: np.ndarray,
        post_vv_db: np.ndarray,
        threshold_db: float = -3.0,
    ) -> np.ndarray:
        """SAR decrease (water inundation / smooth ground): post_vv - pre_vv < threshold."""
        delta = post_vv_db - pre_vv_db
        return (delta < threshold_db).astype(np.float32)


class SiameseUNet(nn.Module):
    """
    Siamese U-Net for bi-temporal change detection.
    Processes pre-change (T1) and post-change (T2) images through a shared Siamese encoder,
    computes absolute difference feature maps at every level, and decodes to a binary change mask.
    """

    def __init__(
        self,
        in_channels: int = 4,
        base_features: int = 32,
        bilinear: bool = True,
    ) -> None:
        super().__init__()
        self.in_channels = in_channels
        self.base_features = base_features

        f = base_features
        # Shared Siamese Encoder
        self.inc = DoubleConv(in_channels, f)
        self.down1 = Down(f, f * 2)
        self.down2 = Down(f * 2, f * 4)
        self.down3 = Down(f * 4, f * 8)
        factor = 2 if bilinear else 1
        self.down4 = Down(f * 8, (f * 16) // factor)

        # Decoder fusing difference representations
        self.up1 = Up(f * 16, (f * 8) // factor, bilinear)
        self.up2 = Up(f * 8, (f * 4) // factor, bilinear)
        self.up3 = Up(f * 4, (f * 2) // factor, bilinear)
        self.up4 = Up(f * 2, f, bilinear)
        self.outc = nn.Conv2d(f, 1, kernel_size=1)

    def forward(self, t1: torch.Tensor, t2: torch.Tensor) -> torch.Tensor:
        """
        Input: t1, t2 each of shape [B, C, H, W]
        Output: logits of shape [B, 1, H, W]
        """
        # Encode T1
        x1_1 = self.inc(t1)
        x1_2 = self.down1(x1_1)
        x1_3 = self.down2(x1_2)
        x1_4 = self.down3(x1_3)
        x1_5 = self.down4(x1_4)

        # Encode T2
        x2_1 = self.inc(t2)
        x2_2 = self.down1(x2_1)
        x2_3 = self.down2(x2_2)
        x2_4 = self.down3(x2_3)
        x2_5 = self.down4(x2_4)

        # Multi-scale absolute feature differencing
        diff5 = torch.abs(x1_5 - x2_5)
        diff4 = torch.abs(x1_4 - x2_4)
        diff3 = torch.abs(x1_3 - x2_3)
        diff2 = torch.abs(x1_2 - x2_2)
        diff1 = torch.abs(x1_1 - x2_1)

        # Decode difference
        x = self.up1(diff5, diff4)
        x = self.up2(x, diff3)
        x = self.up3(x, diff2)
        x = self.up4(x, diff1)
        logits = self.outc(x)
        return logits

    def predict_change_probability(self, t1: torch.Tensor, t2: torch.Tensor) -> torch.Tensor:
        """Return sigmoid probability map [B, 1, H, W]."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(t1, t2)
            return torch.sigmoid(logits)
