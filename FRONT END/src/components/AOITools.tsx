import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Pentagon,
  Square,
  Upload,
  Trash2,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { AOI } from '../types/api';
import { CURATED_AOIS } from '../services/mockData';
import { calculateBoundingBox, calculateCentroid, calculatePolygonAreaSqKm, createPointBufferPolygon, validateGeoJSON } from '../services/geoUtils';

interface AOIToolsProps {
  activeAoi: AOI | null;
  onAoiChange: (aoi: AOI | null) => void;
  drawingMode: 'none' | 'polygon' | 'box' | 'point';
  setDrawingMode: (mode: 'none' | 'polygon' | 'box' | 'point') => void;
  pointBufferKm: number;
  setPointBufferKm: (km: number) => void;
}

export const AOITools: React.FC<AOIToolsProps> = ({
  activeAoi,
  onAoiChange,
  drawingMode,
  setDrawingMode,
  pointBufferKm,
  setPointBufferKm
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Search places or coordinates
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if query is coordinates (e.g. "88.9, 21.8" or "21.8, 88.9")
    const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      let num1 = parseFloat(coordMatch[1]);
      let num2 = parseFloat(coordMatch[3]);
      // Heuristic: lat is between -90 and 90; if num1 > 90, assume num1 is lon
      let lon = num1 > 90 || num1 < -90 ? num1 : num2;
      let lat = num1 > 90 || num1 < -90 ? num2 : num1;

      const bufferPoly = createPointBufferPolygon([lon, lat], pointBufferKm);
      const area = calculatePolygonAreaSqKm(bufferPoly.coordinates[0]);
      const bbox = calculateBoundingBox(bufferPoly);

      const aoi: AOI = {
        id: `aoi-${Date.now()}`,
        name: `Coordinate Center (${lon.toFixed(3)}, ${lat.toFixed(3)})`,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        areaSqKm: area,
        crs: 'EPSG:4326',
        bbox,
        center: [lon, lat],
        createdAt: new Date().toISOString(),
        bufferKm: pointBufferKm
      };
      onAoiChange(aoi);
      setSearchQuery('');
      return;
    }

    // Otherwise geocode via OpenStreetMap Nominatim
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lon = parseFloat(item.lon);
        const lat = parseFloat(item.lat);

        const bufferPoly = createPointBufferPolygon([lon, lat], pointBufferKm);
        const area = calculatePolygonAreaSqKm(bufferPoly.coordinates[0]);
        const bbox = calculateBoundingBox(bufferPoly);

        const aoi: AOI = {
          id: `aoi-${Date.now()}`,
          name: item.display_name.split(',')[0] || searchQuery,
          geometry: { type: 'Point', coordinates: [lon, lat] },
          areaSqKm: area,
          crs: 'EPSG:4326',
          bbox,
          center: [lon, lat],
          createdAt: new Date().toISOString(),
          bufferKm: pointBufferKm
        };
        onAoiChange(aoi);
        setSearchQuery('');
      } else {
        setUploadError(`No geographic locations found for "${searchQuery}". Try coordinates (e.g. 88.5, 21.8).`);
      }
    } catch (err) {
      setUploadError('Geocoding service unavailable. Please enter coordinates or use preset AOIs.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle GeoJSON File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit. Please upload an AOI boundary.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const validation = validateGeoJSON(text);

      if (!validation.valid || !validation.geometry) {
        setUploadError(validation.error || 'Invalid GeoJSON geometry.');
        return;
      }

      let area = 0;
      let bbox = calculateBoundingBox(validation.geometry);
      let center = calculateCentroid(validation.geometry);

      if (validation.geometry.type === 'Polygon') {
        area = calculatePolygonAreaSqKm(validation.geometry.coordinates[0]);
      } else if (validation.geometry.type === 'MultiPolygon') {
        area = validation.geometry.coordinates.reduce((sum, poly) => sum + calculatePolygonAreaSqKm(poly[0]), 0);
        area = Number(area.toFixed(2));
      } else if (validation.geometry.type === 'Point') {
        const buffered = createPointBufferPolygon(validation.geometry.coordinates, pointBufferKm);
        area = calculatePolygonAreaSqKm(buffered.coordinates[0]);
      }

      // Max AOI limit check
      const maxAoi = parseFloat(import.meta.env.VITE_MAX_AOI_SQKM || '100000');
      if (area > maxAoi) {
        setUploadError(`Area (${area.toLocaleString()} km²) exceeds allowed platform maximum of ${maxAoi.toLocaleString()} km².`);
        return;
      }

      const newAoi: AOI = {
        id: `aoi-upload-${Date.now()}`,
        name: validation.name || file.name.replace(/\.[^/.]+$/, ''),
        geometry: validation.geometry,
        areaSqKm: area,
        crs: 'EPSG:4326',
        bbox,
        center,
        createdAt: new Date().toISOString(),
        bufferKm: validation.geometry.type === 'Point' ? pointBufferKm : undefined
      };

      onAoiChange(newAoi);
      setUploadSuccess(`Successfully loaded ${newAoi.name} (${area.toLocaleString()} km²)`);
    };

    reader.onerror = () => {
      setUploadError('Failed to read uploaded file.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search place or lon, lat (e.g. 88.9, 21.8)..."
          className="w-full bg-slate-900/90 border border-geo-border focus:border-teal-400 text-xs text-slate-100 placeholder-slate-500 rounded-lg pl-8 pr-16 py-2.5 outline-none transition-colors"
        />
        <Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white text-[11px] font-semibold rounded-md transition-colors"
        >
          {isSearching ? '...' : 'Go'}
        </button>
      </form>

      {/* Geometry Draw Buttons */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
          Select or Draw AOI
        </label>
        <div className="grid grid-cols-3 gap-2">
          {/* Point Tool */}
          <button
            onClick={() => setDrawingMode(drawingMode === 'point' ? 'none' : 'point')}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all ${
              drawingMode === 'point'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-md shadow-teal-500/20'
                : 'bg-slate-800/60 border-geo-border text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <MapPin className="h-4 w-4 mb-1 text-teal-400" />
            <span className="font-medium">Point + Buffer</span>
          </button>

          {/* Polygon Tool */}
          <button
            onClick={() => setDrawingMode(drawingMode === 'polygon' ? 'none' : 'polygon')}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all ${
              drawingMode === 'polygon'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-md shadow-teal-500/20'
                : 'bg-slate-800/60 border-geo-border text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Pentagon className="h-4 w-4 mb-1 text-teal-400" />
            <span className="font-medium">Draw Polygon</span>
          </button>

          {/* Box Tool */}
          <button
            onClick={() => setDrawingMode(drawingMode === 'box' ? 'none' : 'box')}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-all ${
              drawingMode === 'box'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-md shadow-teal-500/20'
                : 'bg-slate-800/60 border-geo-border text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Square className="h-4 w-4 mb-1 text-teal-400" />
            <span className="font-medium">Draw Box</span>
          </button>
        </div>

        {/* Point Buffer Radius Slider */}
        {drawingMode === 'point' && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-teal-500/30 text-xs">
            <div className="flex justify-between items-center text-slate-300 mb-1">
              <span>Analysis Buffer Radius:</span>
              <span className="font-mono text-teal-400 font-semibold">{pointBufferKm} km</span>
            </div>
            <input
              type="range"
              min={2}
              max={50}
              step={1}
              value={pointBufferKm}
              onChange={(e) => setPointBufferKm(parseInt(e.target.value, 10))}
              className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Upload GeoJSON Boundary */}
      <div>
        <label className="relative flex items-center justify-center space-x-2 border border-dashed border-slate-700 hover:border-teal-400/70 bg-slate-900/40 hover:bg-slate-800/50 rounded-lg p-2.5 cursor-pointer transition-colors text-xs text-slate-300">
          <Upload className="h-3.5 w-3.5 text-teal-400" />
          <span>Upload GeoJSON File (.geojson / .json)</span>
          <input
            type="file"
            accept=".geojson,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {uploadError && (
          <div className="mt-2 flex items-start space-x-2 text-rose-300 bg-rose-950/40 border border-rose-800/50 p-2 rounded text-[11px]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-400" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-2 flex items-center space-x-2 text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 p-2 rounded text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>{uploadSuccess}</span>
          </div>
        )}
      </div>

      {/* Curated Pre-set Test Sites */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-teal-400" />
            Curated Reference AOIs
          </label>
        </div>
        <div className="space-y-1.5">
          {CURATED_AOIS.map((preset) => {
            const isSelected = activeAoi?.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  onAoiChange(preset);
                  setDrawingMode('none');
                  setUploadError(null);
                  setUploadSuccess(null);
                }}
                className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-teal-950/50 border-teal-400/80 text-teal-200'
                    : 'bg-slate-800/40 border-geo-border text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div>
                  <div className="font-medium truncate">{preset.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {preset.areaSqKm.toLocaleString()} km² • {preset.center[1]}°N, {preset.center[0]}°E
                  </div>
                </div>
                <ChevronRight className={`h-3.5 w-3.5 ${isSelected ? 'text-teal-400' : 'text-slate-500'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected AOI Metrics Box */}
      {activeAoi && (
        <div className="p-3 rounded-lg bg-slate-900/90 border border-teal-500/40 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-teal-300 truncate">{activeAoi.name}</span>
            <button
              onClick={() => onAoiChange(null)}
              className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
              title="Clear Active AOI"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-slate-800/50 p-1.5 rounded">
              <span className="text-slate-400 block text-[10px]">Surface Area</span>
              <span className="text-slate-100 font-semibold">{activeAoi.areaSqKm.toLocaleString()} km²</span>
              <span className="text-slate-400 text-[9px] block">({(activeAoi.areaSqKm * 100).toLocaleString()} ha)</span>
            </div>
            <div className="bg-slate-800/50 p-1.5 rounded">
              <span className="text-slate-400 block text-[10px]">CRS / Datum</span>
              <span className="text-slate-100 font-semibold">{activeAoi.crs}</span>
              <span className="text-slate-400 text-[9px] block">WGS84 Ellipsoid</span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-400 bg-slate-800/30 p-1.5 rounded">
            <span className="text-slate-500 block">Bounding Extent [W, S, E, N]:</span>
            <span className="text-slate-300">
              [{activeAoi.bbox.map((v) => v.toFixed(3)).join(', ')}]
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

