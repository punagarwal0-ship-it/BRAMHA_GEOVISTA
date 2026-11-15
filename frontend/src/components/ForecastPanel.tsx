import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Cpu
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
  historicalObservations
}) => {
  const [hoveredForecast, setHoveredForecast] = useState<ForecastPoint | null>(null);

  if (!forecast || forecast.length === 0 || !metadata) {
    return (
      <div className="p-6 text-center text-muted bg-paper-3 rounded-card border border-dashed border-rule space-y-2">
        <AlertTriangle className="h-5 w-5 text-muted-2 mx-auto" aria-hidden="true" />
        <div className="text-xs font-medium text-ink">
          Predictive horizon unavailable
        </div>
        <p className="text-xs text-muted-2 leading-relaxed max-w-sm mx-auto">
          {metadata?.warningNotice ||
            'Insufficient historical depth or cloud contamination prevents validated forecasting. Minimum 12 consecutive observations required.'}
        </p>
      </div>
    );
  }

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
  const padLeft = 44;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 28;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const getX = (idx: number) => {
    return padLeft + (idx / (combinedPoints.length - 1 || 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padTop + plotHeight - ((val - yMin) / yRange) * plotHeight;
  };

  const splitIndex = recentHistory.length - 1;
  const splitX = getX(splitIndex);

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
    <div className="space-y-4 text-xs select-none">
      {/* Scientific Safeguard Banner */}
      <div className="p-3 bg-paper-2 rounded-card border border-rule flex items-start space-x-2.5 text-muted">
        <ShieldAlert className="h-4 w-4 text-muted-2 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs leading-relaxed">
          <span className="font-medium text-ink block">Scientific model disclaimer</span>
          Model predictions are statistical extrapolations derived from calibrated features; they are
          not direct sensor observations and carry widening confidence bounds.
        </div>
      </div>

      {/* Forecast Chart Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-ink block text-xs">
            Predictive horizon: {forecast.length} steps forward
          </span>
          <span className="text-xs text-muted-2 font-mono tabular-nums">
            {metadata.modelName} ({metadata.modelVersion})
          </span>
        </div>
        <div className="flex items-center space-x-1.5 font-mono tabular-nums text-xs bg-paper-3 px-2.5 py-1 rounded-control border border-rule text-muted">
          <span>Coverage: {metadata.inputDataCoveragePct}%</span>
        </div>
      </div>

      {/* Interactive Forecast Horizon Chart (Telemetry Moment) */}
      <div className="relative bg-paper-3 rounded-card border border-rule p-3 overflow-hidden">
        <svg
          role="img"
          aria-label="Forecast horizon with confidence intervals"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
        >
          {/* Vertical Split Line: Observed History vs Forecast Horizon */}
          <line
            x1={splitX}
            y1={padTop}
            x2={splitX}
            y2={height - padBottom}
            stroke="var(--color-telemetry-amber)"
            strokeWidth="1"
            strokeDasharray="3,3"
            strokeOpacity="0.6"
          />
          <text
            x={splitX + 6}
            y={padTop + 12}
            fill="var(--color-telemetry-amber)"
            fontSize="9"
            fontFamily="var(--font-outlier)"
          >
            Horizon projection →
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
                  stroke="var(--color-rule)"
                  strokeDasharray="2,2"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  fill="var(--color-muted-2)"
                  fontSize="9"
                  fontFamily="var(--font-outlier)"
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
                fill={p.isHistorical ? 'var(--color-muted-2)' : 'var(--color-telemetry-amber)'}
                fontSize="9"
                fontFamily="var(--font-outlier)"
                textAnchor="middle"
              >
                {p.date.slice(2, 7)}
              </text>
            );
          })}

          {/* Shaded 95% Confidence Interval Band (Translucent Amber Fill) */}
          <polygon
            points={band95Path}
            fill="var(--color-telemetry-amber)"
            fillOpacity="0.12"
            stroke="var(--color-telemetry-amber)"
            strokeWidth="0.5"
            strokeOpacity="0.3"
          />

          {/* Historical Observed Solid Line (Cyan) */}
          <polyline
            fill="none"
            stroke="var(--color-telemetry-cyan)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={historyPoints}
          />

          {/* Forecast Horizon Dashed Line (Amber) */}
          <polyline
            fill="none"
            stroke="var(--color-telemetry-amber)"
            strokeWidth="2"
            strokeDasharray="4,3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={forecastPoints}
          />

          {/* Forecast Horizon Points */}
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
                <line
                  x1={cx}
                  y1={getY(f.upperBound95)}
                  x2={cx}
                  y2={getY(f.lowerBound95)}
                  stroke="var(--color-telemetry-amber)"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />

                <circle
                  cx={cx}
                  cy={cy}
                  r="3.5"
                  fill="var(--color-telemetry-amber)"
                  stroke="var(--color-paper-3)"
                  strokeWidth="1.25"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip for Forecast Point */}
        {hoveredForecast && (
          <div className="absolute top-3 right-3 bg-paper-2 rounded-control border border-rule-2 p-2.5 text-xs space-y-1 pointer-events-none shadow-md">
            <div className="flex items-center justify-between text-ink font-medium border-b border-rule pb-1 gap-3">
              <span className="font-mono tabular-nums">{hoveredForecast.timestamp.slice(0, 10)}</span>
              <span className="text-muted-2 font-mono">Statistical projection</span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted">Prediction:</span>
              <span className="text-telemetry-amber font-mono tabular-nums font-medium">
                {hoveredForecast.predictedValue}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted">80% CI:</span>
              <span className="text-ink font-mono tabular-nums">
                [{hoveredForecast.lowerBound} to {hoveredForecast.upperBound}]
              </span>
            </div>
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted">95% CI:</span>
              <span className="text-ink font-mono tabular-nums">
                [{hoveredForecast.lowerBound95} to {hoveredForecast.upperBound95}]
              </span>
            </div>
          </div>
        )}

        {/* Chart Legend */}
        <div className="mt-3 pt-2 border-t border-rule flex items-center justify-between text-xs text-muted-2 px-1">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-telemetry-cyan inline-block rounded-sm" />
              <span>Observed past</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-telemetry-amber inline-block" />
              <span>Model horizon</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-telemetry-amber/20 inline-block border border-telemetry-amber/40 rounded-sm" />
              <span>95% uncertainty band</span>
            </span>
          </div>
        </div>
      </div>

      {/* Model Provenance & Evaluation Metrics Card */}
      <div className="p-3 bg-paper-2 rounded-card border border-rule space-y-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-rule pb-1.5">
          <span className="font-medium text-ink flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-ink-2" aria-hidden="true" />
            <span>Model provenance and validation</span>
          </span>
          <span className="font-mono tabular-nums text-xs text-muted bg-paper-3 px-2 py-0.5 rounded-sm border border-rule">
            {metadata.algorithmFamily}
          </span>
        </div>

        {/* Holdout Validation Scores */}
        <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs">
          <div className="bg-paper-3 p-2 rounded-control border border-rule">
            <span className="text-muted-2 block text-xs font-sans">RMSE</span>
            <span className="text-ink font-medium">{metadata.evaluationMetrics.rmse}</span>
          </div>
          <div className="bg-paper-3 p-2 rounded-control border border-rule">
            <span className="text-muted-2 block text-xs font-sans">MAE</span>
            <span className="text-ink font-medium">{metadata.evaluationMetrics.mae}</span>
          </div>
          <div className="bg-paper-3 p-2 rounded-control border border-rule">
            <span className="text-muted-2 block text-xs font-sans">R² score</span>
            <span className="text-ink font-medium">{metadata.evaluationMetrics.r2}</span>
          </div>
        </div>

        {/* Uncertainty Methodology */}
        <div className="text-xs text-muted space-y-1">
          <div>
            <span className="text-ink">Methodology: </span>
            <span>{metadata.uncertaintyMethod}</span>
          </div>
          <div>
            <span className="text-ink">Training window: </span>
            <span className="font-mono tabular-nums text-muted">
              {metadata.trainingWindow.start.slice(0, 10)} to {metadata.trainingWindow.end.slice(0, 10)}
            </span>
          </div>
        </div>

        {/* Limitations List */}
        <div>
          <span className="text-xs font-medium text-ink block mb-1">
            Documented model limitations:
          </span>
          <ul className="space-y-1 list-disc list-inside text-xs text-muted-2">
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
