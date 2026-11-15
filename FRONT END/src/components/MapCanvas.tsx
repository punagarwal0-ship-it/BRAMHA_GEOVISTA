import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { Draw, Modify, Snap } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Compass, SplitSquareVertical } from 'lucide-react';
import { AOI, ObservationScene, LayerDefinition } from '../types/api';
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
  pointBufferKm = 15
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const aoiSourceRef = useRef<VectorSource>(new VectorSource());
  const scenesSourceRef = useRef<VectorSource>(new VectorSource());
  const drawInteractionRef = useRef<Draw | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lon: number; lat: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(5);
  const [swipePosition, setSwipePosition] = useState<number>(50); // percentage 0-100
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
            color: 'rgba(20, 184, 166, 0.18)' // Semi-transparent teal
          }),
          stroke: new Stroke({
            color: '#14b8a6', // Crisp teal border
            width: 2.5,
            lineDash: isSelected ? undefined : [6, 4]
          }),
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#14b8a6' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 })
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
            color: isCurrent ? 'rgba(245, 158, 11, 0.22)' : 'rgba(56, 189, 248, 0.08)'
          }),
          stroke: new Stroke({
            color: isCurrent ? '#f59e0b' : 'rgba(56, 189, 248, 0.6)',
            width: isCurrent ? 3 : 1.5
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
      controls: [] // Custom minimal HUD controls
    });

    // Pointer move listener for coordinates & hover
    map.on('pointermove', (evt) => {
      const coords = toLonLat(evt.coordinate);
      setMouseCoords({
        lon: Number(coords[0].toFixed(4)),
        lat: Number(coords[1].toFixed(4))
      });
    });

    // Zoom listener
    map.getView().on('change:resolution', () => {
      setZoomLevel(Math.round(map.getView().getZoom() || 5));
    });

    // Click listener to select scene footprints
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

  // Update Basemap
  useEffect(() => {
    if (!baseLayerRef.current) return;
    baseLayerRef.current.setSource(baseSources[activeBaseMap]);
  }, [activeBaseMap]);

  // Update Compare Swipe Layer Rendering
  useEffect(() => {
    const compareLayer = compareLayerRef.current;
    if (!compareLayer || !mapRef.current) return;

    if (!compareMode) {
      compareLayer.setVisible(false);
      return;
    }

    compareLayer.setVisible(true);
    compareLayer.setSource(baseSources.osm); // Visual contrast for compare split

    // Render clipping on postrender / prerender
    const handlePrerender = (event: any) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const mapSize = mapRef.current?.getSize() || [1000, 800];
      const width = mapSize[0] * (swipePosition / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, mapSize[1]);
      ctx.clip();
    };

    const handlePostrender = (event: any) => {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    };

    compareLayer.on('prerender', handlePrerender);
    compareLayer.on('postrender', handlePostrender);

    mapRef.current.render();

    return () => {
      compareLayer.un('prerender', handlePrerender);
      compareLayer.un('postrender', handlePostrender);
    };
  }, [compareMode, swipePosition]);

  // Update AOI on Map
  useEffect(() => {
    if (!aoiSourceRef.current) return;
    aoiSourceRef.current.clear();

    if (!activeAoi) return;

    const format = new GeoJSON();
    let geometry = activeAoi.geometry;

    if (geometry.type === 'Point') {
      // Buffer point to polygon for area display
      const bufferRadius = activeAoi.bufferKm || 15;
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

    // Zoom extent to AOI
    if (mapRef.current) {
      const extent = feature.getGeometry()?.getExtent();
      if (extent) {
        mapRef.current.getView().fit(extent, {
          padding: [80, 80, 80, 80],
          duration: 900,
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
          name: `Point AOI (${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}) + ${radius}km Buffer`,
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
          name: `Drawn AOI (${area.toLocaleString()} km²)`,
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
  }, [drawingMode]);

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
    const pct = (x / rect.width) * 100;
    setSwipePosition(pct);
  };

  const handleMouseUpSwipe = () => {
    isDraggingSwipe.current = false;
    window.removeEventListener('mousemove', handleMouseMoveSwipe);
    window.removeEventListener('mouseup', handleMouseUpSwipe);
  };

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    view.animate({ zoom: (view.getZoom() || 5) + 1, duration: 250 });
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    view.animate({ zoom: (view.getZoom() || 5) - 1, duration: 250 });
  };

  const handleResetExtent = () => {
    if (!mapRef.current) return;
    if (activeAoi) {
      const feat = aoiSourceRef.current.getFeatures()[0];
      if (feat && feat.getGeometry()) {
        mapRef.current.getView().fit(feat.getGeometry()!.getExtent(), {
          padding: [80, 80, 80, 80],
          duration: 700
        });
        return;
      }
    }
    const defaultLon = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LON || '85.0');
    const defaultLat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '20.5');
    mapRef.current.getView().animate({
      center: fromLonLat([defaultLon, defaultLat]),
      zoom: 5,
      duration: 700
    });
  };

  return (
    <div className="relative w-full h-full bg-[#0b0f19] overflow-hidden select-none">
      {/* OpenLayers Map Canvas Mount */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Compare Swipe Divider Line and Handle */}
      {compareMode && (
        <div
          className="absolute top-0 bottom-0 z-20 flex items-center justify-center pointer-events-none"
          style={{ left: `${swipePosition}%` }}
        >
          {/* Vertical split line */}
          <div className="w-0.5 h-full bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
          
          {/* Drag Handle */}
          <div
            onMouseDown={handleMouseDownSwipe}
            className="absolute w-9 h-9 rounded-full bg-slate-900 border-2 border-teal-400 text-teal-300 flex items-center justify-center cursor-ew-resize shadow-2xl pointer-events-auto hover:scale-110 active:scale-95 transition-transform"
            title="Drag to swipe between comparison dates"
          >
            <SplitSquareVertical className="h-4 w-4" />
          </div>

          {/* Date A / Date B labels */}
          <div className="absolute top-4 -left-32 bg-slate-900/90 border border-teal-500/40 text-teal-300 px-2.5 py-1 rounded text-[11px] font-mono shadow-lg">
            Date A: {compareDateA}
          </div>
          <div className="absolute top-4 left-6 bg-slate-900/90 border border-cyan-500/40 text-cyan-300 px-2.5 py-1 rounded text-[11px] font-mono shadow-lg">
            Date B: {compareDateB}
          </div>
        </div>
      )}

      {/* Drawing Instructions Banner */}
      {drawingMode !== 'none' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 border border-teal-500/80 text-teal-300 px-4 py-2 rounded-lg shadow-2xl flex items-center space-x-3 text-xs animate-bounce">
          <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
          <span>
            {drawingMode === 'polygon' && 'Click on the map to define polygon vertices. Double-click to close boundary.'}
            {drawingMode === 'box' && 'Click and drag across the map to draw a bounding rectangle.'}
            {drawingMode === 'point' && 'Click anywhere to drop a coordinate point and generate an analytical radius buffer.'}
          </span>
        </div>
      )}

      {/* Floating HUD Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        {/* Reset Extent */}
        <button
          onClick={handleResetExtent}
          className="h-9 w-9 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-geo-border flex items-center justify-center shadow-lg transition-all"
          title="Reset Extent / Center on AOI"
        >
          <Compass className="h-4 w-4 text-teal-400" />
        </button>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="h-9 w-9 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-geo-border flex items-center justify-center shadow-lg transition-all"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="h-9 w-9 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-geo-border flex items-center justify-center shadow-lg transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Coordinates & Scale Bar HUD */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center space-x-3 text-[11px] font-mono text-slate-300 bg-slate-900/85 px-3 py-1.5 rounded-md border border-geo-border shadow-lg">
        <div>
          <span className="text-slate-500">Lon: </span>
          <span className="text-teal-400 font-semibold">{mouseCoords ? mouseCoords.lon : '--'}°</span>
        </div>
        <div className="w-px h-3 bg-slate-700" />
        <div>
          <span className="text-slate-500">Lat: </span>
          <span className="text-teal-400 font-semibold">{mouseCoords ? mouseCoords.lat : '--'}°</span>
        </div>
        <div className="w-px h-3 bg-slate-700" />
        <div>
          <span className="text-slate-500">Zoom: </span>
          <span className="text-slate-200">{zoomLevel}</span>
        </div>
        <div className="w-px h-3 bg-slate-700" />
        <div className="text-slate-400 text-[10px]">WGS84 EPSG:4326</div>
      </div>
    </div>
  );
};
