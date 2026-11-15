import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Cloud
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
  const chronologicalScenes = [...scenes].sort(
    (a, b) => new Date(a.acquiredAt).getTime() - new Date(b.acquiredAt).getTime()
  );

  const currentScene = chronologicalScenes[activeSceneIndex] || chronologicalScenes[0];

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
    <div className="h-16 bg-paper-2 border-t border-rule px-4 py-2 flex flex-col justify-between select-none z-20">
      {/* Top line: Controls & Timestamp Badge */}
      <div className="flex items-center justify-between">
        {/* Playback Controls (34px Rows with 2px Gaps) */}
        <div className="flex items-center gap-[2px]">
          <button
            onClick={handleStepBack}
            className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title="Previous acquisition"
            aria-label="Previous acquisition"
          >
            <SkipBack className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>

          <button
            onClick={onTogglePlay}
            className="h-[34px] px-3.5 rounded-control bg-ink hover:bg-white text-paper font-medium flex items-center space-x-2 text-xs transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title={isPlaying ? 'Pause animation' : 'Play sequence'}
          >
            {isPlaying ? <Pause className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Play className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>{isPlaying ? 'Pause' : 'Animate'}</span>
          </button>

          <button
            onClick={handleStepForward}
            className="h-[34px] w-[34px] flex items-center justify-center rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title="Next acquisition"
            aria-label="Next acquisition"
          >
            <SkipForward className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>

          {/* Speed Buttons */}
          <div className="flex items-center gap-[2px] bg-paper-3 p-[2px] h-[34px] rounded-control border border-rule text-xs font-mono tabular-nums">
            {[0.5, 1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSpeed(spd)}
                className={`h-[28px] px-2 rounded-sm transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-paper-surface text-ink font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-muted-2 hover:text-ink'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Active Timestamp Display */}
        {currentScene && (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs font-mono tabular-nums text-ink bg-paper-3 h-[34px] px-3 rounded-control border border-rule">
              <Clock className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
              <span className="font-medium">{currentScene.acquiredAt.replace('T', ' ').slice(0, 16)} UTC</span>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-xs text-muted">
              <span>{currentScene.collection}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Cloud className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
                <span className="font-mono tabular-nums">{currentScene.cloudCoverPct}%</span> cloud
              </span>
            </div>
          </div>
        )}

        {/* Frame Counter */}
        <div className="text-xs text-muted-2 h-[34px] flex items-center">
          <span>
            Pass <span className="font-mono tabular-nums text-muted">{activeSceneIndex + 1}</span> of{' '}
            <span className="font-mono tabular-nums text-muted">{chronologicalScenes.length}</span>
          </span>
        </div>
      </div>

      {/* Discrete Timeline Scrubber */}
      <div className="relative w-full pt-1">
        <div className="h-1 bg-paper-3 rounded-full relative border border-rule">
          <div
            className="h-full bg-ink-2 rounded-full transition-colors duration-150"
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
                  className={`w-2 h-2 rounded-full border transition-transform ${
                    isCurrent
                      ? 'bg-ink border-white scale-125'
                      : isCloudy
                      ? 'bg-error border-paper'
                      : 'bg-muted-2 border-paper group-hover:scale-110'
                  }`}
                  title={`${sc.acquiredAt.slice(0, 10)} · ${sc.cloudCoverPct}% cloud (${sc.collection})`}
                />
                <span
                  className={`text-xs font-mono tabular-nums mt-0.5 transition-colors ${
                    isCurrent ? 'text-ink font-medium' : 'text-muted-2 group-hover:text-muted'
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
