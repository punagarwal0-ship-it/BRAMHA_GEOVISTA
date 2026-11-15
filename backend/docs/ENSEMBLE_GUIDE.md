# GEOVISTA Intelligence — Ensemble Guide & Evaluation Strategy

## 1. Ensemble Architecture Overview

In Earth observation machine learning, models target fundamentally different physical phenomena with distinct spatial, radiometric, and temporal dimensions. GEOVISTA Intelligence enforces a task-aware multi-layer ensemble architecture:

```
+-----------------------------------------------------------------------------------------+
|                                SPECIALIST MODEL PREDICTIONS                             |
|                                                                                         |
|  [Vegetation (NDVI)]   [Land Cover (LULC)]   [Change Mask]   [Flood (SAR)]   [Coastal]  |
+-----------|---------------------|------------------|---------------|-------------|------+
            |                     |                  |               |             |
            v                     v                  |               v             v
+-----------------------+ +-----------------------+  |   +-------------------------------+
|  WITHIN-TASK ENSEMBLE | |  WITHIN-TASK ENSEMBLE |  |   |    MULTI-SENSOR LATE FUSION   |
| (Weighted Avg/Stacking| |    (Majority Vote)    |  |   |   (Optical MNDWI + SAR VV dB) |
+-----------|-----------+ +-----------|-----------+  |   +---------------|---------------+
            |                         |              |                   |
            +-------------------------+--------------+-------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------------+
|                         CROSS-TASK ENVIRONMENTAL INTELLIGENCE LAYER                     |
|                                                                                         |
|  * Preserves each specialist model's physical units and geographic extent.              |
|  * NEVER averages incompatible metrics (e.g. NDVI and flood probability).               |
|  * Identifies cross-task non-causal correlations (e.g. flood-induced canopy dieback).   |
|  * Reports DNAV (Data Not Available / Valid) for unobserved layers.                     |
|  * Provides structured uncertainty profiles and physical limitations.                   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Within-Task Ensemble Methods

### A. Weighted Averaging & Out-of-Fold Stacking (Vegetation Forecasting)
- Candidate models: Climatological baseline, Random Forest, PyTorch LSTM, PyTorch TCN.
- **Weights Formulation**: Weights are derived strictly from validation set Root Mean Square Error ($\text{RMSE}$):
  $$w_i = \frac{\exp(-\beta \cdot \text{RMSE}_i)}{\sum_j \exp(-\beta \cdot \text{RMSE}_j)}$$
- **Stacking Meta-Learner**: Fits a regularized non-negative linear model on out-of-fold (OOF) cross-validation predictions to prevent data leakage.

### B. Majority Voting (Land Cover Semantic Segmentation)
- Combines pixel-level predictions across independent model architectures (e.g., U-Net vs Random Forest).
- Class assignment per pixel:
  $$\hat{Y}_{r, c} = \operatorname{argmax}_{k \in \{0 \dots 10\}} \sum_{m=1}^{M} \mathbb{I}(Y_{m, r, c} = k)$$

### C. Multi-Sensor Late Fusion (Flood & Coastal Inundation)
- Combines optical surface water indices (MNDWI) with all-weather radar backscatter (Sentinel-1 SAR VV).
- **Adaptive Cloud Weighting**:
  - Clear skies ($< 40\%$ clouds): $50\%$ Optical $+ 50\%$ SAR.
  - Cloud-obscured ($> 40\%$ clouds): $85\%$ SAR $+ 15\%$ Optical.
  - SAR-only if optical unavailable; Optical-only if SAR unacquired.

---

## 3. Strict Decision Rule: Ensemble vs. Best Individual Model

GEOVISTA enforces an uncompromising scientific verification rule (`EnsembleEvaluator`):
1. Evaluate every individual specialist model on the **exact same independent test dataset**.
2. Evaluate the ensemble pipeline on the same test dataset.
3. Compare the ensemble performance against the best individual model:
   - If the ensemble achieves superior performance (lower RMSE for forecasting, higher mean IoU for segmentation), select the ensemble.
   - **If the ensemble does not improve performance, retain the best individual model.** Never claim an ensemble is superior without empirical validation.

---

## 4. Handling Missing Data (DNAV)

When a specific satellite scene, provider, or model output is unavailable for an AOI or temporal window:
- The system emits `DNAV (Data Not Available / Valid)` for that layer.
- Missing values are never fabricated with artificial numbers.
- The Cross-Task Intelligence Layer flags the missing component in the uncertainty profile and excludes it from cross-task synthesis.
