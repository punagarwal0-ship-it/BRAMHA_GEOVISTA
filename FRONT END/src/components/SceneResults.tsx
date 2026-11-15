import React from 'react';
import {
  Cloud,
  CheckCircle,
  AlertTriangle,
  Search,
  Layers
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
    <div className="space-y-4 text-xs select-none">
      {/* Header with Search/Refresh (34px Control) */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-ink block text-xs">
            Satellite catalog ({scenes.length} scenes)
          </span>
          <span className="text-xs text-muted-2">
            Intersecting optical and radar granules
          </span>
        </div>
        <button
          onClick={onRefreshCatalog}
          disabled={isLoading}
          className="h-[34px] px-3 rounded-control bg-paper-surface hover:bg-paper-surface-hover disabled:opacity-50 text-ink border border-rule font-medium text-xs flex items-center space-x-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isLoading ? 'Querying catalog…' : 'Query catalog'}</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-6 text-center text-muted space-y-2 bg-paper-3 rounded-card border border-rule">
          <Layers className="h-5 w-5 text-muted-2 mx-auto motion-safe:animate-spin" aria-hidden="true" />
          <div className="text-xs font-medium text-ink">Querying satellite catalog endpoints</div>
          <div className="text-xs text-muted-2">Searching Sentinel-2 and Landsat observation metadata…</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && scenes.length === 0 && (
        <div className="p-6 text-center text-muted space-y-2 bg-paper-3 rounded-card border border-dashed border-rule">
          <AlertTriangle className="h-5 w-5 text-muted-2 mx-auto" aria-hidden="true" />
          <div className="text-xs font-medium text-ink">No intersecting scenes found</div>
          <p className="text-xs text-muted-2 leading-relaxed">
            No acquisitions match the selected date range and cloud filter. Adjust dates or relax maximum cloud cover.
          </p>
        </div>
      )}

      {/* Scene Rows (34px Navigation Rows with 2px Gaps) */}
      {!isLoading && scenes.length > 0 && (
        <div className="space-y-[2px] max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
          {scenes.map((scene) => {
            const isSelected = selectedScene?.id === scene.id;
            const isCloudMasked = scene.qualityFlag === 'cloud_masked';

            return (
              <div
                key={scene.id}
                onClick={() => onSceneSelect(isSelected ? null : scene)}
                className={`h-[34px] px-3 rounded-control border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                  isSelected
                    ? 'bg-paper-surface border-rule-2 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-paper-3 border-rule hover:bg-paper-2 hover:border-rule-2'
                }`}
              >
                {/* Provider & Granule */}
                <div className="flex items-center gap-2 truncate pr-2">
                  <Layers className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="font-medium text-ink truncate">
                    {scene.collection}
                  </span>
                  <span className="font-mono tabular-nums text-muted-2 text-xs truncate">
                    {scene.acquiredAt.slice(0, 10)}
                  </span>
                </div>

                {/* Cloud & Quality Meta */}
                <div className="flex items-center space-x-2 shrink-0 font-mono tabular-nums text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-2" aria-hidden="true" />
                    <span>{scene.cloudCoverPct}%</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-sm border text-xs ${
                      isCloudMasked
                        ? 'border-error/40 text-error'
                        : 'border-rule text-muted'
                    }`}
                  >
                    {scene.resolutionMeters}m
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
