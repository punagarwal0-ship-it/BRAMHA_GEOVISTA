import {
  AOI,
  CatalogSearchParams,
  ObservationScene,
  TimeSeriesPoint,
  ChangeEvent,
  ForecastPoint,
  ForecastModelMetadata,
  LayerDefinition,
  AnalysisJob,
  AnalysisJobResults,
  PhenomenonType
} from '../types/api';
import { CURATED_AOIS, generateCatalogScenes, generateHistoricalAnalysis } from './mockData';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const FORCE_MOCK = import.meta.env.VITE_ENABLE_MOCK_DATA === 'true';

// In-memory store for active synthetic jobs
const activeSyntheticJobs = new Map<string, AnalysisJob>();
const syntheticJobResults = new Map<string, AnalysisJobResults>();

// Initialise with some demo completed jobs
const demoJob1: AnalysisJob = {
  id: 'job-demo-sundarbans-01',
  aoiId: 'sundarbans-mangroves',
  aoiName: 'Sundarbans Biosphere Reserve',
  phenomenon: 'vegetation',
  indicator: 'ndvi',
  dateRange: {
    startDate: '2022-01-01',
    endDate: '2024-03-01'
  },
  aggregation: 'monthly',
  status: 'completed',
  progressPct: 100,
  currentStage: 'Completed analysis pipeline',
  submittedAt: '2026-11-03T04:15:00Z',
  completedAt: '2026-11-03T04:16:12Z',
  isDemoSynthetic: true
};
activeSyntheticJobs.set(demoJob1.id, demoJob1);

const demoAnalysis = generateHistoricalAnalysis('vegetation', 'ndvi');
syntheticJobResults.set(demoJob1.id, {
  jobId: demoJob1.id,
  aoi: CURATED_AOIS[0],
  ...demoAnalysis,
  isDemoSynthetic: true
});

/**
 * ApiAdapter handles both live backend communication (FastAPI / REST)
 * and graceful fallback to typed synthetic fixtures clearly marked DEMO/SYNTHETIC.
 */
