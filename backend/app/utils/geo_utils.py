"""
Geospatial and geometric utilities for GEOVISTA Intelligence.

Handles:
- Bounding box validation, expansion, and conversion
- GeoJSON geometry manipulation
- CRS checks and coordinate transformations
- Affine transform and window calculation
- Safe raster alignment logic
"""

from __future__ import annotations

import math
from typing import Any, Optional


def validate_bbox(bbox: list[float]) -> None:
    """Validate bounding box [min_lon, min_lat, max_lon, max_lat]."""
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        raise ValueError(f"Bounding box must have 4 coordinates [min_lon, min_lat, max_lon, max_lat], got {bbox}")
    min_lon, min_lat, max_lon, max_lat = bbox
    if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
        raise ValueError(f"Longitude values must be within [-180, 180], got [{min_lon}, {max_lon}]")
    if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
        raise ValueError(f"Latitude values must be within [-90, 90], got [{min_lat}, {max_lat}]")
    if min_lon > max_lon:
        raise ValueError(f"min_lon ({min_lon}) cannot exceed max_lon ({max_lon})")
    if min_lat > max_lat:
        raise ValueError(f"min_lat ({min_lat}) cannot exceed max_lat ({max_lat})")


def bbox_to_polygon(bbox: list[float]) -> dict[str, Any]:
    """Convert [min_lon, min_lat, max_lon, max_lat] to GeoJSON Polygon dict."""
    validate_bbox(bbox)
    w, s, e, n = bbox
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
            ]
        ],
    }


def bbox_from_geojson(geojson_geom: dict[str, Any]) -> list[float]:
    """Extract bounding box [min_lon, min_lat, max_lon, max_lat] from GeoJSON Polygon."""
    gtype = geojson_geom.get("type")
    coords = geojson_geom.get("coordinates", [])
    if gtype == "Polygon" and coords:
        ring = coords[0]
        lons = [pt[0] for pt in ring]
        lats = [pt[1] for pt in ring]
        return [min(lons), min(lats), max(lons), max(lats)]
    raise ValueError(f"Unsupported or empty GeoJSON geometry: {gtype}")


def calculate_area_sqkm(bbox: list[float]) -> float:
    """Calculate approximate ellipsoidal surface area in km² for a WGS-84 bounding box."""
    validate_bbox(bbox)
    w, s, e, n = bbox
    rad = math.pi / 180.0
    r = 6378.137  # Earth radius in km
    d_lon = abs(e - w) * rad
    d_lat_sin = abs(math.sin(n * rad) - math.sin(s * rad))
    return float(r * r * d_lon * d_lat_sin)
