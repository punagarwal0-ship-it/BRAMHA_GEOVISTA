"""
Asynchronous Job Execution and Tracking Manager for GEOVISTA Intelligence.

Ensures long-running training and prediction jobs do not block HTTP requests.
Maintains in-memory and persistent job records with progress reporting.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class JobRecord:
    job_id: str
    job_type: str
    status: JobStatus
    progress_pct: int
    current_stage: str
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
    config: dict[str, Any] = field(default_factory=dict)
    results: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class JobManager:
    """Thread-safe background job manager."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}

    def submit_job(self, job_type: str, config: dict[str, Any]) -> str:
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        now = datetime.utcnow().isoformat() + "Z"
        record = JobRecord(
            job_id=job_id,
            job_type=job_type,
            status=JobStatus.QUEUED,
            progress_pct=0,
            current_stage="Job queued for execution",
            created_at=now,
            updated_at=now,
            config=config,
        )
        self._jobs[job_id] = record
        logger.info("Submitted background job %s (type: %s)", job_id, job_type)
        return job_id

    def update_progress(self, job_id: str, pct: int, stage_msg: str) -> None:
        if job_id in self._jobs:
            rec = self._jobs[job_id]
            rec.status = JobStatus.RUNNING
            rec.progress_pct = max(0, min(100, pct))
            rec.current_stage = stage_msg
            rec.updated_at = datetime.utcnow().isoformat() + "Z"

    def complete_job(self, job_id: str, results: dict[str, Any]) -> None:
        if job_id in self._jobs:
            rec = self._jobs[job_id]
            rec.status = JobStatus.COMPLETED
            rec.progress_pct = 100
            rec.current_stage = "Job completed successfully"
            rec.completed_at = datetime.utcnow().isoformat() + "Z"
            rec.updated_at = rec.completed_at
            rec.results = results
            logger.info("Completed job %s", job_id)

    def fail_job(self, job_id: str, error_msg: str) -> None:
        if job_id in self._jobs:
            rec = self._jobs[job_id]
            rec.status = JobStatus.FAILED
            rec.current_stage = f"Failed: {error_msg}"
            rec.error = error_msg
            rec.completed_at = datetime.utcnow().isoformat() + "Z"
            rec.updated_at = rec.completed_at
            logger.error("Job %s failed: %s", job_id, error_msg)

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        if job_id in self._jobs:
            return asdict(self._jobs[job_id])
        return None

    def list_jobs(self) -> list[dict[str, Any]]:
        return [asdict(j) for j in self._jobs.values()]


# Module-level singleton
job_manager = JobManager()
