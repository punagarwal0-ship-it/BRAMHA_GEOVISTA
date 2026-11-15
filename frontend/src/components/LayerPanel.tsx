import React from 'react';
import {
  Layers,
  Calendar,
  Cloud,
  Eye,
  EyeOff,
  Map as MapIcon
} from 'lucide-react';
import {
  PhenomenonType,
  LayerDefinition
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
      {/* Phenomenon Selector (34px Control) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-1.5">
          Analysis phenomenon
        </label>
        <select
          value={phenomenon}
          onChange={(e) => onPhenomenonChange(e.target.value as PhenomenonType)}
          className="w-full h-[34px] bg-paper-3 rounded-control border border-rule focus:border-ink-2 text-ink px-3 outline-none font-medium text-xs transition-colors"
        >
          {Object.values(PHENOMENA_CONFIGS).map((cfg) => (
            <option key={cfg.id} value={cfg.id}>
              {cfg.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-2 mt-1.5 leading-relaxed">
          {currentPhenomenonConfig.description}
        </p>
      </div>

      {/* Primary Indicator Selector (34px Rows with 2px Gaps) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-1.5">
          Primary indicator
        </label>
        <div className="space-y-[2px]">
          {currentPhenomenonConfig.supportedIndicators.map((ind) => {
            const isSelected = indicator === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => onIndicatorChange(ind.id)}
                className={`w-full h-[34px] px-3 rounded-control border flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-paper-surface border-rule-2 text-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-paper-3 border-rule text-muted hover:bg-paper-2 hover:text-ink'
                }`}
              >
                <span className="text-xs font-medium truncate">{ind.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-sm bg-paper-2 text-muted border border-rule font-mono tabular-nums shrink-0">
                  {ind.unit}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Satellite Constellations & Sensors (34px Rows with 2px Gaps) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-muted">
            Satellite constellations
          </label>
          <span className="text-xs text-muted-2 font-mono">Catalog</span>
        </div>
        <div className="space-y-[2px]">
          {SUPPORTED_COLLECTIONS.map((col) => {
            const isChecked = selectedCollections.includes(col.id);
            return (
              <div
                key={col.id}
                onClick={() => onToggleCollection(col.id)}
                className={`w-full h-[34px] px-3 rounded-control border cursor-pointer transition-colors flex items-center justify-between ${
                  isChecked
                    ? 'bg-paper-surface border-rule-2 text-ink'
                    : 'bg-paper-3 border-rule text-muted opacity-70'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="accent-ink cursor-pointer shrink-0"
                  />
                  <span className="font-medium text-ink truncate leading-tight">{col.name}</span>
                </div>
                <span className="text-xs text-muted-2 font-mono tabular-nums shrink-0">
                  {col.resolutionMeters}m · {col.revisitDays}d revisit
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Observation Window & Temporal Aggregation */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted block flex items-center gap-1.5">
          <Calendar className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <span>Observation window and aggregation</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-muted-2 block mb-1">Start date</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
              className="w-full h-[34px] bg-paper-3 rounded-control border border-rule text-ink px-2.5 font-mono text-xs outline-none"
            />
          </div>
          <div>
            <span className="text-xs text-muted-2 block mb-1">End date</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
              className="w-full h-[34px] bg-paper-3 rounded-control border border-rule text-ink px-2.5 font-mono text-xs outline-none"
            />
          </div>
        </div>

        {/* 34px Aggregation Buttons with 2px Gaps */}
        <div>
          <span className="text-xs text-muted-2 block mb-1">Temporal aggregation</span>
          <div className="grid grid-cols-5 gap-[2px] text-xs font-mono">
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: '5day', label: '5-day' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'seasonal', label: 'Seasonal' },
                { id: 'annual', label: 'Annual' }
              ] as const
            ).map((agg) => (
              <button
                key={agg.id}
                onClick={() => onAggregationChange(agg.id)}
                className={`h-[34px] rounded-control border text-center transition-colors ${
                  aggregation === agg.id
                    ? 'bg-paper-surface border-rule-2 text-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-paper-3 border-rule text-muted hover:text-ink'
                }`}
              >
                {agg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Maximum Cloud Cover Filter */}
      <div className="p-3 bg-paper-3 rounded-card border border-rule">
        <div className="flex justify-between items-center text-muted mb-1.5">
          <span className="flex items-center gap-1.5">
            <Cloud className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
            <span>Maximum cloud cover</span>
          </span>
          <span className="font-mono tabular-nums text-ink font-medium">{maxCloudCover}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={maxCloudCover}
          onChange={(e) => onMaxCloudCoverChange(parseInt(e.target.value, 10))}
          className="w-full accent-ink h-1 bg-rule cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-2 font-mono tabular-nums mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Basemap Switcher (34px Rows with 2px Gaps) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-1.5 flex items-center gap-1.5">
          <MapIcon className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <span>Basemap layer</span>
        </label>
        <div className="grid grid-cols-3 gap-[2px]">
          {(
            [
              { id: 'satellite', label: 'Satellite' },
              { id: 'dark', label: 'Dark topo' },
              { id: 'osm', label: 'OpenStreetMap' }
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              onClick={() => onBaseMapChange(b.id)}
              className={`h-[34px] rounded-control border text-center text-xs font-medium transition-colors ${
                activeBaseMap === b.id
                  ? 'bg-paper-surface border-rule-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'bg-paper-3 border-rule text-muted hover:text-ink'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Layers Stack (34px Rows with 2px Gaps) */}
      <div>
        <label className="text-xs font-medium text-muted block mb-1.5 flex items-center gap-1.5">
          <Layers className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <span>Map layer stack</span>
        </label>
        <div className="space-y-[2px]">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="h-[34px] px-3 rounded-control bg-paper-3 border border-rule flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <button
                  onClick={() => onToggleLayerVisibility(layer.id)}
                  className="text-muted hover:text-ink transition-colors"
                  aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? (
                    <Eye className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                  ) : (
                    <EyeOff className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
                  )}
                </button>
                <span className="font-medium text-ink text-xs truncate max-w-[170px]">
                  {layer.name}
                </span>
              </div>

              {layer.visible && (
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs text-muted-2 w-8 font-mono tabular-nums text-right">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.opacity}
                    onChange={(e) => onChangeLayerOpacity(layer.id, parseFloat(e.target.value))}
                    className="w-16 accent-ink h-1 bg-rule cursor-pointer"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Colormap Legend */}
      {currentPhenomenonConfig.colorRamp && (
        <div className="p-3 bg-paper-2 rounded-card border border-rule space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink font-medium">
            <span>Color ramp legend</span>
            <span className="font-mono text-muted text-xs">
              {currentPhenomenonConfig.colorRamp.name}
            </span>
          </div>

          <div className="space-y-1 text-xs">
            {currentPhenomenonConfig.colorRamp.stops.map((stop, sIdx) => (
              <div key={sIdx} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-sm border border-rule shrink-0"
                  style={{ backgroundColor: stop.color }}
                />
                <span className="text-muted">{stop.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
