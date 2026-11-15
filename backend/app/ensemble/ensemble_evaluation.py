"""
Ensemble Evaluation and Model Selection Engine for GEOVISTA Intelligence.

Compares:
1. Each individual model
2. The best individual model
3. Each ensemble combination (weighted avg, stacking, majority vote)

RULE: If the ensemble performs worse than the best single model, retain the best single model.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.evaluation.metrics import EvaluationMetrics

logger = logging.getLogger(__name__)


class EnsembleEvaluator:
    """Evaluates and compares candidate models against ensemble pipelines on the same test set."""

    @staticmethod
    def compare_vegetation_forecasters(
        y_test: np.ndarray,
        model_predictions: dict[str, np.ndarray],
        ensemble_prediction: np.ndarray,
    ) -> dict[str, Any]:
        """
        Compare individual forecasters against ensemble on test set.
        Returns ranking and selection recommendation.
        """
        model_scores = {}
        for name, pred in model_predictions.items():
            metrics = EvaluationMetrics.regression_metrics(y_test, pred)
            model_scores[name] = metrics

        ens_metrics = EvaluationMetrics.regression_metrics(y_test, ensemble_prediction)
        model_scores["ensemble"] = ens_metrics

        # Find best individual model by lowest RMSE
        best_single_name = min(
            [k for k in model_predictions.keys()],
            key=lambda k: model_scores[k]["rmse"],
        )
        best_single_rmse = model_scores[best_single_name]["rmse"]
        ens_rmse = ens_metrics["rmse"]

        # Decision rule
        if ens_rmse < best_single_rmse:
            recommendation = (
                f"USE ENSEMBLE: Ensemble achieved lower RMSE ({ens_rmse:.4f}) "
                f"than the best individual model '{best_single_name}' ({best_single_rmse:.4f})."
            )
            selected_model = "ensemble"
        else:
            recommendation = (
                f"RETAIN SINGLE MODEL: Ensemble ({ens_rmse:.4f} RMSE) did NOT improve over "
                f"'{best_single_name}' ({best_single_rmse:.4f} RMSE). Retaining best single model."
            )
            selected_model = best_single_name

        return {
            "task": "vegetation_forecasting",
            "model_scores": model_scores,
            "best_single_model": best_single_name,
            "selected_model": selected_model,
            "decision": recommendation,
        }

    @staticmethod
    def compare_segmentation_models(
        y_test: np.ndarray,
        model_predictions: dict[str, np.ndarray],
        ensemble_prediction: np.ndarray,
        num_classes: int = 11,
    ) -> dict[str, Any]:
        """Compare land-cover classifiers and majority vote ensemble by mean IoU."""
        model_scores = {}
        for name, pred in model_predictions.items():
            metrics = EvaluationMetrics.segmentation_metrics(y_test, pred, num_classes=num_classes)
            model_scores[name] = metrics

        ens_metrics = EvaluationMetrics.segmentation_metrics(y_test, ensemble_prediction, num_classes=num_classes)
        model_scores["ensemble"] = ens_metrics

        best_single_name = max(
            [k for k in model_predictions.keys()],
            key=lambda k: model_scores[k]["mean_iou"],
        )
        best_single_miou = model_scores[best_single_name]["mean_iou"]
        ens_miou = ens_metrics["mean_iou"]

        if ens_miou > best_single_miou:
            recommendation = (
                f"USE ENSEMBLE: Majority-vote ensemble improved mean IoU ({ens_miou:.4f}) "
                f"over '{best_single_name}' ({best_single_miou:.4f})."
            )
            selected = "ensemble"
        else:
            recommendation = (
                f"RETAIN SINGLE MODEL: Ensemble ({ens_miou:.4f} mIoU) did NOT improve over "
                f"'{best_single_name}' ({best_single_miou:.4f} mIoU). Retaining '{best_single_name}'."
            )
            selected = best_single_name

        return {
            "task": "landcover_segmentation",
            "model_scores": model_scores,
            "best_single_model": best_single_name,
            "selected_model": selected,
            "decision": recommendation,
        }
