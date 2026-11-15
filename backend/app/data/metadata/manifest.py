"""
Dataset Manifest and Provenance Recorder for GEOVISTA Intelligence.

Generates immutable JSON manifests documenting:
- Satellite scenes ingested
- Provider and catalog endpoint used
- Spatial bounding box and target CRS
- Cloud cover and quality flags
- SHA-256 integrity hashes of downloaded or staged files
- Temporal range and acquisition timestamps
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.data.providers.base_provider import SceneMetadata

logger = logging.getLogger(__name__)


@dataclass
class ManifestRecord:
    manifest_id: str
    created_at: str
    aoi_bbox: list[float]
    date_range: tuple[str, str]
    scenes: list[dict[str, Any]]
    total_scenes: int
    data_providers: list[str]
    file_hashes: dict[str, str] = field(default_factory=dict)
    provenance_notes: list[str] = field(default_factory=list)


class ManifestManager:
    """Manages creation, verification, and persistence of dataset manifests."""

    @staticmethod
    def compute_sha256(file_path: Path, chunk_size: int = 1024 * 1024) -> str:
        """Calculate SHA-256 checksum for file integrity verification."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                hasher.update(chunk)
        return hasher.hexdigest()

    @classmethod
    def create_manifest(
        self,
        scenes: list[SceneMetadata],
        bbox: list[float],
        start_date: str,
        end_date: str,
        staged_files: Optional[dict[str, Path]] = None,
        notes: Optional[list[str]] = None,
    ) -> ManifestRecord:
        """Create a dataset manifest record from ingested scenes and staged files."""
        now = datetime.utcnow().isoformat() + "Z"
        manifest_id = f"manifest_{int(datetime.utcnow().timestamp())}"

        providers = sorted(list({s.provider for s in scenes}))
        serialized_scenes = [s.to_dict() for s in scenes]

        hashes = {}
        if staged_files:
            for key, path in staged_files.items():
                if path.exists():
                    hashes[key] = self.compute_sha256(path)

        return ManifestRecord(
            manifest_id=manifest_id,
            created_at=now,
            aoi_bbox=bbox,
            date_range=(start_date, end_date),
            scenes=serialized_scenes,
            total_scenes=len(scenes),
            data_providers=providers,
            file_hashes=hashes,
            provenance_notes=notes or [],
        )

    @classmethod
    def save_manifest(cls, manifest: ManifestRecord, output_path: Path) -> Path:
        """Save manifest to JSON file."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(asdict(manifest), f, indent=2)
        logger.info("Saved dataset manifest to %s", output_path)
        return output_path

    @classmethod
    def load_manifest(cls, path: Path) -> dict[str, Any]:
        """Load an existing manifest."""
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
