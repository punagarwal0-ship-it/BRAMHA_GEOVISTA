import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Clock,
  Cloud,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { ObservationScene } from '../types/api';

interface TimeSliderProps {
  scenes: ObservationScene[];
  activeSceneIndex: number;
  onSelectSceneIndex: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const TimeSlider: React.FC<TimeSliderProps> = ({
  scenes,
  activeSceneIndex,
  onSelectSceneIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed
}) => {
  // Sort scenes chronologically for the timeline
  const chronologicalScenes = [...scenes].sort(
    (a, b) => new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime()
  );

  const currentScene = chronologicalScenes[activeSceneIndex] || chronologicalScenes[0];

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying || chronologicalScenes.length <= 1) return;

    const delay = Math.round(1500 / playbackSpeed);
    const timer = setInterval(() => {
      onSelectSceneIndex((activeSceneIndex + 1) % chronologicalScenes.length);
    }, delay);

    return () => clearInterval(timer);
  }, [isPlaying, activeSceneIndex, playbackSpeed, chronologicalScenes.length]);

  if (chronologicalScenes.length === 0) {
    return null;
  }

  const handleStepBack = () => {
    const prev = activeSceneIndex > 0 ? activeSceneIndex - 1 : chronologicalScenes.length - 1;
    onSelectSceneIndex(prev);
  };

  const handleStepForward = () => {
    const next = (activeSceneIndex + 1) % chronologicalScenes.length;
    onSelectSceneIndex(next);
  };

  return (
    <div className="h-20 bg-slate-900/95 border-t border-geo-border px-4 py-2 flex flex-col justify-between select-none z-20 backdrop-blur-md">
      {/* Top line: Controls & Timestamp Badge */}
      <div className="flex items-center justify-between">
        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          {/* Step Back */}
          <button
            onClick={handleStepBack}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-geo-border transition-colors"
            title="Previous Acquisition"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-semibold flex items-center space-x-1.5 text-xs shadow-md shadow-teal-600/30 transition-all"
            title={isPlaying ? 'Pause Animation' : 'Play Temporal Sequence'}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Animate'}</span>
          </button>

          {/* Step Forward */}
          <button
            onClick={handleStepForward}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-geo-border transition-colors"
            title="Next Acquisition"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          {/* Speed Buttons */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-0.5 rounded border border-geo-border text-[10px] font-mono">
            {[0.5, 1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-teal-500 text-slate-900 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Active Timestamp Banner */}
        {currentScene && (
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-teal-500/40 px-2.5 py-1 rounded-md text-teal-300">
              <Clock className="h-3.5 w-3.5 text-teal-400" />
              <span className="font-semibold">
                {currentScene.acquiredAt.replace('T', ' ').slice(0, 16)} UTC
              </span>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="text-slate-200 font-semibold">{currentScene.collection}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Cloud className="h-3 w-3 text-cyan-400" />
                {currentScene.cloudCoverPct}% Cloud
              </span>
            </div>
          </div>
        )}

        {/* Frame Counter & Discrete Notice */}
        <div className="text-[10px] font-mono text-slate-400">
          <span>Obs {activeSceneIndex + 1} of {chronologicalScenes.length}</span>
          <span className="hidden md:inline ml-2 text-slate-500">(Discrete STAC passes; no interpolation)</span>
        </div>
      </div>

      {/* Discrete Timeline Scrubber */}
      <div className="relative w-full pt-1">
        {/* Track */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700/60">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-200"
            style={{
              width: `${(activeSceneIndex / (chronologicalScenes.length - 1 || 1)) * 100}%`
            }}
          />
        </div>

        {/* Discrete Ticks for each actual acquisition */}
        <div className="absolute top-0 left-0 right-0 flex justify-between pointer-events-none px-1">
          {chronologicalScenes.map((sc, idx) => {
            const isCurrent = idx === activeSceneIndex;
            const isCloudy = sc.qualityFlag === 'cloud_masked';

            return (
              <div
                key={sc.id}
                onClick={() => onSelectSceneIndex(idx)}
                className="pointer-events-auto flex flex-col items-center cursor-pointer group"
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-all ${
                    isCurrent
                      ? 'bg-amber-400 border-white scale-125 shadow-lg shadow-amber-400/50'
                      : isCloudy
                      ? 'bg-rose-500 border-slate-900 group-hover:scale-110'
                      : 'bg-teal-400 border-slate-900 group-hover:scale-110'
                  }`}
                  title={`${sc.acquiredAt.slice(0, 10)} - ${sc.cloudCoverPct}% cloud (${sc.collection})`}
                />
                <span
                  className={`text-[9px] font-mono mt-1 transition-colors ${
                    isCurrent ? 'text-teal-300 font-bold' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                >
                  {sc.acquiredAt.slice(5, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

