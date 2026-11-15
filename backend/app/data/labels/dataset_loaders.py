"""
Modular Dataset Loaders for All Six GEOVISTA Intelligence Tasks.

Provides standard PyTorch `Dataset` interfaces:
1. `VegetationDataset`: Time-series forecasting ([B, T, C] -> [B, H])
2. `LandCoverDataset`: Multi-spectral semantic segmentation ([B, C, H, W] -> [B, H, W])
3. `ChangeDetectionDataset`: Coregistered bi-temporal pairs ([B, C, H, W] x 2 -> [B, 1, H, W])
4. `FloodDataset`: SAR dual-pol flood segmentation ([B, 2, H, W] -> [B, 1, H, W])
5. `CoastalDataset`: Water boundary dynamics segmentation ([B, C, H, W] -> [B, 1, H, W])
6. `DeformationDataset`: Coherence disturbance & InSAR proxy classification ([B, C, H, W] -> [B, K, H, W])
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
import torch
from torch.utils.data import Dataset

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------
# Task 1: Vegetation Time-Series Dataset
# --------------------------------------------------------------------------
class VegetationDataset(Dataset):
    """
    Dataset for sequential vegetation forecasting.
    Input: [sequence_len, n_features] (e.g., NDVI, EVI, DOY_sin, DOY_cos, QA)
    Target: [forecast_horizon] continuous NDVI values
    """

    def __init__(
        self,
        samples: list[dict[str, Any]],
        sequence_len: int = 12,
        forecast_horizon: int = 6,
    ) -> None:
        self.samples = samples
        self.sequence_len = sequence_len
        self.forecast_horizon = forecast_horizon

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        s = self.samples[idx]
        seq = s["features"]  # shape: [seq_len, n_features]
        target = s["target"] # shape: [forecast_horizon]

        return {
            "x": torch.tensor(seq, dtype=torch.float32),
            "y": torch.tensor(target, dtype=torch.float32),
        }


# --------------------------------------------------------------------------
# Task 2: Land Cover Semantic Segmentation Dataset
# --------------------------------------------------------------------------
class LandCoverDataset(Dataset):
    """
    Dataset for multi-spectral land cover segmentation.
    Input: [channels, height, width] (e.g., S2 optical bands scaled to 0-1)
    Target: [height, width] discrete class indices (0 to 10; 255 = ignore)
    """

    def __init__(
        self,
        patches: list[dict[str, Any]],
    ) -> None:
        self.patches = patches

    def __len__(self) -> int:
        return len(self.patches)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        p = self.patches[idx]
        image = p["image"]  # shape: [C, H, W]
        mask = p["label"]   # shape: [H, W]

        # Convert NaN in input to 0.0 with mask channel if needed
        clean_img = np.nan_to_num(image, nan=0.0).astype(np.float32)
        clean_mask = mask.astype(np.int64)

        return {
            "image": torch.from_numpy(clean_img),
            "mask": torch.from_numpy(clean_mask),
        }


# --------------------------------------------------------------------------
# Task 3: Change Detection Dataset (Bi-temporal Image Pairs)
# --------------------------------------------------------------------------
class ChangeDetectionDataset(Dataset):
    """
    Dataset for bi-temporal change detection.
    Input: Two coregistered patches (T1, T2) of shape [C, H, W]
    Target: Binary change mask [1, H, W] (1 = change, 0 = no change)
    """

    def __init__(
        self,
        pairs: list[dict[str, Any]],
    ) -> None:
        self.pairs = pairs

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        item = self.pairs[idx]
        t1 = np.nan_to_num(item["t1_image"], nan=0.0).astype(np.float32)
        t2 = np.nan_to_num(item["t2_image"], nan=0.0).astype(np.float32)
        change_mask = item["change_mask"].astype(np.float32)

        if change_mask.ndim == 2:
            change_mask = change_mask[np.newaxis, :, :]

        return {
            "t1": torch.from_numpy(t1),
            "t2": torch.from_numpy(t2),
            "mask": torch.from_numpy(change_mask),
        }


# --------------------------------------------------------------------------
# Task 4: Flood Inundation Dataset (SAR Dual-Pol)
# --------------------------------------------------------------------------
class FloodDataset(Dataset):
    """
    Dataset for SAR flood detection.
    Input: [2, H, W] (VV dB, VH dB)
    Target: [1, H, W] binary flood mask
    """

    def __init__(
        self,
        patches: list[dict[str, Any]],
    ) -> None:
        self.patches = patches

    def __len__(self) -> int:
        return len(self.patches)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        p = self.patches[idx]
        sar_bands = np.nan_to_num(p["sar_image"], nan=-30.0).astype(np.float32)
        flood_mask = p["flood_mask"].astype(np.float32)

        if flood_mask.ndim == 2:
            flood_mask = flood_mask[np.newaxis, :, :]

        return {
            "sar": torch.from_numpy(sar_bands),
            "mask": torch.from_numpy(flood_mask),
        }


# --------------------------------------------------------------------------
# Task 5: Coastal & Water Boundary Dataset
# --------------------------------------------------------------------------
class CoastalDataset(Dataset):
    """
    Dataset for coastline & water body delineation.
    Input: [C, H, W] optical or SAR patches
    Target: [1, H, W] binary water presence mask
    """

    def __init__(
        self,
        patches: list[dict[str, Any]],
    ) -> None:
        self.patches = patches

    def __len__(self) -> int:
        return len(self.patches)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        p = self.patches[idx]
        img = np.nan_to_num(p["image"], nan=0.0).astype(np.float32)
        water_mask = p["water_mask"].astype(np.float32)
        if water_mask.ndim == 2:
            water_mask = water_mask[np.newaxis, :, :]

        return {
            "image": torch.from_numpy(img),
            "mask": torch.from_numpy(water_mask),
        }


# --------------------------------------------------------------------------
# Task 6: Ground Surface Movement / InSAR Proxy Dataset
# --------------------------------------------------------------------------
class DeformationDataset(Dataset):
    """
    Dataset for surface disturbance and InSAR coherence-change classification.
    Input: [C, H, W] (coherence map, backscatter delta, slope)
    Target: [1, H, W] disturbance class / displacement proxy
    """

    def __init__(
        self,
        patches: list[dict[str, Any]],
    ) -> None:
        self.patches = patches

    def __len__(self) -> int:
        return len(self.patches)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        p = self.patches[idx]
        features = np.nan_to_num(p["features"], nan=0.0).astype(np.float32)
        target = p["target"].astype(np.float32)
        if target.ndim == 2:
            target = target[np.newaxis, :, :]

        return {
            "features": torch.from_numpy(features),
            "target": torch.from_numpy(target),
        }
