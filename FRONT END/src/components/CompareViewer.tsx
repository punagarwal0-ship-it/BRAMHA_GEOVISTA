import React from 'react';
import {
  SplitSquareVertical,
  Calendar,
  Cloud,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Info
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
      {/* Enable Split Mode Button */}
      <div className="p-3 rounded-lg bg-slate-900/80 border border-geo-border flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-200 block text-xs">
            Interactive Split-Swipe Map
          </span>
          <span className="text-[10px] text-slate-400">
            Compare two satellite observations across time
          </span>
        </div>
        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            compareMode
              ? 'bg-teal-500 text-slate-900 shadow-lg shadow-teal-500/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-geo-border'
          }`}
        >
          <SplitSquareVertical className="h-3.5 w-3.5" />
          <span>{compareMode ? 'Disable Swipe' : 'Enable Swipe'}</span>
        </button>
      </div>

      {/* Date Pickers for Scene A and Scene B */}
      <div className="grid grid-cols-2 gap-3">
        {/* Date A Selection */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-teal-500/40 space-y-2">
          <div className="flex items-center justify-between text-teal-300 font-semibold text-[11px]">
            <span>Baseline (Date A)</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300">
              Left
            </span>
          </div>
          <select
            value={sceneA ? sceneA.acquiredAt.slice(0, 10) : ''}
            onChange={(e) => setCompareDateA(e.target.value)}
            disabled={scenes.length === 0}
            className="w-full bg-slate-950 border border-geo-border text-slate-200 text-xs rounded p-1.5 outline-none font-mono"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.acquiredAt.slice(0, 10)}>
                {s.acquiredAt.slice(0, 10)} ({s.collection.split(' ')[0]})
              </option>
            ))}
          </select>
          {sceneA && (
            <div className="text-[10px] font-mono text-slate-400 space-y-0.5 bg-slate-950/40 p-1.5 rounded">
              <div>Sensor: {sceneA.collection}</div>
              <div>Cloud: {sceneA.cloudCoverPct}%</div>
              <div>Quality: {sceneA.qualityFlag}</div>
            </div>
          )}
        </div>

        {/* Date B Selection */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-cyan-500/40 space-y-2">
          <div className="flex items-center justify-between text-cyan-300 font-semibold text-[11px]">
            <span>Comparison (Date B)</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
              Right
            </span>
          </div>
          <select
            value={sceneB ? sceneB.acquiredAt.slice(0, 10) : ''}
            onChange={(e) => setCompareDateB(e.target.value)}
            disabled={scenes.length === 0}
            className="w-full bg-slate-950 border border-geo-border text-slate-200 text-xs rounded p-1.5 outline-none font-mono"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.acquiredAt.slice(0, 10)}>
                {s.acquiredAt.slice(0, 10)} ({s.collection.split(' ')[0]})
              </option>
            ))}
          </select>
          {sceneB && (
            <div className="text-[10px] font-mono text-slate-400 space-y-0.5 bg-slate-950/40 p-1.5 rounded">
              <div>Sensor: {sceneB.collection}</div>
              <div>Cloud: {sceneB.cloudCoverPct}%</div>
              <div>Quality: {sceneB.qualityFlag}</div>
            </div>
          )}
        </div>
      </div>

      {/* Temporal Delta Card */}
      <div className="p-3 rounded-lg bg-slate-900/90 border border-geo-border space-y-2">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
          Observation Difference Summary
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-slate-800/60 p-2 rounded">
            <span className="text-slate-400 text-[10px] block">Temporal Separation</span>
            <span className="text-slate-100 font-semibold">
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

          <div className="bg-slate-800/60 p-2 rounded">
            <span className="text-slate-400 text-[10px] block">Index Delta ({indicator.toUpperCase()})</span>
            <div className="flex items-center space-x-1 font-semibold text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span>+0.082 Δ</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Drag the cyan handle on the map canvas to swipe between baseline and post-change rasters.
        </p>
      </div>
    </div>
  );
};

