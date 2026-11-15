import React from 'react';
import {
  SplitSquareVertical,
  TrendingUp
} from 'lucide-react';
import { ObservationScene } from '../types/api';

interface CompareViewerProps {
  scenes: ObservationScene[];
  compareDateA: string;
  setCompareDateA: (date: string) => void;
  compareDateB: string;
  setCompareDateB: (date: string) => void;
  compareMode: boolean;
  setCompareMode: (enabled: boolean) => void;
  indicator: string;
}

export const CompareViewer: React.FC<CompareViewerProps> = ({
  scenes,
  compareDateA,
  setCompareDateA,
  compareDateB,
  setCompareDateB,
  compareMode,
  setCompareMode,
  indicator
}) => {
  const sceneA = scenes.find((s) => s.acquiredAt.startsWith(compareDateA)) || scenes[0];
  const sceneB = scenes.find((s) => s.acquiredAt.startsWith(compareDateB)) || scenes[scenes.length - 1];

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Enable Split Mode Button (34px Row) */}
      <div className="p-3 bg-paper-2 rounded-card border border-rule flex items-center justify-between">
        <div>
          <span className="font-medium text-ink block text-xs">
            Split-swipe map view
          </span>
          <span className="text-xs text-muted-2">
            Compare two satellite observations across time
          </span>
        </div>
        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`h-[34px] px-3 text-xs font-medium rounded-control flex items-center space-x-2 transition-colors ${
            compareMode
              ? 'bg-ink text-paper shadow-sm'
              : 'bg-paper-3 text-muted hover:bg-paper-surface hover:text-ink border border-rule'
          }`}
        >
          <SplitSquareVertical className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{compareMode ? 'Disable swipe' : 'Enable swipe'}</span>
        </button>
      </div>

      {/* Date Pickers for Scene A and Scene B */}
      <div className="grid grid-cols-2 gap-2">
        {/* Date A Selection */}
        <div className="p-3 bg-paper-3 rounded-card border border-rule space-y-2">
          <div className="flex items-center justify-between text-ink font-medium text-xs">
            <span>Baseline (date A)</span>
            <span className="font-mono text-xs px-1.5 py-0.5 rounded-sm bg-paper border border-rule text-muted">
              Left
            </span>
          </div>
          <select
            value={sceneA ? sceneA.acquiredAt.slice(0, 10) : ''}
            onChange={(e) => setCompareDateA(e.target.value)}
            disabled={scenes.length === 0}
            className="w-full h-[34px] bg-paper border border-rule rounded-control text-ink text-xs px-2 outline-none font-mono tabular-nums"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.acquiredAt.slice(0, 10)}>
                {s.acquiredAt.slice(0, 10)} ({s.collection.split(' ')[0]})
              </option>
            ))}
          </select>
          {sceneA && (
            <div className="text-xs text-muted-2 space-y-0.5 bg-paper p-2 rounded-control border border-rule font-mono tabular-nums">
              <div>Sensor: <span className="text-ink font-sans">{sceneA.collection}</span></div>
              <div>Cloud: <span className="text-ink">{sceneA.cloudCoverPct}%</span></div>
              <div>Quality: <span className="text-muted">{sceneA.qualityFlag}</span></div>
            </div>
          )}
        </div>

        {/* Date B Selection */}
        <div className="p-3 bg-paper-3 rounded-card border border-rule space-y-2">
          <div className="flex items-center justify-between text-ink font-medium text-xs">
            <span>Comparison (date B)</span>
            <span className="font-mono text-xs px-1.5 py-0.5 rounded-sm bg-paper border border-rule text-muted">
              Right
            </span>
          </div>
          <select
            value={sceneB ? sceneB.acquiredAt.slice(0, 10) : ''}
            onChange={(e) => setCompareDateB(e.target.value)}
            disabled={scenes.length === 0}
            className="w-full h-[34px] bg-paper border border-rule rounded-control text-ink text-xs px-2 outline-none font-mono tabular-nums"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.acquiredAt.slice(0, 10)}>
                {s.acquiredAt.slice(0, 10)} ({s.collection.split(' ')[0]})
              </option>
            ))}
          </select>
          {sceneB && (
            <div className="text-xs text-muted-2 space-y-0.5 bg-paper p-2 rounded-control border border-rule font-mono tabular-nums">
              <div>Sensor: <span className="text-ink font-sans">{sceneB.collection}</span></div>
              <div>Cloud: <span className="text-ink">{sceneB.cloudCoverPct}%</span></div>
              <div>Quality: <span className="text-muted">{sceneB.qualityFlag}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Temporal Delta Card */}
      <div className="p-3 bg-paper-2 rounded-card border border-rule space-y-2.5">
        <span className="text-xs font-medium text-muted block">
          Observation difference summary
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-paper-3 p-2 rounded-control border border-rule">
            <span className="text-muted-2 text-xs block font-sans">Temporal separation</span>
            <span className="text-ink font-mono tabular-nums font-medium">
              {sceneA && sceneB
                ? `${Math.abs(
                    Math.round(
                      (new Date(sceneB.acquiredAt).getTime() - new Date(sceneA.acquiredAt).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  )} days`
                : '--'}
            </span>
          </div>

          <div className="bg-paper-3 p-2 rounded-control border border-rule">
            <span className="text-muted-2 text-xs block font-sans">Index delta ({indicator})</span>
            <div className="flex items-center space-x-1 font-mono tabular-nums font-medium text-success">
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>+0.082 Δ</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-2 leading-relaxed">
          Drag the center handle on the map canvas to swipe between baseline and post-change rasters.
        </p>
      </div>
    </div>
  );
};
