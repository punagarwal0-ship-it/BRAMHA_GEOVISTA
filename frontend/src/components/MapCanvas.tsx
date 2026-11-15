import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getRenderPixel } from 'ol/render';
import GeoJSON from 'ol/format/GeoJSON';
import { Draw } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { ZoomIn, ZoomOut, Compass, SplitSquareVertical } from 'lucide-react';
import { AOI, ObservationScene, LayerDefinition, DatasetRecord } from '../types/api';
import { calculateBoundingBox, calculatePolygonAreaSqKm, createPointBufferPolygon } from '../services/geoUtils';

interface MapCanvasProps {
  activeAoi: AOI | null;
  onAoiChange: (aoi: AOI | null) => void;
  scenes: ObservationScene[];
  selectedScene: ObservationScene | null;
  onSceneSelect: (scene: ObservationScene | null) => void;
  layers: LayerDefinition[];
  activeBaseMap: 'satellite' | 'dark' | 'osm';
  drawingMode: 'none' | 'polygon' | 'box' | 'point';
  onDrawingComplete: () => void;
  compareMode: boolean;
  compareDateA?: string;
  compareDateB?: string;
  compareRecordA?: DatasetRecord | null;
  compareRecordB?: DatasetRecord | null;
  swipePosition?: number;
  onSwipePositionChange?: (pos: number) => void;
  pointBufferKm?: number;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  activeAoi,
  onAoiChange,
  scenes,
  selectedScene,
  onSceneSelect,
  layers,
  activeBaseMap,
  drawingMode,
  onDrawingComplete,
  compareMode,
  compareDateA = '2023-01-15',
  compareDateB = '2024-02-15',
  compareRecordA,
  compareRecordB,
  swipePosition: controlledSwipePosition,
  onSwipePositionChange,
  pointBufferKm = 15
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const aoiSourceRef = useRef<VectorSource>(new VectorSource());
  const scenesSourceRef = useRef<VectorSource>(new VectorSource());
  const drawInteractionRef = useRef<Draw | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lon: number; lat: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(5);
  const [internalSwipe, setInternalSwipe] = useState<number>(50); // percentage 0-100
  const swipePosition = controlledSwipePosition !== undefined ? controlledSwipePosition : internalSwipe;
  const swipePositionRef = useRef<number>(swipePosition);
  swipePositionRef.current = swipePosition;
  const isDraggingSwipe = useRef<boolean>(false);

