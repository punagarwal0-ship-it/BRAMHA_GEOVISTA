"""
Change Detection Baseline Machine Learning Models.

Pixel-level change classifier based on stacked or differenced bi-temporal spectral features.
"""

from __future__ import annotations

import numpy as np


class ChangeDetectionRandomForest:
    """Random Forest classifier on delta feature vectors."""

    def __init__(self, n_estimators: int = 100, max_depth: int = 12, random_state: int = 42) -> None:
        from sklearn.ensemble import RandomForestClassifier
        self.clf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
        )

    def fit(self, X_t1: np.ndarray, X_t2: np.ndarray, y_change: np.ndarray) -> None:
        """
        X_t1, X_t2: [N, C] multi-spectral pixel arrays.
        y_change: [N] binary change labels (0 or 1).
        Features: [X_t1, X_t2, X_t2 - X_t1, (X_t2 - X_t1) / (X_t1 + 1e-6)]
        """
        diff = X_t2 - X_t1
        rel_diff = diff / (np.abs(X_t1) + 1e-4)
        features = np.concatenate([X_t1, X_t2, diff, rel_diff], axis=1)
        self.clf.fit(features, y_change)

    def predict(self, X_t1: np.ndarray, X_t2: np.ndarray) -> np.ndarray:
        diff = X_t2 - X_t1
        rel_diff = diff / (np.abs(X_t1) + 1e-4)
        features = np.concatenate([X_t1, X_t2, diff, rel_diff], axis=1)
        return self.clf.predict(features)

    def predict_proba(self, X_t1: np.ndarray, X_t2: np.ndarray) -> np.ndarray:
        diff = X_t2 - X_t1
        rel_diff = diff / (np.abs(X_t1) + 1e-4)
        features = np.concatenate([X_t1, X_t2, diff, rel_diff], axis=1)
        return self.clf.predict_proba(features)[:, 1]