export const apiAdapter = {
  isLiveApiConfigured(): boolean {
    return Boolean(BASE_URL) && !FORCE_MOCK;
  },

  getBaseUrl(): string {
    return BASE_URL || '(Synthetic Demo Mode)';
  },

  /**
   * Search satellite catalog for scenes intersecting an AOI
   * Corresponds to: GET /api/catalog/search
   */
  async searchCatalog(params: CatalogSearchParams): Promise<ObservationScene[]> {
    if (this.isLiveApiConfigured()) {
      try {
        const query = new URLSearchParams({
          startDate: params.startDate,
          endDate: params.endDate,
          maxCloudCover: params.maxCloudCover.toString(),
          collections: params.collections.join(',')
        });
        const res = await fetch(`${BASE_URL}/api/catalog/search?${query.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aoi: params.aoi })
        });
        if (!res.ok) throw new Error(`Catalog search failed: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live catalog API unavailable, falling back to synthetic catalog:', err);
      }
    }

    // Mock search simulation
    await new Promise((r) => setTimeout(r, 450));
    // Find matching curated AOI or create a dynamic one
    const matched = CURATED_AOIS.find((a) => a.id === (params.aoi as any).id) || {
      id: 'custom-aoi',
      name: 'Custom AOI',
      geometry: params.aoi,
      areaSqKm: 150,
      crs: 'EPSG:4326' as const,
      bbox: [85.0, 20.0, 86.0, 21.0] as [number, number, number, number],
      center: [85.5, 20.5] as [number, number],
      createdAt: new Date().toISOString()
    };

    let scenes = generateCatalogScenes(matched);
    // Filter by cloud cover
    scenes = scenes.filter((s) => s.cloudCoverPct <= params.maxCloudCover);
    return scenes;
  },

  /**
   * Submit a new asynchronous analysis job
   * Corresponds to: POST /api/analysis/jobs
   */
  async submitAnalysisJob(payload: {
    aoi: AOI;
    phenomenon: PhenomenonType;
    indicator: string;
    dateRange: { startDate: string; endDate: string };
    aggregation: 'daily' | '5day' | 'monthly' | 'seasonal' | 'annual';
    edgeCaseSim?: 'normal' | 'insufficient_history' | 'cloud_failure' | 'partial_data';
  }): Promise<AnalysisJob> {
    if (this.isLiveApiConfigured()) {
      try {
        const res = await fetch(`${BASE_URL}/api/analysis/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Job submission failed: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live API submission failed, using synthetic queue:', err);
      }
    }

    const jobId = `job-${Date.now().toString(36)}`;
    const newJob: AnalysisJob = {
      id: jobId,
      aoiId: payload.aoi.id,
      aoiName: payload.aoi.name,
      phenomenon: payload.phenomenon,
      indicator: payload.indicator,
      dateRange: payload.dateRange,
      aggregation: payload.aggregation,
      status: 'queued',
      progressPct: 5,
      currentStage: 'Job submitted to execution queue',
      submittedAt: new Date().toISOString(),
      isDemoSynthetic: true
    };

    activeSyntheticJobs.set(jobId, newJob);

    // Simulate async pipeline stages
    this.simulatePipelineExecution(newJob, payload.aoi, payload.edgeCaseSim || 'normal');

    return newJob;
  },

  /**
   * Poll status of an analysis job
   * Corresponds to: GET /api/analysis/jobs/{id}
   */
  async getJobStatus(jobId: string): Promise<AnalysisJob> {
    if (this.isLiveApiConfigured()) {
      try {
        const res = await fetch(`${BASE_URL}/api/analysis/jobs/${jobId}`);
        if (!res.ok) throw new Error(`Job polling failed: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live job polling failed, falling back:', err);
      }
    }

    const job = activeSyntheticJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in synthetic queue`);
    }
    return { ...job };
  },

  /**
   * Get all active and completed jobs
   */
  async getAllJobs(): Promise<AnalysisJob[]> {
    return Array.from(activeSyntheticJobs.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  },

  /**
   * Get observations for a completed job
   * Corresponds to: GET /api/analysis/jobs/{id}/observations
   */
  async getJobObservations(jobId: string): Promise<TimeSeriesPoint[]> {
    if (this.isLiveApiConfigured()) {
      try {
        const res = await fetch(`${BASE_URL}/api/analysis/jobs/${jobId}/observations`);
        if (!res.ok) throw new Error(`Failed to fetch observations: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live observations API failed, using synthetic:', err);
      }
    }

    const results = syntheticJobResults.get(jobId);
    return results ? results.observations : [];
  },

  /**
   * Get detected changes for a completed job
   * Corresponds to: GET /api/analysis/jobs/{id}/changes
   */
  async getJobChanges(jobId: string): Promise<ChangeEvent[]> {
    if (this.isLiveApiConfigured()) {
      try {
        const res = await fetch(`${BASE_URL}/api/analysis/jobs/${jobId}/changes`);
        if (!res.ok) throw new Error(`Failed to fetch changes: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live changes API failed, using synthetic:', err);
      }
    }

    const results = syntheticJobResults.get(jobId);
    return results ? results.changes : [];
  },

  /**
   * Get forecast and model metadata
   * Corresponds to: GET /api/analysis/jobs/{id}/forecast
   */
  async getJobForecast(jobId: string): Promise<{
    forecast: ForecastPoint[];
    metadata: ForecastModelMetadata;
  }> {
    if (this.isLiveApiConfigured()) {
      try {
        const res = await fetch(`${BASE_URL}/api/analysis/jobs/${jobId}/forecast`);
        if (!res.ok) throw new Error(`Failed to fetch forecast: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live forecast API failed, using synthetic:', err);
      }
    }

    const results = syntheticJobResults.get(jobId);
    if (!results) {
      throw new Error(`Results for job ${jobId} not found`);
    }
    return {
      forecast: results.forecast,
      metadata: results.forecastMetadata
    };
  },

  /**
   * Get output map layers
   * Corresponds to: GET /api/analysis/jobs/{id}/layers
   */
  async getJobLayers(jobId: string): Promise<LayerDefinition[]> {
    if (this.isLiveApiConfigured()) {
      try {
        const res = await fetch(`${BASE_URL}/api/analysis/jobs/${jobId}/layers`);
        if (!res.ok) throw new Error(`Failed to fetch layers: ${res.statusText}`);
        return await res.json();
      } catch (err) {
        console.warn('Live layers API failed, using synthetic:', err);
      }
    }

    const results = syntheticJobResults.get(jobId);
    return results ? results.layers : [];
  },

  /**
   * Internal helper: Simulates realistic asynchronous execution steps with delay
   */
  simulatePipelineExecution(
    job: AnalysisJob,
    aoi: AOI,
    edgeCase: 'normal' | 'insufficient_history' | 'cloud_failure' | 'partial_data'
  ) {
    const stages = [
      { pct: 15, msg: 'Querying STAC satellite catalog for intersecting granules...' },
      { pct: 35, msg: 'Calibrating BOA surface reflectance & computing cloud masks...' },
      { pct: 60, msg: `Deriving spatial features for ${job.indicator.toUpperCase()}...` },
      { pct: 85, msg: 'Evaluating historical baseline & running predictive model...' },
      { pct: 100, msg: 'Analysis pipeline completed successfully' }
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current >= stages.length) {
        clearInterval(interval);
        return;
      }

      const st = stages[current];
      job.status = 'running';
      job.progressPct = st.pct;
      job.currentStage = st.msg;

      // Handle edge cases
      if (current === 2 && edgeCase === 'cloud_failure') {
        clearInterval(interval);
        job.status = 'failed';
        job.currentStage = 'Failed at quality filtering stage';
        job.error = 'Cloud and shadow contamination exceeds allowable threshold (>85%) across selected temporal window. Adjust dates or relax cloud filter.';
        job.completedAt = new Date().toISOString();
        return;
      }

      if (current === stages.length - 1) {
        clearInterval(interval);
        job.status = edgeCase === 'partial_data' ? 'partial_data' : 'completed';
        job.progressPct = 100;
        job.currentStage = 'Completed analysis pipeline';
        job.completedAt = new Date().toISOString();

        // Generate synthetic analytical results
        const analysis = generateHistoricalAnalysis(job.phenomenon, job.indicator);

        if (edgeCase === 'insufficient_history') {
          // Truncate observations to 3 points and wipe forecast
          analysis.observations = analysis.observations.slice(0, 3);
          analysis.forecast = [];
          analysis.forecastMetadata.warningNotice =
            'INSUFFICIENT HISTORICAL DEPTH: Minimum 12 consecutive temporal observations required for reliable seasonal projection. Historical indicators only.';
        }

        syntheticJobResults.set(job.id, {
          jobId: job.id,
          aoi,
          ...analysis,
          isDemoSynthetic: true
        });
      }

      current++;
    }, 1200);
  }
};

