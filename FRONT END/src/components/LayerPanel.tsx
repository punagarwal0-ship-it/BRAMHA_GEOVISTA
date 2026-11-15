import React from 'react';
import {
  Layers,
  Sliders,
  Calendar,
  Cloud,
  Eye,
  EyeOff,
  Database,
  Map as MapIcon,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import {
  PhenomenonType,
  LayerDefinition,
  SatelliteCollection
} from '../types/api';
import { PHENOMENA_CONFIGS, SUPPORTED_COLLECTIONS } from '../services/mockData';

interface LayerPanelProps {
  phenomenon: PhenomenonType;
  onPhenomenonChange: (p: PhenomenonType) => void;
  indicator: string;
  onIndicatorChange: (ind: string) => void;
  selectedCollections: string[];
  onToggleCollection: (id: string) => void;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (dates: { startDate: string; endDate: string }) => void;
  aggregation: 'daily' | '5day' | 'monthly' | 'seasonal' | 'annual';
  onAggregationChange: (agg: 'daily' | '5day' | 'monthly' | 'seasonal' | 'annual') => void;
  maxCloudCover: number;
  onMaxCloudCoverChange: (val: number) => void;
  activeBaseMap: 'satellite' | 'dark' | 'osm';
  onBaseMapChange: (base: 'satellite' | 'dark' | 'osm') => void;
  layers: LayerDefinition[];
  onToggleLayerVisibility: (layerId: string) => void;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  phenomenon,
  onPhenomenonChange,
  indicator,
  onIndicatorChange,
  selectedCollections,
  onToggleCollection,
  dateRange,
  onDateRangeChange,
  aggregation,
  onAggregationChange,
  maxCloudCover,
  onMaxCloudCoverChange,
  activeBaseMap,
  onBaseMapChange,
  layers,
  onToggleLayerVisibility,
  onChangeLayerOpacity
}) => {
  const currentPhenomenonConfig = PHENOMENA_CONFIGS[phenomenon] || PHENOMENA_CONFIGS.vegetation;

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Phenomenon Selector (Section 5 of Brief) */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
          Analysis Phenomenon
        </label>
        <select
          value={phenomenon}
          onChange={(e) => onPhenomenonChange(e.target.value as PhenomenonType)}
          className="w-full bg-slate-900 border border-geo-border focus:border-teal-400 text-slate-100 rounded-lg p-2 outline-none font-medium text-xs transition-colors"
        >
          {Object.values(PHENOMENA_CONFIGS).map((cfg) => (
            <option key={cfg.id} value={cfg.id}>
              {cfg.title}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          {currentPhenomenonConfig.description}
        </p>
      </div>

      {/* Indicator Selector driven by Phenomenon (Strict brief rule: Do not show unsupported indicators) */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
          Primary Indicator / Index
        </label>
        <div className="space-y-1.5">
          {currentPhenomenonConfig.supportedIndicators.map((ind) => {
            const isSelected = indicator === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => onIndicatorChange(ind.id)}
                className={`w-full text-left p-2 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-teal-950/60 border-teal-400 text-teal-200'
                    : 'bg-slate-800/40 border-geo-border text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">{ind.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-300">
                    {ind.unit}
                  </span>
                </div>
                {ind.formula && (
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Formula: {ind.formula}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Satellite Constellations & Sensors */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center justify-between">
          <span>Satellite Constellations</span>
          <span className="text-[10px] text-teal-400 font-mono">STAC Ready</span>
        </label>
        <div className="space-y-1.5">
          {SUPPORTED_COLLECTIONS.map((col) => {
            const isChecked = selectedCollections.includes(col.id);
            return (
              <div
                key={col.id}
                onClick={() => onToggleCollection(col.id)}
                className={`p-2 rounded-lg border cursor-pointer transition-all flex items-start space-x-2.5 ${
                  isChecked
                    ? 'bg-slate-800/70 border-teal-500/40 text-slate-200'
                    : 'bg-slate-900/30 border-geo-border text-slate-400 opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="mt-0.5 accent-teal-400 rounded cursor-pointer"
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-200 leading-tight">{col.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {col.sensor} • {col.resolutionMeters}m res • Revisit {col.revisitDays}d
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Range & Temporal Aggregation */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
          <Calendar className="h-3 w-3 text-teal-400" />
          Observation Window & Aggregation
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Start Date</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
              className="w-full bg-slate-900 border border-geo-border text-slate-200 rounded p-1.5 font-mono text-[11px] outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">End Date</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
              className="w-full bg-slate-900 border border-geo-border text-slate-200 rounded p-1.5 font-mono text-[11px] outline-none"
            />
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block mb-1">Temporal Aggregation</span>
          <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
            {(['daily', '5day', 'monthly', 'seasonal', 'annual'] as const).map((agg) => (
              <button
                key={agg}
                onClick={() => onAggregationChange(agg)}
                className={`py-1 rounded border text-center uppercase font-medium transition-colors ${
                  aggregation === agg
                    ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                    : 'bg-slate-900/40 border-geo-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {agg}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Max Cloud Cover Filter */}
      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-geo-border">
        <div className="flex justify-between items-center text-slate-300 mb-1">
          <span className="flex items-center gap-1">
            <Cloud className="h-3 w-3 text-cyan-400" />
            Max Cloud Cover:
          </span>
          <span className="font-mono text-cyan-400 font-semibold">{maxCloudCover}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={maxCloudCover}
          onChange={(e) => onMaxCloudCoverChange(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
          <span>0% (Cloud-Free)</span>
          <span>50%</span>
          <span>100% (All Scenes)</span>
        </div>
      </div>

      {/* Basemap Switcher */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
          <MapIcon className="h-3 w-3 text-teal-400" />
          Basemap
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'satellite', label: 'Satellite' },
              { id: 'dark', label: 'Dark Topo' },
              { id: 'osm', label: 'OpenStreet' }
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              onClick={() => onBaseMapChange(b.id)}
              className={`py-1.5 rounded-md border text-center text-[11px] font-medium transition-all ${
                activeBaseMap === b.id
                  ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-sm'
                  : 'bg-slate-800/40 border-geo-border text-slate-300 hover:text-white'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Layers Stack & Opacity */}
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
          <Layers className="h-3 w-3 text-teal-400" />
          Map Layer Stack
        </label>
        <div className="space-y-2">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="p-2 rounded-lg bg-slate-900/60 border border-geo-border space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-200 text-xs truncate max-w-[170px]">
                  {layer.name}
                </span>
                <button
                  onClick={() => onToggleLayerVisibility(layer.id)}
                  className="text-slate-400 hover:text-slate-200 p-0.5"
                >
                  {layer.visible ? (
                    <Eye className="h-3.5 w-3.5 text-teal-400" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              </div>

              {layer.visible && (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400 w-12 font-mono">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.opacity}
                    onChange={(e) => onChangeLayerOpacity(layer.id, parseFloat(e.target.value))}
                    className="flex-1 accent-teal-400 h-1 bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Colormap Legend */}
      {currentPhenomenonConfig.colorRamp && (
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-geo-border space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
            <span>Color Ramp Legend</span>
            <span className="font-mono text-teal-400 text-[10px]">
              {currentPhenomenonConfig.colorRamp.name}
            </span>
          </div>

          <div className="space-y-1 text-[10px] font-mono">
            {currentPhenomenonConfig.colorRamp.stops.map((stop, sIdx) => (
              <div key={sIdx} className="flex items-center space-x-2">
                <div
                  className="w-3.5 h-3.5 rounded border border-slate-700 shrink-0"
                  style={{ backgroundColor: stop.color }}
                />
                <span className="text-slate-300">{stop.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

