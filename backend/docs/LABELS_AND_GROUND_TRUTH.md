# GEOVISTA Intelligence — Labels & Ground Truth Strategy (Updated Phase 4)

## 1. Principles of Ground Truth in Geospatial AI

In remote sensing and Earth observation machine learning, the definition of "ground truth" requires extreme scientific discipline:
1. **Never Manufacture Pseudo-Labels as True Ground Truth**: While unsupervised thresholding (e.g., Otsu water masks, spectral index differences, or coherence drop) provides helpful weak supervisory signals, they contain severe sensor, seasonal, and environmental biases. They must never be presented as validated ground truth.
2. **Account for Spatial Resolution and Sensor Mismatches**: A 10 m land cover reference label cannot be matched directly to a 250 m MODIS pixel without explicit aggregation and fractional accounting.
3. **Respect Temporal Compatibility**: Earth surfaces change rapidly. Using a 2020 land cover map to supervise 2024 satellite imagery will inject false positive errors (e.g., urban growth mislabeled as agriculture).
4. **Mandatory Nearest-Neighbor Resampling for Categorical Labels**: Categorical land cover labels must NEVER be resampled using bilinear, bicubic, or lanczos interpolation, which create non-existent intermediate class IDs.

---

## 2. Model-by-Model Label Specifications & Data Loaders

| Task | Input Tensor Spec | Target Label Spec | Authoritative Label Source | Scientific Uncertainties & Limitations | Loader Class |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Vegetation** | `[T=12, C=4]` (NDVI, EVI, DOY_sin, DOY_cos) | `[H=6]` (Future continuous NDVI) | MODIS MOD13Q1 / S2 time series | 16-day composites represent maximum-value synthesis; cloudy and marginal observations require QA weighting. Chronological splitting strictly enforced. | `VegetationDataset` |
| **2. Land Cover** | `[C=6, H, W]` (Multi-spectral surface reflectance) | `[H, W]` (Discrete class 0–10; 255=ignore) | ESA WorldCover 10m (2020/2021) | Temporal lag between reference year and image acquisition; regional confusion between open canopy and shrubland. Spatial tile block splitting required. | `LandCoverDataset` |
| **3. Change Detection** | `t1:[C, H, W]`, `t2:[C, H, W]` | `[1, H, W]` (Binary change 0/1) | Bi-temporal image pairs / Callsets (Deforestation / Disasters) | Heuristic index differencing produces pseudo-labels with high false positive rates; pairs must be kept in the same split. | `ChangeDetectionDataset` |
| **4. Flood Inundation** | `[C=2, H, W]` (SAR VV dB, VH dB) | `[1, H, W]` (Binary flood mask) | Copernicus EMS Rapid Mapping | Smooth airport runways cause false positive specular reflection; wind waves roughen water causing false negatives. DEM slope thresholding applied. | `FloodDataset` |
| **5. Coastal Monitoring** | `[C=4, H, W]` (Optical / SAR bands) | `[1, H, W]` (Binary water mask) | MNDWI & SAR backscatter edge detection | Tidal variance causes water boundary shifts without physical shoreline erosion. Instantaneous tide state must be documented. | `CoastalDataset` |
| **6. Ground Deformation** | `[C=3, H, W]` (Coherence delta, SAR backscatter, DEM) | `[1, H, W]` (Disturbance index) | External InSAR LOS / Coherence proxy | Raw SAR amplitude cannot measure millimeter surface displacement. Coherence loss is a proxy indicator of disturbance, not physical deformation. | `DeformationDataset` |

---

## 3. Data Leakage Prevention Strategy

GEOVISTA enforces two strict splitting protocols (`LeakageFreeSplitter`):
1. **Chronological Splitting (`chronological_split`)**:
   - Used for all time-series and forecasting tasks (Vegetation).
   - Train set: $\{t_0 \dots t_{train}\}$.
   - Validation set: $\{t_{train+1} \dots t_{val}\}$.
   - Test set: strictly future-held-out $\{t_{val+1} \dots t_{end}\}$.
   - Random temporal splitting is strictly prohibited.
2. **Spatial Tile Block Splitting (`spatial_block_split`)**:
   - Used for all spatial segmentation tasks (Land Cover, Flood, Change, Coastal, Deformation).
   - Divides the region of interest into discrete spatial grid blocks.
   - Entire blocks (and their adjacent patches) are assigned exclusively to either train, validation, or test.
   - Prevents spatial autocorrelation leakage between adjacent patches of the same satellite scene.

---

## 4. Verification and Smoke-Test Datasets

The repository includes an in-memory smoke-test generator (`app/data/labels/smoke_data.py`) which generates verified mini-batches across all six task loaders:
- Tested batch dimensions:
  - Vegetation: $x \in \mathbb{R}^{2 \times 12 \times 4}$, $y \in \mathbb{R}^{2 \times 6}$
  - Land Cover: $\text{image} \in \mathbb{R}^{2 \times 6 \times 64 \times 64}$, $\text{mask} \in \mathbb{Z}^{2 \times 64 \times 64}$
  - Change Detection: $t_1, t_2 \in \mathbb{R}^{2 \times 4 \times 64 \times 64}$, $\text{mask} \in \mathbb{R}^{2 \times 1 \times 64 \times 64}$
  - Flood: $\text{sar} \in \mathbb{R}^{2 \times 2 \times 64 \times 64}$, $\text{mask} \in \mathbb{R}^{2 \times 1 \times 64 \times 64}$
  - Coastal: $\text{image} \in \mathbb{R}^{2 \times 4 \times 64 \times 64}$, $\text{mask} \in \mathbb{R}^{2 \times 1 \times 64 \times 64}$
  - Deformation: $\text{features} \in \mathbb{R}^{2 \times 3 \times 64 \times 64}$, $\text{target} \in \mathbb{R}^{2 \times 1 \times 64 \times 64}$
