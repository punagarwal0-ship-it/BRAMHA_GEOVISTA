import { AOIGeometry, GeoJSONPoint, GeoJSONPolygon } from '../types/api';

/**
 * Calculates the geodesic surface area of a polygon in square kilometers.
 * Uses the spherical excess formula on WGS84 ellipsoid approximation (Earth radius ~6371 km).
 */
export function calculatePolygonAreaSqKm(coordinates: number[][]): number {
  if (!coordinates || coordinates.length < 3) return 0;
  
  const radius = 6371.0; // Earth radius in km
  let total = 0;
  const len = coordinates.length;

  for (let i = 0; i < len; i++) {
    const j = (i + 1) % len;
    const p1 = coordinates[i];
    const p2 = coordinates[j];

    const lon1 = (p1[0] * Math.PI) / 180;
    const lat1 = (p1[1] * Math.PI) / 180;
    const lon2 = (p2[0] * Math.PI) / 180;
    const lat2 = (p2[1] * Math.PI) / 180;

    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const area = Math.abs((total * radius * radius) / 2.0);
  return Number(area.toFixed(2));
}

/**
 * Calculates bounding box [minLon, minLat, maxLon, maxLat] from geometry
 */
export function calculateBoundingBox(geometry: AOIGeometry): [number, number, number, number] {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;

  const update = (lon: number, lat: number) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  };

  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates;
    const delta = 0.05;
    return [lon - delta, lat - delta, lon + delta, lat + delta];
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates[0]?.forEach(([lon, lat]) => update(lon, lat));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(poly => {
      poly[0]?.forEach(([lon, lat]) => update(lon, lat));
    });
  }

  return [
    Number(minLon.toFixed(4)),
    Number(minLat.toFixed(4)),
    Number(maxLon.toFixed(4)),
    Number(maxLat.toFixed(4)),
  ];
}

/**
 * Calculates the centroid [lon, lat]
 */
export function calculateCentroid(geometry: AOIGeometry): [number, number] {
  if (geometry.type === 'Point') {
    return geometry.coordinates;
  }
  const bbox = calculateBoundingBox(geometry);
  return [
    Number(((bbox[0] + bbox[2]) / 2).toFixed(4)),
    Number(((bbox[1] + bbox[3]) / 2).toFixed(4)),
  ];
}

/**
 * Generates an approximate circular polygon buffer around a [lon, lat] coordinate
 */
export function createPointBufferPolygon(center: [number, number], radiusKm: number, numSides: number = 32): GeoJSONPolygon {
  const [lon, lat] = center;
  const coords: number[][] = [];
  const earthRadiusKm = 6371.0;

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const distRatio = radiusKm / earthRadiusKm;

  for (let i = 0; i <= numSides; i++) {
    const angle = (i * 2 * Math.PI) / numSides;
    const pointLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(distRatio) +
      Math.cos(latRad) * Math.sin(distRatio) * Math.cos(angle)
    );
    const pointLonRad =
      lonRad +
      Math.atan2(
        Math.sin(angle) * Math.sin(distRatio) * Math.cos(latRad),
        Math.cos(distRatio) - Math.sin(latRad) * Math.sin(pointLatRad)
      );

    coords.push([
      Number(((pointLonRad * 180) / Math.PI).toFixed(5)),
      Number(((pointLatRad * 180) / Math.PI).toFixed(5)),
    ]);
  }

  return {
    type: 'Polygon',
    coordinates: [coords],
  };
}

/**
 * Validates a GeoJSON string or parsed object
 */
export function validateGeoJSON(input: string | any): {
  valid: boolean;
  geometry?: AOIGeometry;
  error?: string;
  name?: string;
} {
  try {
    let parsed = typeof input === 'string' ? JSON.parse(input) : input;
    let geom: any = parsed;
    let name: string = 'Custom AOI';

    if (parsed.type === 'FeatureCollection') {
      if (!parsed.features || parsed.features.length === 0) {
        return { valid: false, error: 'FeatureCollection contains no features.' };
      }
      geom = parsed.features[0].geometry;
      if (parsed.features[0].properties?.name) {
        name = parsed.features[0].properties.name;
      }
    } else if (parsed.type === 'Feature') {
      geom = parsed.geometry;
      if (parsed.properties?.name) {
        name = parsed.properties.name;
      }
    }

    if (!geom || !geom.type || !geom.coordinates) {
      return { valid: false, error: 'Invalid GeoJSON: Missing geometry or coordinates.' };
    }

    if (geom.type === 'Polygon') {
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0 || geom.coordinates[0].length < 4) {
        return { valid: false, error: 'Polygon must have at least 4 coordinates (closed ring).' };
      }
      // Check coordinates in range WGS84
      for (const [lon, lat] of geom.coordinates[0]) {
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          return { valid: false, error: 'Coordinates out of bounds (must be WGS84 EPSG:4326: lon -180..180, lat -90..90).' };
        }
      }
      return { valid: true, geometry: geom as GeoJSONPolygon, name };
    } else if (geom.type === 'MultiPolygon') {
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
        return { valid: false, error: 'MultiPolygon must contain at least one polygon.' };
      }
      for (const poly of geom.coordinates) {
        if (!Array.isArray(poly) || poly.length === 0 || poly[0].length < 4) {
          return { valid: false, error: 'Each polygon in MultiPolygon must be a closed ring with >= 4 coordinates.' };
        }
      }
      return { valid: true, geometry: geom, name };
    } else if (geom.type === 'Point') {
      const [lon, lat] = geom.coordinates;
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return { valid: false, error: 'Coordinates out of WGS84 bounds.' };
      }
      return { valid: true, geometry: geom as GeoJSONPoint, name };
    }

    return { valid: false, error: `Geometry type ${geom.type} is not yet supported. Use Polygon, MultiPolygon, or Point.` };
  } catch (err: any) {
    return { valid: false, error: `JSON parsing error: ${err.message}` };
  }
}

