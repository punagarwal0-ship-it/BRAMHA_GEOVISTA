import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  Cpu,
  BarChart,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { ForecastPoint, ForecastModelMetadata, TimeSeriesPoint } from '../types/api';

interface ForecastPanelProps {
  forecast: ForecastPoint[];
  metadata: ForecastModelMetadata | null;
  historicalObservations: TimeSeriesPoint[];
  indicator: string;
}

export const ForecastPanel: React.FC<ForecastPanelProps> = ({
  forecast,
  metadata,
  historicalObservations,
  indicator
}) => {
  const [hoveredForecast, setHoveredForecast] = useState<ForecastPoint | null>(null);

  // Insufficient Data / No Forecast handling
  if (!forecast || forecast.length === 0 || !metadata) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/40 rounded-lg border border-amber-500/30 space-y-3">
        <AlertTriangle className="h-7 w-7 text-amber-400 mx-auto" />
        <div className="text-xs font-semibold text-amber-300">
          Predictive Horizon Unavailable
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
          {metadata?.warningNotice ||
            'Insufficient historical depth or high cloud contamination prevents validated forecasting. Minimum 12 consecutive observations required.'}
        </p>
      </div>
    );
  }

  // Combined visualization: Last 6 historical observations + 6 future forecast steps
  const recentHistory = historicalObservations.slice(-6);
  const combinedPoints = [
    ...recentHistory.map((h) => ({
      date: h.timestamp.slice(0, 10),
      isHistorical: true,
      val: h.value,
      lower: h.value,
      upper: h.value,
      lower95: h.value,
      upper95: h.value
    })),
    ...forecast.map((f) => ({
      date: f.timestamp.slice(0, 10),
      isHistorical: false,
      val: f.predictedValue,
      lower: f.lowerBound,
      upper: f.upperBound,
      lower95: f.lowerBound95,
      upper95: f.upperBound95
    }))
  ];

  // SVG Chart dimensions
  const allVals = [
    ...combinedPoints.map((p) => p.val),
    ...combinedPoints.map((p) => p.lower95),
    ...combinedPoints.map((p) => p.upper95)
  ];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const pad = (maxVal - minVal) * 0.15 || 0.1;
  const yMin = Number((minVal - pad).toFixed(2));
  const yMax = Number((maxVal + pad).toFixed(2));
  const yRange = yMax - yMin || 1;

  const width = 600;
  const height = 230;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 20;
  const padBottom = 30;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const getX = (idx: number) => {
    return padLeft + (idx / (combinedPoints.length - 1 || 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padTop + plotHeight - ((val - yMin) / yRange) * plotHeight;
  };

  const splitIndex = recentHistory.length - 1; // Index of last historical point
  const splitX = getX(splitIndex);

  // Shaded polygon paths for 95% and 80% confidence interval bands
  const forecastIndices = combinedPoints
    .map((p, i) => (i >= splitIndex ? i : null))
    .filter((i) => i !== null) as number[];

  const band95PointsTop = forecastIndices.map((i) => `${getX(i)},${getY(combinedPoints[i].upper95)}`).join(' ');
  const band95PointsBottom = [...forecastIndices]
    .reverse()
    .map((i) => `${getX(i)},${getY(combinedPoints[i].lower95)}`)
    .join(' ');
  const band95Path = `${band95PointsTop} ${band95PointsBottom}`;

  const historyPoints = recentHistory.map((_, i) => `${getX(i)},${getY(combinedPoints[i].val)}`).join(' ');
  const forecastPoints = combinedPoints
    .map((p, i) => (i >= splitIndex ? `${getX(i)},${getY(p.val)}` : null))
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-3.5 text-xs select-none">
      {/* Strict Scientific Safeguard Banner (Brief Requirement 4.E & 12) */}
      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 flex items-start space-x-2 text-amber-200">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed">
          <span className="font-semibold text-amber-300 block">Scientific Model Disclaimer</span>
          Model predictions are statistical extrapolations derived from calibrated features. They are
          not direct physical measurements and carry widening confidence intervals.
        </div>
      </div>

      {/* Forecast Chart Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-200 block text-xs">
            Predictive Horizon: {forecast.length} Steps Forward
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Model: {metadata.modelName} ({metadata.modelVersion})
          </span>
        </div>
        <div className="flex items-center space-x-1.5 font-mono text-[10px] bg-slate-800/80 px-2 py-0.5 rounded border border-geo-border text-teal-300">
          <span>Coverage: {metadata.inputDataCoveragePct}%</span>
        </div>
      </div>

      {/* Interactive Forecast Horizon Chart */}
      <div className="relative bg-slate-900/90 border border-geo-border rounded-lg p-2 overflow-hidden shadow-inner">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible cursor-crosshair">
          {/* Vertical Split Line: Observed History vs Forecast Horizon */}
          <line
            x1={splitX}
            y1={padTop}
            x2={splitX}
            y2={height - padBottom}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />
          <text
            x={splitX + 6}
            y={padTop + 12}
            fill="#f59e0b"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            FORECAST HORIZON →
          </text>

          {/* Grid lines */}
          {[0, 0.5, 1.0].map((ratio) => {
            const y = padTop + plotHeight * (1 - ratio);
            const val = (yMin + yRange * ratio).toFixed(2);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3,3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Date Axis */}
          {combinedPoints.map((p, i) => {
            if (i % 2 !== 0 && i !== combinedPoints.length - 1) return null;
            return (
              <text
                key={i}
                x={getX(i)}
                y={height - 8}
                fill={p.isHistorical ? '#64748b' : '#f59e0b'}
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {p.date.slice(2, 7)}
              </text>
            );
          })}

          {/* Shaded 95% Confidence Interval Band */}
          <polygon points={band95Path} fill="rgba(245, 158, 11, 0.15)" stroke="none" />

          {/* Historical Observed Solid Line */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinejoin="round"
            points={historyPoints}
          />

          {/* Forecast Horizon Dashed Line (Distinct visual treatment) */}
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeDasharray="6,4"
            strokeLinejoin="round"
            points={forecastPoints}
          />

          {/* Forecast Points */}
          {forecast.map((f, fIdx) => {
            const idx = splitIndex + fIdx + 1;
            const cx = getX(idx);
            const cy = getY(f.predictedValue);

            return (
              <g
                key={fIdx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredForecast(f)}
              >
                {/* Upper/Lower error bar lines */}
                <line
                  x1={cx}
                  y1={getY(f.upperBound95)}
                  x2={cx}
                  y2={getY(f.lowerBound95)}
                  stroke="rgba(245, 158, 11, 0.5)"
                  strokeWidth="1.5"
                />
                <line
                  x1={cx - 3}
                  y1={getY(f.upperBound95)}
                  x2={cx + 3}
                  y2={getY(f.upperBound95)}
                  stroke="rgba(245, 158, 11, 0.5)"
                  strokeWidth="1.5"
                />
                <line
                  x1={cx - 3}
                  y1={getY(f.lowerBound95)}
                  x2={cx + 3}
                  y2={getY(f.lowerBound95)}
                  stroke="rgba(245, 158, 11, 0.5)"
                  strokeWidth="1.5"
                />

                <circle
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill="#f59e0b"
                  stroke="#0b0f19"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip for Forecast Point */}
        {hoveredForecast && (
          <div className="absolute top-2 right-2 bg-slate-950/95 border border-amber-500/60 p-2 rounded-md shadow-2xl text-[10px] font-mono space-y-1 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-800 pb-1">
              <span>Projection: {hoveredForecast.timestamp.slice(0, 10)}</span>
              <span className="text-slate-400 font-normal">Model Estimate</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mean Prediction:</span>
              <span className="text-amber-400 font-bold">{hoveredForecast.predictedValue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">80% CI Range:</span>
              <span className="text-slate-200">
                [{hoveredForecast.lowerBound} to {hoveredForecast.upperBound}]
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">95% CI Range:</span>
              <span className="text-slate-200">
                [{hoveredForecast.lowerBound95} to {hoveredForecast.upperBound95}]
              </span>
            </div>
          </div>
        )}

        {/* Chart Legend */}
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-[#38bdf8] inline-block" />
              Observed Past
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-[#f59e0b] inline-block" />
              Model Forecast
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-amber-500/20 inline-block border border-amber-500/40 rounded-sm" />
              95% Uncertainty Band
            </span>
          </div>
        </div>
      </div>

      {/* Model Provenance & Evaluation Metrics Card */}
      <div className="p-3 rounded-lg bg-slate-900/80 border border-geo-border space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-teal-400" />
            Model Provenance & Holdout Calibration
          </span>
          <span className="font-mono text-[10px] text-teal-400 bg-teal-950 px-1.5 py-0.5 rounded">
            {metadata.algorithmFamily}
          </span>
        </div>

        {/* Holdout Validation Scores */}
        <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
          <div className="bg-slate-800/60 p-1.5 rounded">
            <span className="text-slate-400 block text-[9px]">RMSE (Holdout)</span>
            <span className="text-emerald-400 font-bold">{metadata.evaluationMetrics.rmse}</span>
          </div>
          <div className="bg-slate-800/60 p-1.5 rounded">
            <span className="text-slate-400 block text-[9px]">MAE</span>
            <span className="text-slate-200 font-bold">{metadata.evaluationMetrics.mae}</span>
          </div>
          <div className="bg-slate-800/60 p-1.5 rounded">
            <span className="text-slate-400 block text-[9px]">R² Coefficient</span>
            <span className="text-teal-300 font-bold">{metadata.evaluationMetrics.r2}</span>
          </div>
        </div>

        {/* Uncertainty Methodology */}
        <div className="text-[10px] text-slate-400 space-y-1">
          <div>
            <span className="text-slate-300 font-semibold">Uncertainty Estimation: </span>
            <span>{metadata.uncertaintyMethod}</span>
          </div>
          <div>
            <span className="text-slate-300 font-semibold">Training Chronology: </span>
            <span className="font-mono">
              {metadata.trainingWindow.start.slice(0, 10)} to {metadata.trainingWindow.end.slice(0, 10)}
            </span>
          </div>
        </div>

        {/* Limitations List */}
        <div>
          <span className="text-[10px] font-semibold text-slate-300 block mb-1">
            Documented Model Limitations:
          </span>
          <ul className="space-y-1 list-disc list-inside text-[10px] text-slate-400">
            {metadata.limitations.map((lim, lIdx) => (
              <li key={lIdx} className="leading-tight">
                {lim}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

