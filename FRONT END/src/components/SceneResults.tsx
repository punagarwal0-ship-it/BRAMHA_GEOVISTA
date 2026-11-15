import React from 'react';
import {
  Calendar,
  Cloud,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Layers,
  Sparkles,
  Search,
  Maximize2
} from 'lucide-react';
import { ObservationScene } from '../types/api';

interface SceneResultsProps {
  scenes: ObservationScene[];
  selectedScene: ObservationScene | null;
  onSceneSelect: (scene: ObservationScene | null) => void;
  isLoading: boolean;
  onRefreshCatalog: () => void;
}

export const SceneResults: React.FC<SceneResultsProps> = ({
  scenes,
  selectedScene,
  onSceneSelect,
  isLoading,
  onRefreshCatalog
}) => {
  return (
    <div className="space-y-3 text-xs select-none">
      {/* Header with Search/Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-200 block text-xs">
            Satellite Catalog ({scenes.length} Scenes)
          </span>
          <span className="text-[10px] text-slate-400">
            Intersecting optical & SAR granules
          </span>
        </div>
        <button
          onClick={onRefreshCatalog}
          disabled={isLoading}
          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-white font-semibold rounded text-[11px] flex items-center space-x-1.5 transition-colors"
        >
          <Search className="h-3 w-3" />
          <span>{isLoading ? 'Querying STAC...' : 'Query Catalog'}</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-6 text-center text-slate-400 space-y-2 bg-slate-900/60 rounded-lg border border-geo-border animate-pulse">
          <Sparkles className="h-6 w-6 text-teal-400 mx-auto animate-spin" />
          <div className="text-xs font-medium text-slate-300">Querying Satellite STAC Endpoints</div>
          <div className="text-[10px] text-slate-500">Searching Sentinel-2 L2A & Landsat 9 metadata...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && scenes.length === 0 && (
        <div className="p-6 text-center text-slate-400 space-y-2 bg-slate-900/40 rounded-lg border border-dashed border-slate-700">
          <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto" />
          <div className="text-xs font-medium text-slate-300">No Intersecting Scenes Found</div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            No satellite acquisitions match the current date range and cloud filter. Expand the observation window or relax maximum cloud cover.
          </p>
        </div>
      )}

      {/* Scene Cards List */}
      {!isLoading && scenes.length > 0 && (
        <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
          {scenes.map((scene) => {
            const isSelected = selectedScene?.id === scene.id;
            const isCloudMasked = scene.qualityFlag === 'cloud_masked';

            return (
              <div
                key={scene.id}
                onClick={() => onSceneSelect(isSelected ? null : scene)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/60 border-geo-border hover:bg-slate-800/80 hover:border-slate-600'
                }`}
              >
                {/* Header: Provider & Date */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                    {scene.collection}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {scene.acquiredAt.replace('T', ' ').slice(0, 16)} UTC
                  </span>
                </div>

                {/* Body: Product ID */}
                <div className="font-mono text-[11px] text-slate-200 font-medium truncate mb-2" title={scene.productId}>
                  {scene.productId}
                </div>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  {/* Cloud Cover */}
                  <span
                    className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isCloudMasked
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Cloud className="h-2.5 w-2.5" />
                    {scene.cloudCoverPct}% Cloud
                  </span>

                  {/* Resolution */}
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                    {scene.resolutionMeters}m GSD
                  </span>

                  {/* Quality Flag */}
                  <span
                    className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                      isCloudMasked
                        ? 'bg-amber-950/60 text-amber-300'
                        : 'bg-emerald-950/60 text-emerald-300'
                    }`}
                  >
                    {isCloudMasked ? (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    ) : (
                      <CheckCircle className="h-2.5 w-2.5" />
                    )}
                    {scene.qualityFlag}
                  </span>

                  {/* Demo/Synthetic Flag */}
                  {scene.isDemoSynthetic && (
                    <span className="bg-purple-950/50 text-purple-300 border border-purple-500/30 px-1 py-0.5 rounded text-[9px]">
                      DEMO FIXTURE
                    </span>
                  )}
                </div>

                {/* Detailed inspector if selected */}
                {isSelected && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono space-y-1 text-slate-400 bg-slate-950/40 p-2 rounded">
                    <div className="flex justify-between">
                      <span>Provider:</span>
                      <span className="text-slate-200">{scene.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sun Elevation:</span>
                      <span className="text-slate-200">{scene.sunElevation}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sun Azimuth:</span>
                      <span className="text-slate-200">{scene.sunAzimuth}°</span>
                    </div>
                    <div className="text-[9px] text-teal-400 font-semibold mt-1">
                      Footprint active and highlighted in amber on map canvas
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

