import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Pentagon,
  Square,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Compass
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      let num1 = parseFloat(coordMatch[1]);
      let num2 = parseFloat(coordMatch[3]);
      let lon = num1 > 90 || num1 < -90 ? num1 : num2;
      let lat = num1 > 90 || num1 < -90 ? num2 : num1;

      const bufferPoly = createPointBufferPolygon([lon, lat], pointBufferKm);
      const area = calculatePolygonAreaSqKm(bufferPoly.coordinates[0]);
      const bbox = calculateBoundingBox(bufferPoly);

      const aoi: AOI = {
        id: `aoi-${Date.now()}`,
        name: `Center (${lon.toFixed(3)}, ${lat.toFixed(3)})`,
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
        setUploadError(`No locations found for "${searchQuery}". Enter coordinates like 88.5, 21.8.`);
      }
    } catch {
      setUploadError('Geocoding service unavailable. Enter coordinates or pick a reference site.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit.');
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

      const maxAoi = parseFloat(import.meta.env.VITE_MAX_AOI_SQKM || '100000');
      if (area > maxAoi) {
        setUploadError(`Area (${area.toLocaleString()} km²) exceeds platform limit of ${maxAoi.toLocaleString()} km².`);
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
      setUploadSuccess(`Loaded ${newAoi.name} (${area.toLocaleString()} km²)`);
    };

    reader.onerror = () => {
      setUploadError('Failed to read uploaded file.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Search Input (34px Row) */}
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search place or lon, lat (e.g. 88.9, 21.8)…"
          className="w-full h-[34px] bg-paper-3 rounded-control border border-rule focus:border-ink-2 text-xs text-ink placeholder-muted-2 pl-9 pr-16 outline-none transition-colors"
        />
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
        <button
          type="submit"
          disabled={isSearching}
          className="absolute right-1 top-1 h-[26px] px-3 rounded-control bg-paper-surface hover:bg-paper-surface-hover text-ink border border-rule text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isSearching ? '…' : 'Locate'}
        </button>
      </form>

      {/* Geometry Draw Buttons (34px Row Height with 2px Gaps) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-2">
          Select or draw area
        </label>
        <div className="grid grid-cols-3 gap-[2px]">
          <button
            onClick={() => setDrawingMode(drawingMode === 'point' ? 'none' : 'point')}
            className={`h-[34px] flex items-center justify-center gap-1.5 px-2 rounded-control border text-xs transition-colors ${
              drawingMode === 'point'
                ? 'bg-paper-surface border-rule-2 text-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-paper-3 border-rule text-muted hover:bg-paper-2 hover:text-ink'
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="truncate">Point buffer</span>
          </button>

          <button
            onClick={() => setDrawingMode(drawingMode === 'polygon' ? 'none' : 'polygon')}
            className={`h-[34px] flex items-center justify-center gap-1.5 px-2 rounded-control border text-xs transition-colors ${
              drawingMode === 'polygon'
                ? 'bg-paper-surface border-rule-2 text-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-paper-3 border-rule text-muted hover:bg-paper-2 hover:text-ink'
            }`}
          >
            <Pentagon className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="truncate">Draw polygon</span>
          </button>

          <button
            onClick={() => setDrawingMode(drawingMode === 'box' ? 'none' : 'box')}
            className={`h-[34px] flex items-center justify-center gap-1.5 px-2 rounded-control border text-xs transition-colors ${
              drawingMode === 'box'
                ? 'bg-paper-surface border-rule-2 text-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-paper-3 border-rule text-muted hover:bg-paper-2 hover:text-ink'
            }`}
          >
            <Square className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="truncate">Draw box</span>
          </button>
        </div>

        {/* Point Buffer Radius Slider */}
        {drawingMode === 'point' && (
          <div className="mt-2.5 p-3 rounded-control bg-paper-3 border border-rule text-xs">
            <div className="flex justify-between items-center text-muted mb-1.5">
              <span>Analysis radius</span>
              <span className="font-mono tabular-nums text-ink font-medium">{pointBufferKm} km</span>
            </div>
            <input
              type="range"
              min={2}
              max={50}
              step={1}
              value={pointBufferKm}
              onChange={(e) => setPointBufferKm(parseInt(e.target.value, 10))}
              className="w-full accent-ink h-1 bg-rule cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Upload GeoJSON Boundary (34px Row) */}
      <div>
        <label className="relative h-[34px] flex items-center justify-center space-x-2 border border-dashed border-rule hover:border-rule-2 bg-paper-3 hover:bg-paper-2 px-3 rounded-control cursor-pointer transition-colors text-xs text-muted">
          <Upload className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <span>Upload boundary file (.geojson, .json)</span>
          <input
            type="file"
            accept=".geojson,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {uploadError && (
          <div className="mt-2 flex items-start space-x-2 text-error bg-paper-3 rounded-control border border-error/30 p-2.5 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-error" aria-hidden="true" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-2 flex items-center space-x-2 text-success bg-paper-3 rounded-control border border-success/30 p-2.5 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>{uploadSuccess}</span>
          </div>
        )}
      </div>

      {/* Curated Pre-set Reference Sites (Quiet 34px Navigation Rows with 2px Gaps) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-2">
          Curated reference sites
        </label>
        <div className="space-y-[2px]">
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
                className={`w-full h-[34px] px-3 rounded-control border text-xs flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-paper-surface border-rule-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-paper-3 border-rule text-muted hover:bg-paper-2 hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="font-medium text-ink truncate">{preset.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono tabular-nums text-muted text-xs">
                    {preset.areaSqKm.toLocaleString()} km²
                  </span>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${isSelected ? 'text-ink' : 'text-muted-2'}`} aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected AOI Metrics Box */}
      {activeAoi && (
        <div className="p-3 bg-paper-2 rounded-card border border-rule space-y-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-rule pb-1.5">
            <span className="font-medium text-ink truncate">{activeAoi.name}</span>
            <button
              onClick={() => onAoiChange(null)}
              className="text-muted hover:text-error p-1 transition-colors"
              title="Clear active area"
              aria-label="Clear active area"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
            <div className="bg-paper-3 p-2 rounded-control border border-rule">
              <span className="text-muted-2 block text-xs font-sans">Surface area</span>
              <span className="text-ink font-medium">{activeAoi.areaSqKm.toLocaleString()}</span>
              <span className="text-muted text-xs font-sans"> km²</span>
            </div>
            <div className="bg-paper-3 p-2 rounded-control border border-rule">
              <span className="text-muted-2 block text-xs font-sans">Datum reference</span>
              <span className="text-ink font-medium">{activeAoi.crs}</span>
            </div>
          </div>

          <div className="text-xs text-muted bg-paper-3 p-2 rounded-control border border-rule">
            <span className="text-muted-2 block text-xs mb-0.5 font-sans">Extent [west, south, east, north]</span>
            <span className="font-mono tabular-nums text-ink">
              [{activeAoi.bbox.map((v) => v.toFixed(3)).join(', ')}]
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
