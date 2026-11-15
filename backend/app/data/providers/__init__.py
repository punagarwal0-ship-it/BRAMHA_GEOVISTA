"""
GEOVISTA Intelligence Data Providers Package.

Exposes modular data discovery and ingestion adapters for:
- MODIS MOD13Q1 v061 (NASA LP DAAC)
- Sentinel-2 Level-2A (Copernicus / Planetary Computer)
- Landsat 8/9 Collection 2 L2 (USGS / NASA)
- NASA Harmonized Landsat-Sentinel (HLS v2.0)
- Sentinel-1 SAR GRD/SLC (Copernicus / ASF DAAC)
- NISAR L-band & S-band (NASA-ISRO / ASF DAAC)
- UAVSAR Airborne L-band (NASA JPL / ASF DAAC)
- RADARSAT Constellation Mission (CSA / NRCan)
- RADARSAT-1 Historical Archive (CSA / ASF DAAC)
- SAOCOM 1A/1B Polarimetric L-band (CONAE Argentina)
- ESA WorldCover & JRC Global Surface Water
"""

from app.data.providers.base_provider import BaseDataProvider, SceneMetadata
from app.data.providers.nasa_earthdata import NASAEarthdataProvider
from app.data.providers.modis import MODISMod13Q1Provider
from app.data.providers.sentinel2 import Sentinel2L2AProvider
from app.data.providers.landsat import LandsatProvider
from app.data.providers.hls import HLSProvider
from app.data.providers.asf import ASFProvider
from app.data.providers.sentinel1 import Sentinel1Provider
from app.data.providers.nisar import NISARProvider
from app.data.providers.uavsar import UAVSARProvider
from app.data.providers.radarsat_rcm import RCMProvider
from app.data.providers.radarsat1 import RADARSAT1Provider
from app.data.providers.saocom import SAOCOMProvider
from app.data.providers.reference_datasets import (
    ESAWorldCoverProvider,
    GlobalSurfaceWaterProvider,
)

__all__ = [
    "BaseDataProvider",
    "SceneMetadata",
    "NASAEarthdataProvider",
    "MODISMod13Q1Provider",
    "Sentinel2L2AProvider",
    "LandsatProvider",
    "HLSProvider",
    "ASFProvider",
    "Sentinel1Provider",
    "NISARProvider",
    "UAVSARProvider",
    "RCMProvider",
    "RADARSAT1Provider",
    "SAOCOMProvider",
    "ESAWorldCoverProvider",
    "GlobalSurfaceWaterProvider",
]
