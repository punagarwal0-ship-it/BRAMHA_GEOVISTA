"""
Land-Cover Classification Models for GEOVISTA Intelligence.

Includes:
- LandCoverRandomForest: Pixel-level Random Forest classifier for tabular spectra
- LandCoverXGBoost: Gradient-boosted trees for multi-spectral pixel classification
- Exported UNet segmentation model
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)


class LandCoverRandomForest:
    """Random Forest baseline for pixel-wise land cover classification."""

    CLASS_NAMES = [
        "Tree cover", "Shrubland", "Grassland", "Cropland", "Built-up",
        "Bare", "Snow/Ice", "Water", "Wetland", "Mangroves", "Moss/Lichen"
    ]

    def __init__(self, n_estimators: int = 100, max_depth: Optional[int] = 15, random_state: int = 42) -> None:
        from sklearn.ensemble import RandomForestClassifier
        self.clf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
        )

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """X: [N_pixels, N_bands], y: [N_pixels] in 0..10"""
        valid = y != 255
        self.clf.fit(X[valid], y[valid])

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.clf.predict(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.clf.predict_proba(X)


class LandCoverXGBoost:
    """XGBoost baseline for multi-spectral land cover classification."""

    def __init__(self, n_estimators: int = 100, max_depth: int = 6, random_state: int = 42) -> None:
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state
        self.model = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        try:
            from xgboost import XGBClassifier
            valid = y != 255
            self.model = XGBClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                random_state=self.random_state,
                eval_metric="mlogloss",
                n_jobs=-1,
            )
            self.model.fit(X[valid], y[valid])
        except ImportError:
            logger.warning("xgboost not installed, falling back to RandomForest")
            rf = LandCoverRandomForest(n_estimators=self.n_estimators, random_state=self.random_state)
            rf.fit(X, y)
            self.model = rf

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict(X)