  // Basemap Tile Sources
  const baseSources = {
    satellite: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
      attributions: 'Tiles &copy; Esri, Maxar, Earthstar Geographics'
    }),
    dark: new XYZ({
      url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      maxZoom: 19,
      attributions: '&copy; CartoDB &copy; OpenStreetMap'
    }),
    osm: new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
      attributions: '&copy; OpenStreetMap contributors'
    })
  };

  // Primary Base Layer
  const baseLayerRef = useRef<TileLayer<XYZ>>(
    new TileLayer({
      source: baseSources.satellite,
      zIndex: 0
    })
  );

  // Compare Swipe Layer (Second Tile Layer clipped dynamically)
  const compareLayerRef = useRef<TileLayer<XYZ>>(
    new TileLayer({
      source: baseSources.dark,
      zIndex: 1,
      visible: false
    })
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // AOI Vector Layer Styling
    const aoiLayer = new VectorLayer({
      source: aoiSourceRef.current,
      zIndex: 10,
      style: (feature) => {
        const isSelected = feature.get('isSelected');
        return new Style({
          fill: new Fill({
            color: 'rgba(78, 203, 153, 0.16)' // Sumi-Sage green tint
          }),
          stroke: new Stroke({
            color: '#4ecb99', // Sumi-Sage accent
            width: 2,
            lineDash: isSelected ? undefined : [4, 4]
          }),
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#4ecb99' }),
            stroke: new Stroke({ color: '#ffffff', width: 1.5 })
          })
        });
      }
    });

    // Scene Footprints Layer Styling
    const scenesLayer = new VectorLayer({
      source: scenesSourceRef.current,
      zIndex: 5,
      style: (feature) => {
        const sceneId = feature.get('sceneId');
        const isCurrent = selectedScene && selectedScene.id === sceneId;
        return new Style({
          fill: new Fill({
            color: isCurrent ? 'rgba(78, 203, 153, 0.22)' : 'rgba(100, 180, 240, 0.08)'
          }),
          stroke: new Stroke({
            color: isCurrent ? '#4ecb99' : 'rgba(100, 180, 240, 0.6)',
            width: isCurrent ? 2 : 1
          })
        });
      }
    });

    const defaultLon = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LON || '85.0');
    const defaultLat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '20.5');
    const defaultZoom = parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM || '5', 10);

    const map = new Map({
      target: mapContainerRef.current,
      layers: [baseLayerRef.current, compareLayerRef.current, scenesLayer, aoiLayer],
      view: new View({
        center: fromLonLat([defaultLon, defaultLat]),
        zoom: defaultZoom,
        minZoom: 2,
        maxZoom: 18
      }),
      controls: [] // Minimal HUD
    });

    map.on('pointermove', (evt) => {
      const coords = toLonLat(evt.coordinate);
      setMouseCoords({
        lon: Number(coords[0].toFixed(4)),
        lat: Number(coords[1].toFixed(4))
      });
    });

    map.getView().on('change:resolution', () => {
      setZoomLevel(Math.round(map.getView().getZoom() || 5));
    });

    map.on('singleclick', (evt) => {
      if (drawingMode !== 'none') return;
      let clickedScene: ObservationScene | null = null;
      map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
        if (layer === scenesLayer) {
          const sc = feature.get('sceneData') as ObservationScene;
          if (sc) clickedScene = sc;
        }
      });
      if (clickedScene) {
        onSceneSelect(clickedScene);
      }
    });

    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Handle Container Resizing (e.g. sidebar collapse/expand, viewport changes)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.updateSize();
        mapRef.current.render();
      }
    });
    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Update Basemap
  useEffect(() => {
    if (!baseLayerRef.current) return;
    baseLayerRef.current.setSource(baseSources[activeBaseMap]);
  }, [activeBaseMap]);

  // Update Compare Swipe Layer Rendering with HiDPI Canvas Coordinate Transformation
  useEffect(() => {
    const compareLayer = compareLayerRef.current;
    const map = mapRef.current;
    if (!compareLayer || !map) return;

    if (!compareMode) {
      compareLayer.setVisible(false);
      return;
    }

    compareLayer.setVisible(true);
    compareLayer.setSource(baseSources.osm);

    const handlePrerender = (event: any) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const currentMap = mapRef.current;
      if (!currentMap) return;
      const mapSize = currentMap.getSize();
      if (!mapSize) return;

      const currentSwipe = swipePositionRef.current;
      const width = mapSize[0] * (currentSwipe / 100);

      let tl = [0, 0];
      let tr = [width, 0];
      let bl = [0, mapSize[1]];
      let br = [width, mapSize[1]];

      try {
        if (event.inversePixelTransform) {
          tl = getRenderPixel(event, [0, 0]);
          tr = getRenderPixel(event, [width, 0]);
          bl = getRenderPixel(event, [0, mapSize[1]]);
          br = getRenderPixel(event, [width, mapSize[1]]);
        } else {
          const dpr = window.devicePixelRatio || 1;
          tl = [0, 0];
          tr = [width * dpr, 0];
          bl = [0, mapSize[1] * dpr];
          br = [width * dpr, mapSize[1] * dpr];
        }
      } catch {
        const dpr = window.devicePixelRatio || 1;
        tl = [0, 0];
        tr = [width * dpr, 0];
        bl = [0, mapSize[1] * dpr];
        br = [width * dpr, mapSize[1] * dpr];
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tl[0], tl[1]);
      ctx.lineTo(tr[0], tr[1]);
      ctx.lineTo(br[0], br[1]);
      ctx.lineTo(bl[0], bl[1]);
      ctx.closePath();
      ctx.clip();
    };

    const handlePostrender = (event: any) => {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    };

    compareLayer.on('prerender', handlePrerender);
    compareLayer.on('postrender', handlePostrender);

    map.render();

    return () => {
      compareLayer.un('prerender', handlePrerender);
      compareLayer.un('postrender', handlePostrender);
    };
  }, [compareMode]);

  // Trigger Map Re-render when Swipe Position Changes
  useEffect(() => {
    if (compareMode && mapRef.current) {
      mapRef.current.render();
    }
  }, [swipePosition, compareMode]);

  // Update AOI on Map
  useEffect(() => {
    if (!aoiSourceRef.current) return;
    aoiSourceRef.current.clear();

    if (!activeAoi) return;

    const format = new GeoJSON();
    let geometry = activeAoi.geometry;

    if (geometry.type === 'Point') {
      const bufferRadius = activeAoi.bufferKm || pointBufferKm || 15;
      geometry = createPointBufferPolygon(geometry.coordinates, bufferRadius);
    }

    const feature = format.readFeature(
      {
        type: 'Feature',
        geometry,
        properties: { name: activeAoi.name, isSelected: true }
      },
      {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      }
    ) as Feature<Polygon>;

    aoiSourceRef.current.addFeature(feature);

    if (mapRef.current) {
      const extent = feature.getGeometry()?.getExtent();
      if (extent) {
        mapRef.current.getView().fit(extent, {
          padding: [60, 60, 60, 60],
          duration: 600,
          maxZoom: 12
        });
      }
    }
  }, [activeAoi]);

  // Update Scene Footprints on Map
  useEffect(() => {
    if (!scenesSourceRef.current) return;
    scenesSourceRef.current.clear();

    const format = new GeoJSON();
    scenes.forEach((sc) => {
      const feat = format.readFeature(
        {
          type: 'Feature',
          geometry: sc.footprint,
          properties: {
            sceneId: sc.id,
            sceneData: sc
          }
        },
        {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857'
        }
      );
      if (Array.isArray(feat)) {
        scenesSourceRef.current.addFeatures(feat as Feature<Polygon>[]);
      } else {
        scenesSourceRef.current.addFeature(feat as Feature<Polygon>);
      }
    });
  }, [scenes, selectedScene]);

  // Handle Drawing Interactions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }

    if (drawingMode === 'none') return;

    let draw: Draw;
    if (drawingMode === 'polygon') {
      draw = new Draw({
        source: aoiSourceRef.current,
        type: 'Polygon'
      });
    } else if (drawingMode === 'box') {
      draw = new Draw({
        source: aoiSourceRef.current,
        type: 'Circle',
        geometryFunction: createBox()
      });
    } else if (drawingMode === 'point') {
      draw = new Draw({
        source: aoiSourceRef.current,
        type: 'Point'
      });
    } else {
      return;
    }

    draw.on('drawend', (evt) => {
      const geom = evt.feature.getGeometry();
      if (!geom) return;

      const format = new GeoJSON();
      const geojsonGeom: any = format.writeGeometryObject(geom, {
        featureProjection: 'EPSG:3857',
        dataProjection: 'EPSG:4326'
      });

      if (drawingMode === 'point') {
        const coords = geojsonGeom.coordinates as [number, number];
        const radius = pointBufferKm || 15;
        const buffered = createPointBufferPolygon(coords, radius);
        const area = calculatePolygonAreaSqKm(buffered.coordinates[0]);
        const bbox = calculateBoundingBox(buffered);

        const newAoi: AOI = {
          id: `aoi-${Date.now()}`,
          name: `Point AOI (${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}) + ${radius}km buffer`,
          geometry: { type: 'Point', coordinates: coords },
          areaSqKm: area,
          crs: 'EPSG:4326',
          bbox,
          center: coords,
          createdAt: new Date().toISOString(),
          bufferKm: radius
        };
        onAoiChange(newAoi);
      } else {
        const area = calculatePolygonAreaSqKm(geojsonGeom.coordinates[0]);
        const bbox = calculateBoundingBox(geojsonGeom);
        const center = [Number(((bbox[0] + bbox[2]) / 2).toFixed(4)), Number(((bbox[1] + bbox[3]) / 2).toFixed(4))] as [number, number];

        const newAoi: AOI = {
          id: `aoi-${Date.now()}`,
          name: `Drawn area (${area.toLocaleString()} km²)`,
          geometry: geojsonGeom,
          areaSqKm: area,
          crs: 'EPSG:4326',
          bbox,
          center,
          createdAt: new Date().toISOString()
        };
        onAoiChange(newAoi);
      }

      onDrawingComplete();
    });

    map.addInteraction(draw);
    drawInteractionRef.current = draw;

    return () => {
      if (drawInteractionRef.current && map) {
        map.removeInteraction(drawInteractionRef.current);
      }
    };
  }, [drawingMode, pointBufferKm]);

  // Swipe dragging handlers
  const handleMouseDownSwipe = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSwipe.current = true;
    window.addEventListener('mousemove', handleMouseMoveSwipe);
    window.addEventListener('mouseup', handleMouseUpSwipe);
  };

  const handleMouseMoveSwipe = (e: MouseEvent) => {
    if (!isDraggingSwipe.current || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
    if (onSwipePositionChange) {
      onSwipePositionChange(pct);
    } else {
      setInternalSwipe(pct);
    }
  };

  const handleMouseUpSwipe = () => {
    isDraggingSwipe.current = false;
    window.removeEventListener('mousemove', handleMouseMoveSwipe);
    window.removeEventListener('mouseup', handleMouseUpSwipe);
  };

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    view.animate({ zoom: (view.getZoom() || 5) + 1, duration: 200 });
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    view.animate({ zoom: (view.getZoom() || 5) - 1, duration: 200 });
  };

  const handleResetExtent = () => {
    if (!mapRef.current) return;
    if (activeAoi) {
      const feat = aoiSourceRef.current.getFeatures()[0];
      if (feat && feat.getGeometry()) {
        mapRef.current.getView().fit(feat.getGeometry()!.getExtent(), {
          padding: [60, 60, 60, 60],
          duration: 500
        });
        return;
      }
    }
    const defaultLon = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LON || '85.0');
    const defaultLat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '20.5');
    mapRef.current.getView().animate({
      center: fromLonLat([defaultLon, defaultLat]),
      zoom: 5,
      duration: 500
    });
  };

  return (
    <div className="relative w-full h-full bg-paper-3 overflow-hidden select-none">
      {/* OpenLayers Map Canvas Mount */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Compare Swipe Divider Line and Handle */}
      {compareMode && (
        <div
          className="absolute top-0 bottom-0 z-20 flex items-center justify-center pointer-events-none"
          style={{ left: `${swipePosition}%` }}
        >
          {/* Vertical split line */}
          <div className="w-px h-full bg-rule-2" />
          
          {/* Drag Handle (34px) */}
          <div
            onMouseDown={handleMouseDownSwipe}
            className="absolute w-[34px] h-[34px] rounded-control bg-paper-2 border border-rule-2 text-ink flex items-center justify-center cursor-ew-resize pointer-events-auto transition-transform active:scale-95 shadow-md"
            title="Drag to swipe between comparison dates"
          >
            <SplitSquareVertical className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>

          {/* Record A / Record B labels */}
          <div className="absolute top-4 -left-48 bg-paper-2 rounded-control border border-rule text-ink px-2.5 py-1 text-xs font-mono tabular-nums truncate max-w-[180px]">
            {compareRecordA
              ? `A: ${compareRecordA.timestamp.slice(0, 10)} (${compareRecordA.recordId})`
              : `Date A: ${compareDateA}`}
          </div>
          <div className="absolute top-4 left-6 bg-paper-2 rounded-control border border-rule text-ink-2 px-2.5 py-1 text-xs font-mono tabular-nums truncate max-w-[180px]">
            {compareRecordB
              ? `B: ${compareRecordB.timestamp.slice(0, 10)} (${compareRecordB.recordId})`
              : `Date B: ${compareDateB}`}
          </div>
        </div>
      )}

      {/* Drawing Instructions Banner */}
      {drawingMode !== 'none' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-paper-2 rounded-control border border-rule-2 text-ink px-4 py-2 flex items-center space-x-2 text-xs shadow-md">
          <span className="h-2 w-2 rounded-full bg-ink shrink-0" />
          <span>
            {drawingMode === 'polygon' && 'Click on the map to define vertices; double-click to close boundary.'}
            {drawingMode === 'box' && 'Click and drag across the map to draw a bounding rectangle.'}
            {drawingMode === 'point' && 'Click anywhere to drop a coordinate point and generate an analytical radius buffer.'}
          </span>
        </div>
      )}

      {/* Floating HUD Controls (34px Rows with 2px Gaps) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-[2px]">
        <button
          onClick={handleResetExtent}
          className="h-[34px] w-[34px] rounded-control bg-paper-2 hover:bg-paper-surface text-muted hover:text-ink border border-rule flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Reset extent"
          aria-label="Reset extent"
        >
          <Compass className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        </button>

        <button
          onClick={handleZoomIn}
          className="h-[34px] w-[34px] rounded-control bg-paper-2 hover:bg-paper-surface text-muted hover:text-ink border border-rule flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>

        <button
          onClick={handleZoomOut}
          className="h-[34px] w-[34px] rounded-control bg-paper-2 hover:bg-paper-surface text-muted hover:text-ink border border-rule flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* Bottom Coordinates & Scale Bar HUD (Quiet 34px Row) */}
      <div className="absolute bottom-4 left-4 z-10 h-[34px] flex items-center space-x-3 text-xs text-muted bg-paper-2 px-3 rounded-control border border-rule shadow-sm">
        <div>
          <span className="text-muted-2">Lon: </span>
          <span className="text-ink font-mono tabular-nums">{mouseCoords ? mouseCoords.lon : '--'}°</span>
        </div>
        <div className="w-px h-3 bg-rule" />
        <div>
          <span className="text-muted-2">Lat: </span>
          <span className="text-ink font-mono tabular-nums">{mouseCoords ? mouseCoords.lat : '--'}°</span>
        </div>
        <div className="w-px h-3 bg-rule" />
        <div>
          <span className="text-muted-2">Zoom: </span>
          <span className="text-ink font-mono tabular-nums">{zoomLevel}</span>
        </div>
        <div className="w-px h-3 bg-rule" />
        <div className="text-muted-2 text-xs">WGS84 EPSG:4326</div>
      </div>
    </div>
  );
};
