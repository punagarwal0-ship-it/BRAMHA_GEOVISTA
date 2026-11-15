"""
Standardized Evaluation Metrics Suite for GEOVISTA Intelligence.

Covers:
- Classification: Accuracy, Precision, Recall, F1, Confusion Matrix
- Segmentation: IoU, Mean IoU, Dice Score, Per-Class Breakdown
- Forecasting/Regression: MAE, RMSE, R², Per-Horizon Errors
- Change Detection: Precision, Recall, F1, IoU
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import numpy as np


class EvaluationMetrics:
    """Standardized metrics calculator with zero external dependencies."""

    @staticmethod
    def regression_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        horizons: Optional[list[int]] = None,
    ) -> dict[str, Any]:
        """Compute MAE, RMSE, R2, and horizon-wise breakdown."""
        valid = ~np.isnan(y_true) & ~np.isnan(y_pred)
        if not np.any(valid):
            return {"error": "DNAV (Data Not Available / Valid)"}

        t = y_true[valid]
        p = y_pred[valid]

        mae = float(np.mean(np.abs(t - p)))
        rmse = float(np.sqrt(np.mean((t - p) ** 2)))
        ss_res = np.sum((t - p) ** 2)
        ss_tot = np.sum((t - np.mean(t)) ** 2)
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-8)))

        report: dict[str, Any] = {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
            "valid_samples": int(np.sum(valid)),
        }

        # Per-horizon error if array is 2D [N, H]
        if y_true.ndim == 2 and y_pred.ndim == 2 and y_true.shape[1] > 1:
            h_count = y_true.shape[1]
            h_mae = {}
            for h in range(h_count):
                v_h = ~np.isnan(y_true[:, h]) & ~np.isnan(y_pred[:, h])
                if np.any(v_h):
                    h_mae[f"horizon_{h+1}"] = round(float(np.mean(np.abs(y_true[v_h, h] - y_pred[v_h, h]))), 4)
            report["per_horizon_mae"] = h_mae

        return report

    @staticmethod
    def classification_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        num_classes: int,
        class_names: Optional[list[str]] = None,
        ignore_index: int = 255,
    ) -> dict[str, Any]:
        """Compute overall accuracy, per-class precision, recall, F1, and confusion matrix."""
        valid = (y_true != ignore_index) & (y_pred != ignore_index)
        if not np.any(valid):
            return {"error": "DNAV (Data Not Available / Valid)"}

        t = y_true[valid].astype(np.int64)
        p = y_pred[valid].astype(np.int64)

        oa = float(np.mean(t == p))

        # Confusion matrix
        cm = np.zeros((num_classes, num_classes), dtype=np.int64)
        for true_c, pred_c in zip(t, p):
            if 0 <= true_c < num_classes and 0 <= pred_c < num_classes:
                cm[true_c, pred_c] += 1

        per_class = {}
        for c in range(num_classes):
            c_name = class_names[c] if class_names and c < len(class_names) else f"class_{c}"
            tp = cm[c, c]
            fp = np.sum(cm[:, c]) - tp
            fn = np.sum(cm[c, :]) - tp

            prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
            rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
            f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

            per_class[c_name] = {
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1": round(f1, 4),
                "support": int(np.sum(cm[c, :])),
            }

        macro_f1 = float(np.mean([v["f1"] for v in per_class.values()]))

        return {
            "overall_accuracy": round(oa, 4),
            "macro_f1": round(macro_f1, 4),
            "per_class_metrics": per_class,
            "confusion_matrix": cm.tolist(),
        }

    @staticmethod
    def segmentation_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
        num_classes: int,
        class_names: Optional[list[str]] = None,
        ignore_index: int = 255,
    ) -> dict[str, Any]:
        """Compute IoU, mean IoU, and Dice score per class."""
        valid = (y_true != ignore_index) & (y_pred != ignore_index)
        if not np.any(valid):
            return {"error": "DNAV (Data Not Available / Valid)"}

        t = y_true[valid]
        p = y_pred[valid]

        per_class_iou = {}
        per_class_dice = {}
        for c in range(num_classes):
            c_name = class_names[c] if class_names and c < len(class_names) else f"class_{c}"
            t_c = t == c
            p_c = p == c
            inter = np.logical_and(t_c, p_c).sum()
            union = np.logical_or(t_c, p_c).sum()

            iou = float(inter / union) if union > 0 else 0.0
            dice = float((2 * inter) / (t_c.sum() + p_c.sum())) if (t_c.sum() + p_c.sum()) > 0 else 0.0

            per_class_iou[c_name] = round(iou, 4)
            per_class_dice[c_name] = round(dice, 4)

        valid_ious = list(per_class_iou.values())
        miou = float(np.mean(valid_ious)) if valid_ious else 0.0

        return {
            "mean_iou": round(miou, 4),
            "per_class_iou": per_class_iou,
            "per_class_dice": per_class_dice,
        }

    @staticmethod
    def binary_change_metrics(
        y_true: np.ndarray,
        y_pred: np.ndarray,
    ) -> dict[str, Any]:
        """Precision, recall, F1, and IoU for binary change / flood detection."""
        valid = ~np.isnan(y_true) & ~np.isnan(y_pred)
        if not np.any(valid):
            return {"error": "DNAV (Data Not Available / Valid)"}

        t = (y_true[valid] > 0.5).astype(bool)
        p = (y_pred[valid] > 0.5).astype(bool)

        tp = int(np.logical_and(t, p).sum())
        fp = int(np.logical_and(~t, p).sum())
        fn = int(np.logical_and(t, ~p).sum())

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        iou = float(tp / (tp + fp + fn)) if (tp + fp + fn) > 0 else 0.0

        return {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "iou": round(iou, 4),
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
        }
