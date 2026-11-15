import React, { useState } from 'react';
import {
  Activity,
  Table,
  TrendingDown,
  TrendingUp,
  Download
} from 'lucide-react';
import { TimeSeriesPoint, ChangeEvent } from '../types/api';

interface TimeSeriesChartProps {
  observations: TimeSeriesPoint[];
  changes: ChangeEvent[];
  indicator: string;
  phenomenon: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  observations,
  changes,
  indicator
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);
  const [showDataTable, setShowDataTable] = useState(false);

  if (!observations || observations.length === 0) {
    return (
      <div className="p-8 text-center text-muted bg-paper-3 rounded-card border border-dashed border-rule">
        <Activity className="h-5 w-5 text-muted-2 mx-auto mb-2" aria-hidden="true" />
        <div className="text-xs font-medium text-ink">No time-series observations loaded</div>
        <p className="text-xs text-muted-2 mt-1">
          Submit an analysis job or select an area to generate historical observations.
        </p>
      </div>
    );
  }

  const values = observations.map((d) => (typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.15 || 0.1;
  const yMin = Number((minVal - padding).toFixed(2));
  const yMax = Number((maxVal + padding).toFixed(2));
  const yRange = yMax - yMin || 1;

  const width = 600;
  const height = 220;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 28;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const getX = (index: number) => {
    return padLeft + (index / (observations.length - 1 || 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return padTop + plotHeight - ((val - yMin) / yRange) * plotHeight;
  };

  const linePoints = observations.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
  const validObservations = observations.filter((d) => d.qualityFlag === 'valid');
  const avgValue = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(3);

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Indicator', 'Value', 'Unit', 'QualityFlag', 'ValidObsCount', 'SourceRef'];
    const rows = observations.map((o) =>
      [o.timestamp, indicator, o.value, o.unit, o.qualityFlag, o.validObservationCount, o.sourceReference].join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${indicator}_timeseries_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Header with Quick Stats & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-ink block text-xs">
            Historical time series ({observations.length} observations)
          </span>
          <span className="text-xs text-muted-2">
            {indicator} indicator · valid passes:{' '}
            <span className="font-mono tabular-nums text-muted">{validObservations.length}</span> /{' '}
            <span className="font-mono tabular-nums text-muted">{observations.length}</span>
          </span>
        </div>

        <div className="flex items-center gap-[2px]">
          <button
            onClick={() => setShowDataTable(!showDataTable)}
            className="h-[34px] px-3 rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule text-xs flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title="Inspect raw observation data table"
          >
            <Table className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{showDataTable ? 'Chart' : 'Data'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="h-[34px] px-3 rounded-control bg-paper-3 hover:bg-paper-surface text-muted hover:text-ink border border-rule text-xs flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
            title="Export CSV"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Export data</span>
          </button>
        </div>
      </div>

      {!showDataTable ? (
        /* The Focal Telemetry Chart */
        <div className="relative bg-paper-3 rounded-card border border-rule p-3 overflow-hidden">
          <svg
            role="img"
            aria-label="Historical time series indicator chart"
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair"
          >
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
              const y = padTop + plotHeight * (1 - ratio);
              const labelVal = (yMin + yRange * ratio).toFixed(2);
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
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* X-axis Date Labels */}
            {observations.map((d, i) => {
              if (i % Math.ceil(observations.length / 5) !== 0 && i !== observations.length - 1) return null;
              const x = getX(i);
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 8}
                  fill="var(--color-muted-2)"
                  fontSize="9"
                  fontFamily="var(--font-outlier)"
                  textAnchor="middle"
                >
                  {d.timestamp.slice(2, 7)}
                </text>
              );
            })}

            {/* Telemetry Observed Trend Polyline (Focal Moment) */}
            <polyline
              fill="none"
              stroke="var(--color-telemetry-cyan)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={linePoints}
            />

            {/* Hover Crosshair vertical line */}
            {hoveredPoint && (
              <line
                x1={getX(observations.findIndex((o) => o.timestamp === hoveredPoint.timestamp))}
                y1={padTop}
                x2={getX(observations.findIndex((o) => o.timestamp === hoveredPoint.timestamp))}
                y2={height - padBottom}
                stroke="rgba(237, 237, 237, 0.4)"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
            )}

            {/* Data Points */}
            {observations.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.value);
              const isCloudy = d.qualityFlag === 'cloud_masked';
              const isAnomaly = d.anomaly;
              const isHovered = hoveredPoint?.timestamp === d.timestamp;

              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(d)}
                >
                  {isAnomaly && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="6"
                      fill="none"
                      stroke="var(--color-error)"
                      strokeWidth="1"
                    />
                  )}

                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 4.5 : isAnomaly ? 4 : 2.5}
                    fill={isCloudy ? 'var(--color-muted-2)' : isAnomaly ? 'var(--color-error)' : 'var(--color-telemetry-cyan)'}
                    stroke="var(--color-paper-3)"
                    strokeWidth="1.25"
                  />
                </g>
              );
            })}
          </svg>

          {/* Active Hover Tooltip */}
          {hoveredPoint && (
            <div className="absolute top-3 right-3 bg-paper-2 rounded-control border border-rule-2 p-2.5 text-xs space-y-1 pointer-events-none shadow-md">
              <div className="flex items-center justify-between text-ink font-medium border-b border-rule pb-1 gap-3">
                <span className="font-mono tabular-nums">{hoveredPoint.timestamp.slice(0, 10)}</span>
                <span className="text-muted-2 font-mono">
                  {hoveredPoint.sourceReference.split('_')[0]}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted">Observation:</span>
                <span className="text-ink font-mono tabular-nums font-medium">
                  {hoveredPoint.value} {hoveredPoint.unit}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-muted">Quality:</span>
                <span
                  className={
                    hoveredPoint.qualityFlag === 'valid' ? 'text-success font-medium' : 'text-error font-medium'
                  }
                >
                  {hoveredPoint.qualityFlag}
                </span>
              </div>
              {hoveredPoint.anomalyDescription && (
                <div className="text-error bg-paper-3 p-1.5 rounded-sm text-xs border border-error/30 mt-1">
                  {hoveredPoint.anomalyDescription}
                </div>
              )}
            </div>
          )}

          {/* Legend row */}
          <div className="mt-3 pt-2 border-t border-rule flex items-center justify-between text-xs text-muted-2 px-1">
            <div className="flex items-center space-x-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-telemetry-cyan inline-block rounded-sm" />
                <span>Observed pass</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-2 inline-block" />
                <span>Cloud masked</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-error inline-block" />
                <span>Disturbance anomaly</span>
              </span>
            </div>
            <span>Mean: <span className="font-mono tabular-nums text-muted">{avgValue}</span></span>
          </div>
        </div>
      ) : (
        /* Data Table View */
        <div className="bg-paper-3 rounded-card border border-rule overflow-hidden max-h-[260px] overflow-y-auto">
          <table className="w-full text-xs text-left text-muted">
            <thead className="bg-paper-2 text-muted-2 border-b border-rule sticky top-0">
              <tr>
                <th className="p-2 font-normal">Date (UTC)</th>
                <th className="p-2 font-normal">Obs value</th>
                <th className="p-2 font-normal">Quality</th>
                <th className="p-2 font-normal">Count</th>
                <th className="p-2 font-normal">Granule reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {observations.map((d, i) => (
                <tr key={i} className="hover:bg-paper-2 transition-colors">
                  <td className="p-2 text-ink font-mono tabular-nums">{d.timestamp.slice(0, 10)}</td>
                  <td className="p-2 text-ink font-mono tabular-nums font-medium">{d.value}</td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-sm border text-xs ${
                        d.qualityFlag === 'valid'
                          ? 'border-success/40 text-success'
                          : 'border-error/40 text-error'
                      }`}
                    >
                      {d.qualityFlag}
                    </span>
                  </td>
                  <td className="p-2 font-mono tabular-nums">{d.validObservationCount}</td>
                  <td className="p-2 text-muted-2 font-mono truncate max-w-[120px]" title={d.sourceReference}>
                    {d.sourceReference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Events & Detected Anomalies */}
      {changes && changes.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-xs font-medium text-muted block">
            Detected change events and anomalies
          </span>
          <div className="space-y-1.5">
            {changes.map((chg) => (
              <div
                key={chg.id}
                className="p-3 bg-paper-2 rounded-card border border-rule text-xs space-y-1 hover:border-rule-2 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink flex items-center gap-1.5">
                    {chg.changeType === 'abrupt_drop' && <TrendingDown className="h-4 w-4 shrink-0 text-error" aria-hidden="true" />}
                    {chg.changeType === 'rapid_growth' && <TrendingUp className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
                    {chg.changeType === 'water_inundation' && <Activity className="h-4 w-4 shrink-0 text-telemetry-cyan" aria-hidden="true" />}
                    <span>{chg.changeType.replace('_', ' ')}</span>
                  </span>
                  <span className="font-mono tabular-nums text-xs text-muted">
                    {chg.date}
                  </span>
                </div>
                <p className="text-muted text-xs leading-relaxed">{chg.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-2 pt-1">
                  <span>Confidence: <span className="font-mono tabular-nums text-muted">{chg.confidencePct}%</span></span>
                  {chg.affectedAreaSqKm && <span>Area: ~<span className="font-mono tabular-nums text-muted">{chg.affectedAreaSqKm}</span> km²</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
