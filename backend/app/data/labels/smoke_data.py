"""
Lightweight Smoke-Test Dataset Generator for GEOVISTA Intelligence.

Generates small, synthetically sound test datasets for all six tasks:
1. Vegetation time-series (10 sequences, 12 timesteps, 4 features)
2. Land cover multi-spectral patches (8 patches of 64x64 with 6 bands and 11 discrete classes)
3. Change detection bi-temporal pairs (8 paired patches of 64x64 with binary change)
4. Flood detection SAR patches (8 patches of 64x64 dual-pol with binary flood)
5. Coastal water monitoring patches (8 patches of 64x64 with water masks)
6. Ground deformation proxy patches (8 patches of 64x64 with disturbance indices)
"""

from __future__ import annotations

import numpy as np


def generate_smoke_test_data() -> dict[str, list]:
    """Create lightweight, in-memory synthetic datasets to test loaders and loss functions."""
    np.random.seed(42)

    # 1. Vegetation Time-Series (10 samples)
    veg_samples = []
    for i in range(10):
        # features: [NDVI, EVI, DOY_sin, DOY_cos]
        t_seq = np.random.uniform(0.2, 0.8, size=(12, 4)).astype(np.float32)
        # target: next 6 NDVI values
        t_target = np.random.uniform(0.3, 0.85, size=(6,)).astype(np.float32)
        veg_samples.append({
            "sample_id": f"veg_seq_{i}",
            "date": f"2023-{i+1:02d}-01",
            "features": t_seq,
            "target": t_target,
        })

    # 2. Land Cover (8 patches of 64x64, 6 bands, classes 0 to 10)
    landcover_patches = []
    for i in range(8):
        img = np.random.uniform(0.05, 0.6, size=(6, 64, 64)).astype(np.float32)
        lbl = np.random.choice([0, 1, 2, 3, 4, 7], size=(64, 64)).astype(np.int64)
        landcover_patches.append({
            "patch_id": f"lulc_patch_{i}",
            "row_off": (i // 2) * 64,
            "col_off": (i % 2) * 64,
            "image": img,
            "label": lbl,
        })

    # 3. Change Detection (8 pairs of 64x64)
    change_pairs = []
    for i in range(8):
        t1 = np.random.uniform(0.1, 0.7, size=(4, 64, 64)).astype(np.float32)
        t2 = t1 + np.random.normal(0, 0.05, size=(4, 64, 64)).astype(np.float32)
        mask = (np.abs(t2[0] - t1[0]) > 0.15).astype(np.float32)
        change_pairs.append({
            "pair_id": f"change_{i}",
            "date": f"2023-0{i+1}-15",
            "t1_image": t1,
            "t2_image": t2,
            "change_mask": mask,
        })

    # 4. Flood Detection (8 SAR dual-pol patches of 64x64)
    flood_patches = []
    for i in range(8):
        vv = np.random.uniform(-25.0, -5.0, size=(1, 64, 64)).astype(np.float32)
        vh = np.random.uniform(-30.0, -10.0, size=(1, 64, 64)).astype(np.float32)
        sar = np.concatenate([vv, vh], axis=0)
        # Water reflects specularly -> low VV backscatter
        flood_mask = (vv[0] < -18.0).astype(np.float32)
        flood_patches.append({
            "patch_id": f"flood_{i}",
            "sar_image": sar,
            "flood_mask": flood_mask,
        })

    # 5. Coastal Monitoring (8 patches of 64x64)
    coastal_patches = []
    for i in range(8):
        img = np.random.uniform(0.05, 0.5, size=(4, 64, 64)).astype(np.float32)
        water = (img[1] > 0.3).astype(np.float32) # Simulated MNDWI water threshold
        coastal_patches.append({
            "patch_id": f"coastal_{i}",
            "image": img,
            "water_mask": water,
        })

    # 6. Ground Deformation Proxy (8 patches of 64x64)
    deform_patches = []
    for i in range(8):
        feat = np.random.uniform(0.0, 1.0, size=(3, 64, 64)).astype(np.float32)
        # Coherence loss / disturbance mask
        target = (feat[0] < 0.25).astype(np.float32)
        deform_patches.append({
            "patch_id": f"deform_{i}",
            "features": feat,
            "target": target,
        })

    return {
        "vegetation": veg_samples,
        "landcover": landcover_patches,
        "change_detection": change_pairs,
        "flood": flood_patches,
        "coastal": coastal_patches,
        "deformation": deform_patches,
    }
