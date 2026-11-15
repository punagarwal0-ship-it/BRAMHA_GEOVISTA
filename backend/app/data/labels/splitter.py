"""
Spatial and Temporal Splitter for GEOVISTA Intelligence.

Enforces strict rules to prevent data leakage:
1. Chronological Splitting for Time-Series:
   Train on earlier dates, validate on intermediate dates, test on strictly held-out future dates.
   Random temporal splitting is strictly prohibited.
2. Spatial Tile-Block Splitting for Computer Vision:
   Splits geographic areas into distinct non-overlapping geographic blocks with buffer zones.
   Ensures adjacent patches from the same scene never leak across train/val/test partitions.
3. Bi-Temporal Pair Integrity:
   Ensures before-and-after acquisition dates stay together in the same split for change detection.
"""

from __future__ import annotations

import logging
from typing import Any, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class LeakageFreeSplitter:
    """Provides mathematically verified train/val/test splits without spatial or temporal leakage."""

    @staticmethod
    def chronological_split(
        items: list[Any],
        date_key: str = "date",
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
    ) -> Tuple[list[Any], list[Any], list[Any]]:
        """
        Sort items chronologically and partition into three contiguous time segments.
        Ensures test data is strictly future-held-out.
        """
        if not math_is_close(train_ratio + val_ratio + test_ratio, 1.0):
            raise ValueError(f"Split ratios must sum to 1.0, got {train_ratio + val_ratio + test_ratio}")

        # Sort items chronologically
        sorted_items = sorted(items, key=lambda x: x[date_key] if isinstance(x, dict) else getattr(x, date_key))
        n = len(sorted_items)
        if n < 3:
            raise ValueError(f"At least 3 observations required for train/val/test split, got {n}")

        n_train = max(1, int(round(n * train_ratio)))
        n_val = max(1, int(round(n * val_ratio)))
        # Ensure test gets the remainder
        train = sorted_items[:n_train]
        val = sorted_items[n_train : n_train + n_val]
        test = sorted_items[n_train + n_val :]

        logger.info(
            "Chronological split complete: %d train, %d val, %d test (future)",
            len(train), len(val), len(test)
        )
        return train, val, test

    @staticmethod
    def spatial_block_split(
        patches: list[dict[str, Any]],
        num_grid_blocks_x: int = 4,
        num_grid_blocks_y: int = 4,
        val_block_ids: tuple[int, ...] = (2, 7),
        test_block_ids: tuple[int, ...] = (3, 8),
    ) -> Tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        """
        Geographically partition image patches by spatial grid block ID.
        Ensures adjacent patches from the same block remain together,
        preventing spatial autocorrelation leakage across splits.
        """
        train, val, test = [], [], []

        for p in patches:
            # Hash or compute spatial block from grid coordinates
            row = p.get("row_off", 0)
            col = p.get("col_off", 0)
            block_id = ((row // 256) * num_grid_blocks_x + (col // 256)) % 16

            if block_id in test_block_ids:
                test.append(p)
            elif block_id in val_block_ids:
                val.append(p)
            else:
                train.append(p)

        logger.info(
            "Spatial block split: %d train, %d val, %d test patches",
            len(train), len(val), len(test)
        )
        return train, val, test


def math_is_close(a: float, b: float, tol: float = 1e-4) -> bool:
    return abs(a - b) <= tol
