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
- If the ensemble combination does not strictly achieve a lower $\text{RMSE}$ (or higher mIoU/F1) than the single best constituent model on the validation dataset, the ensemble is **rejected**, and the single best model is retained.
- Prevents degradation caused by averaging strong deep learning models with weaker baselines.

---

## 4. Cross-Task Environmental Intelligence Synthesis

The synthesis layer aggregates outputs across active specialist domains:
1. **Compound Hazard Identification:**
   - *Agricultural Flood Hazard:* Detected when high water probability co-occurs with rapid vegetation NDVI drop.
   - *Coastal Subsidence Risk:* Detected when significant ground deformation ($< -10\text{ mm/yr}$) aligns with shoreline retreat.
2. **Missing Observation Integrity:**
   - Tasks without active observations are tagged as `DNAV (Data Not Available / Valid)`.
   - Never hallucinates unobserved physical layers.

---

## 5. Execution Command

Run the ensemble benchmarking suite via PowerShell:
```powershell
cd "c:\Users\punag\Downloads\NASA SPACE APPS unzipped\NASA SPACE APPS\backend"
& "C:\Users\punag\anaconda3\envs\geovista\python.exe" -m app.ensemble.run_ensemble
```
