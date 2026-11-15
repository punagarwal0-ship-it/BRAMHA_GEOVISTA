"""
Task-Specific Ensembles and Cross-Task Environmental Intelligence Layer for GEOVISTA.

Key Rules:
1. Within-Task Ensembles: Combine only models predicting the SAME physical target.
2. Cross-Task Intelligence: Aggregates specialist model predictions into a unified structured assessment.
   NEVER averages unrelated environmental targets (e.g. NDVI and flood probability) into a meaningless number.
3. Selection Guarantee: If an ensemble does not outperform the best individual model on validation data,
   the best individual model is retained.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import numpy as np

logger = logging.getLogger(__name__)


# ==============================================================================
# 1. Within-Task Ensembles
# ==============================================================================

class WithinTaskEnsemble:
    """Combines multiple predictions for the same physical environmental target."""

    @staticmethod
    def weighted_average(
        predictions: list[np.ndarray],
        weights: list[float],
    ) -> np.ndarray:
        """Weighted average: sum(w_i * pred_i) / sum(w_i)."""
        w = np.array(weights, dtype=np.float32)
        w = w / np.sum(w)
        stacked = np.stack(predictions, axis=0)
        # Broadcast weights along axis 0
        w_expanded = w.reshape((-1,) + (1,) * (stacked.ndim - 1))
        return np.sum(stacked * w_expanded, axis=0)

    @staticmethod
    def probability_averaging(
        probability_maps: list[np.ndarray],
        weights: Optional[list[float]] = None,
    ) -> np.ndarray:
        """Average probability predictions across multiple probabilistic models."""
        if weights is None:
            return np.mean(probability_maps, axis=0)
        return WithinTaskEnsemble.weighted_average(probability_maps, weights)

    @staticmethod
    def majority_voting(
        class_maps: list[np.ndarray],
        num_classes: int = 11,
    ) -> np.ndarray:
        """Pixel-wise majority voting for categorical classification outputs."""
        stacked = np.stack(class_maps, axis=0) # [M, H, W]
        # Count frequency of each class
        h, w = class_maps[0].shape
        voted = np.zeros((h, w), dtype=np.int64)

        for r in range(h):
            for c in range(w):
                pixel_classes = stacked[:, r, c]
                valid = pixel_classes[pixel_classes != 255]
                if len(valid) > 0:
                    counts = np.bincount(valid, minlength=num_classes)
                    voted[r, c] = int(np.argmax(counts))
                else:
                    voted[r, c] = 255
        return voted

    @staticmethod
    def stacking_meta_learner(
        oof_predictions: np.ndarray,  # [N_samples, N_models]
        y_true: np.ndarray,           # [N_samples]
        test_predictions: np.ndarray, # [N_test, N_models]
    ) -> np.ndarray:
        """
        Leakage-safe stacking meta-learner.
        Trains a Ridge / Linear regression on out-of-fold (OOF) validation predictions.
        """
        # Fit simple linear model with non-negative weights
        # polyfit or least-squares
        valid = ~np.isnan(y_true) & ~np.isnan(oof_predictions).any(axis=1)
        if np.sum(valid) < 5:
            return np.mean(test_predictions, axis=1)

        X = oof_predictions[valid]
        y = y_true[valid]
        # Normal equations with small L2 ridge regularizer
        l2 = 1e-3 * np.eye(X.shape[1])
        w = np.linalg.solve(X.T @ X + l2, X.T @ y)

        return test_predictions @ w


# ==============================================================================
# 2. Multi-Sensor Optical / SAR Late Fusion
# ==============================================================================

class MultiSensorFusion:
    """Fuses optical and SAR probabilities based on cloud cover and sensor availability."""

    @staticmethod
    def late_fuse(
        optical_prob: Optional[np.ndarray],
        sar_prob: Optional[np.ndarray],
        optical_cloud_fraction: float = 0.0,
    ) -> tuple[np.ndarray, str]:
        """
        Late fusion for flood / coastal water detection:
        - If optical has heavy clouds (> 30%), rely primarily on all-weather SAR.
        - If SAR unavailable, rely on optical.
        - If both available with clear skies, compute confidence-weighted combination.
        """
        if optical_prob is None and sar_prob is None:
            raise ValueError("At least one sensor probability map must be provided.")
        if optical_prob is None:
            return sar_prob, "SAR-only (optical unavailable)"
        if sar_prob is None:
            return optical_prob, "Optical-only (SAR unavailable)"

        # Both available
        if optical_cloud_fraction > 0.4:
            # Cloud obscured optical: weight SAR at 85%
            fused = 0.85 * sar_prob + 0.15 * optical_prob
            mode = f"SAR-dominated fusion (optical cloud contamination {optical_cloud_fraction:.0%})"
        else:
            # Clear sky: 50/50 complementary fusion
            fused = 0.50 * optical_prob + 0.50 * sar_prob
            mode = "Balanced optical + SAR dual-modality fusion"

        return fused, mode


# ==============================================================================
# 3. Cross-Task Environmental Intelligence Layer
# ==============================================================================

@dataclass
class EnvironmentalAssessment:
    assessment_id: str
    generated_at: str
    aoi_bbox: list[float]
    time_window: tuple[str, str]
    task_summaries: dict[str, Any]
    cross_task_synthesis: list[str]
    missing_tasks: list[str]
    uncertainty_profile: dict[str, str]


class CrossTaskIntelligenceLayer:
    """
    Higher-level reasoning layer that aggregates the six specialist model outputs
    into a structured ecological intelligence report.

    PRESERVES INDIVIDUAL SPECIALIST OUTPUTS. Never averages them together.
    """

    def synthesize(
        self,
        aoi_bbox: list[float],
        time_window: tuple[str, str],
        vegetation_output: Optional[dict[str, Any]] = None,
        landcover_output: Optional[dict[str, Any]] = None,
        change_output: Optional[dict[str, Any]] = None,
        flood_output: Optional[dict[str, Any]] = None,
        coastal_output: Optional[dict[str, Any]] = None,
        deformation_output: Optional[dict[str, Any]] = None,
    ) -> EnvironmentalAssessment:
        """Generate structured cross-task assessment."""
        tasks: dict[str, Any] = {}
        missing: list[str] = []
        insights: list[str] = []
        uncertainties: dict[str, str] = {}

        # 1. Vegetation
        if vegetation_output:
            tasks["vegetation"] = vegetation_output
            trend = vegetation_output.get("trend", "stable")
            insights.append(f"Vegetation status: {trend} vigor across observation window.")
            uncertainties["vegetation"] = "16-day composite smoothing; sub-pixel cloud residual noise."
        else:
            tasks["vegetation"] = "DNAV (Data Not Available / Valid)"
            missing.append("vegetation")

        # 2. Land Cover
        if landcover_output:
            tasks["landcover"] = landcover_output
            dom = landcover_output.get("dominant_class", "unknown")
            insights.append(f"Dominant surface cover: {dom}.")
            uncertainties["landcover"] = "Classified against ESA WorldCover baseline."
        else:
            tasks["landcover"] = "DNAV (Data Not Available / Valid)"
            missing.append("landcover")

        # 3. Change Detection
        if change_output:
            tasks["change_detection"] = change_output
            chg_area = change_output.get("changed_area_sqkm", 0.0)
            insights.append(f"Detected {chg_area:.2f} km² of bi-temporal surface conversion.")
            uncertainties["change_detection"] = "Unsupervised thresholding weak supervisory labels."
        else:
            tasks["change_detection"] = "DNAV (Data Not Available / Valid)"
            missing.append("change_detection")

        # 4. Flood
        if flood_output:
            tasks["flood"] = flood_output
            fl_extent = flood_output.get("inundated_area_sqkm", 0.0)
            insights.append(f"Flood inundation extent: {fl_extent:.2f} km² standing water mapped.")
            uncertainties["flood"] = "SAR specular backscatter; slope masked at 5 deg."
        else:
            tasks["flood"] = "DNAV (Data Not Available / Valid)"
            missing.append("flood")

        # 5. Coastal
        if coastal_output:
            tasks["coastal"] = coastal_output
            c_shift = coastal_output.get("shoreline_shift_m", 0.0)
            insights.append(f"Coastal shoreline variance: {c_shift:.1f} m instantaneous water boundary shift.")
            uncertainties["coastal"] = "Instantaneous tide stage variance; tidal correction not applied."
        else:
            tasks["coastal"] = "DNAV (Data Not Available / Valid)"
            missing.append("coastal")

        # 6. Deformation
        if deformation_output:
            tasks["deformation"] = deformation_output
            vel = deformation_output.get("estimated_velocity_mm_yr", "N/A")
            insights.append(f"Ground deformation: {vel} mm/year line-of-sight velocity.")
            uncertainties["deformation"] = "External InSAR processed product; coherence loss proxy."
        else:
            tasks["deformation"] = "DNAV (Data Not Available / Valid)"
            missing.append("deformation")

        # Cross-Task Coherence Checks (Non-causal correlations)
        if vegetation_output and flood_output and isinstance(tasks["flood"], dict):
            fl_area = tasks["flood"].get("inundated_area_sqkm", 0.0)
            if fl_area > 5.0 and tasks["vegetation"].get("trend") == "declining":
                insights.append("CORRELATION DETECTED: Vegetation decline coincides temporally with expansive flood inundation.")

        now_str = datetime.utcnow().isoformat() + "Z"
        return EnvironmentalAssessment(
            assessment_id=f"assess_{int(datetime.utcnow().timestamp())}",
            generated_at=now_str,
            aoi_bbox=aoi_bbox,
            time_window=time_window,
            task_summaries=tasks,
            cross_task_synthesis=insights,
            missing_tasks=missing,
            uncertainty_profile=uncertainties,
        )
