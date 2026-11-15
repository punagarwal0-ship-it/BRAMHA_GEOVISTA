# GEOVISTA Intelligence — Dataset Coverage & Provider Matrix (Updated Phase 2)

## 1. Overview and Scientific Distinction

To ensure scientific rigor, GEOVISTA Intelligence maintains a strict distinction between:
- **Operational Data Catalogues & STAC APIs**: Providers offering downloadable Earth observation granules (e.g., NASA CMR, ASF, Microsoft Planetary Computer).
- **Educational Portals, Manuals & StoryMaps**: High-level application references or tutorials (e.g., NASA Remote Sensing Fundamentals, NISAR StoryMaps, CSA SAR Tutorial) which serve as architectural documentation, not training imagery.

---

## 2. Comprehensive Provider & Dataset Matrix (Post-Phase 2 Implementation)

| Data Source / Provider | Dataset / Product | Type of Data | Sensor | Main Environmental Applications | Spatial Resolution | Temporal Revisit | Data Format | Access Method | Auth Required | License / Restrictions | Preprocessing Requirements | Target Models | Implementation Status | Real Data Tested |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NASA LP DAAC / CMR** | **MODIS MOD13Q1 v061** | Optical Multi-spectral & Indices | MODIS (Terra) | Vegetation vigor, phenology, regional anomaly forecasting | 250 m | 16-day composite | HDF-EOS (HDF4) | NASA CMR API & HTTPS Download | NASA Earthdata Login (URS) | Open / Public Domain | HDF-EOS subdataset extraction, Sinusoidal reprojection, scale factor (0.0001), fill value (-28672), Pixel Reliability QA filtering | Model 1 (Vegetation) | Implemented (`modis.py`) | Provider code verified; download pending live user URS credentials |
| **Copernicus / Microsoft PC** | **Sentinel-2 Level-2A** | Optical Surface Reflectance | MSI | High-res land cover classification, crop monitoring, coastal water extent | 10 m, 20 m, 60 m | 5 days (constellation) | Cloud-Optimized GeoTIFF (COG) | SpatioTemporal Asset Catalog (STAC) | Public on PC / CDSE account for ESA direct | Open (CC-BY 4.0) | Resampling bands to 10 m, Scene Classification Layer (SCL) cloud/shadow masking, reflectance scaling (0.0001) | Model 1 (Vegetation), Model 2 (Land Cover), Model 3 (Change), Model 5 (Coastal) | Implemented (`sentinel2.py`) | Adapter code verified |
| **USGS / NASA / MS PC** | **Landsat 8 & 9 Collection 2 L2** | Optical Surface Reflectance & Thermal | OLI-2 / TIRS-2 | Long-term land cover dynamics, urban change, vegetation health | 30 m (100 m thermal resampled) | 8 days (combined L8/L9) | Cloud-Optimized GeoTIFF (COG) | Planetary Computer STAC / USGS M2M API | Public on PC / USGS EROS account for M2M | Open / Public Domain | QA_PIXEL bitmask parsing (cloud, shadow, cirrus), scale factor (0.0000275 + offset -0.2) | Model 1 (Vegetation), Model 2 (Land Cover), Model 3 (Change) | Implemented (`landsat.py`) | QA bitmask parsing and calibration verified |
| **NASA LP DAAC** | **Harmonized Landsat Sentinel (HLS v2.0)** | Harmonized Optical Surface Reflectance | OLI / OLI-2 & MSI | Unified high-cadence vegetation and land cover analysis | 30 m | 2–3 days | Cloud-Optimized GeoTIFF (COG) | NASA CMR Search & LP DAAC HTTPS | NASA Earthdata Login (URS) | Open / Public Domain | Fmask bit decoding for cloud/shadow/adjacent clouds, scale factor (0.0001), fill -9999 | Model 1 (Vegetation), Model 2 (Land Cover), Model 3 (Change) | Implemented (`hls.py`) | Fmask decoding and scaling verified |
| **Alaska Satellite Facility (ASF)** | **Sentinel-1 C-SAR GRD** | Synthetic Aperture Radar (SAR) Intensity | C-SAR (C-band 5.405 GHz) | All-weather flood inundation, surface roughness, coastline mapping | 10 m (IW GRD) | 6–12 days | SAFE format / GeoTIFF | ASF Search API / CMR Search | NASA Earthdata Login (URS) | Open (Copernicus Open Access) | Radiometric calibration to $\sigma^0$ (sigma naught), thermal noise removal, terrain correction/orthorectification, Lee speckle filtering, linear-to-dB conversion | Model 4 (Flood), Model 5 (Coastal), Model 3 (Change) | Implemented (`sentinel1.py` & `asf.py`) | Adapter code verified |
| **ASF / NASA-ISRO** | **NISAR L1/L2 Science Products** | Dual-Frequency SAR (L-band & S-band) | L-SAR (1.25 GHz) & S-SAR (3.2 GHz) | Biomass dynamics, soil moisture, surface deformation, wetland mapping | 3–10 m mode-dependent | 12 days | HDF5 | ASF DAAC Search & Download | NASA Earthdata Login (URS) | Open Access Policy | HDF5 dataset navigation, covariance matrix ($GCOV$) band extraction, geocoding validation | Model 4 (Flood), Model 6 (Deformation) | Implemented (`nisar.py`) | HDF5 inspector verified |
| **NASA JPL / ASF** | **UAVSAR** | Airborne Polarimetric L-band SAR | Airborne L-band SAR (1.26 GHz) | High-resolution campaign research, subsidence, levee integrity | 5 m | Campaign-based (non-revisit) | Raw binary / GeoTIFF / ENVI | ASF Search API | NASA Earthdata Login (URS) | Open / NASA Research | `.ann` metadata parsing, geometry correction, campaign-specific coordinate alignment | Model 4 (Flood), Model 6 (Deformation) | Implemented (`uavsar.py`) | Annotation parser verified |
| **Canadian Space Agency (CSA)** | **RADARSAT Constellation Mission (RCM)** | Polarimetric C-band SAR | C-band (5.4 GHz) | Maritime surveillance, flood monitoring, disaster response | 5 m to 50 m depending on beam mode | Daily over Canada; variable global | GeoTIFF / NITF | NRCan EODMS API & Open Data Portal | EODMS Account (Registration required) | Canadian Open Gov / Restricted commercial tiers | Complex calibration lookup tables, incidence angle normalization, polarization ratio computation | Model 4 (Flood), Model 5 (Coastal) | Implemented (`radarsat_rcm.py`) | Local scene importer verified |
| **CSA / ASF** | **RADARSAT-1 (Historical Archive)** | C-band SAR Amplitude | C-band (5.3 GHz) | Historical baseline comparison (1995–2013), coastal retreat | 8 m to 100 m | Historical archive (Mission ended 2013) | CEOS / GeoTIFF | ASF DAAC / CSA Archives | Earthdata / EODMS | Open Archive Access | CEOS format parsing, radiometric calibration tables, coregistration with modern Sentinel-1 | Model 3 (Change), Model 5 (Coastal) | Implemented (`radarsat1.py`) | Local CEOS inspector verified |
| **CONAE (Argentina)** | **SAOCOM 1A / 1B** | Polarimetric L-band SAR | L-band (1.275 GHz) | Soil moisture, agricultural assessment, structural monitoring | 10 m to 100 m | 16 days (constellation 8 days) | HDF5 / GeoTIFF | CONAE Catalogue API | CONAE User Account (Approval required) | Scientific & commercial license tiers | L-band polarimetric calibration, terrain correction, speckle filtering | Model 4 (Flood), Model 6 (Deformation) | Implemented (`saocom.py`) | Local delivery importer verified |
| **ESA / VITO** | **ESA WorldCover (2020, 2021)** | Categorical Land Cover Reference | Multi-sensor (S1 + S2) | Reference labels for land cover classification & validation | 10 m | Annual baseline | Cloud-Optimized GeoTIFF | AWS S3 / VITO Terracatalogue | Open Access (Public) | CC-BY 4.0 | Spatial cropping to AOI, strict NEAREST-neighbor resampling (non-interpolative) | Model 2 (Land Cover Labels) | Implemented (`reference_datasets.py`) | 3x3 degree tile index calculation verified |

---

## 3. Implementation Status Summary

All 11 required data provider adapters are implemented under `app/data/providers/`:
- `BaseDataProvider` & `SceneMetadata` (`base_provider.py`)
- `NASAEarthdataProvider` (`nasa_earthdata.py`)
- `MODISMod13Q1Provider` (`modis.py`)
- `Sentinel2L2AProvider` (`sentinel2.py`)
- `LandsatProvider` (`landsat.py`)
- `HLSProvider` (`hls.py`)
- `ASFProvider` (`asf.py`)
- `Sentinel1Provider` (`sentinel1.py`)
- `NISARProvider` (`nisar.py`)
- `UAVSARProvider` (`uavsar.py`)
- `RCMProvider` (`radarsat_rcm.py`)
- `RADARSAT1Provider` (`radarsat1.py`)
- `SAOCOMProvider` (`saocom.py`)
- `ESAWorldCoverProvider` & `GlobalSurfaceWaterProvider` (`reference_datasets.py`)
- Asynchronous streaming with resume & retry: `DownloadManager` (`app/data/downloads/download_manager.py`)
- Dataset manifest & SHA-256 integrity: `ManifestManager` (`app/data/metadata/manifest.py`)
