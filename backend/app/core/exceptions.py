"""
app/core/exceptions.py
======================
Custom exception hierarchy for the GEOVISTA Intelligence ML backend.

Design principles
-----------------
* All exceptions inherit from :class:`GeoVistaError` so callers can catch
  the entire hierarchy with a single ``except GeoVistaError``.
* Every class has a sensible default message so it can be raised without args.
* An optional ``details`` dict carries structured diagnostic information
  (e.g. HTTP status codes, file paths, model names) for logging and API
  error responses.
"""

from __future__ import annotations

from typing import Any, Optional


# ===========================================================================
# Base
# ===========================================================================

class GeoVistaError(Exception):
    """
    Base exception for all GEOVISTA backend errors.

    Parameters
    ----------
    message:
        Human-readable description of the error.
    details:
        Optional mapping of additional structured context (paths, codes, …).
    """

    default_message: str = "An unexpected GEOVISTA error occurred."

    def __init__(
        self,
        message: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message or self.default_message)
        self.details: dict[str, Any] = details or {}

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(message={str(self)!r}, details={self.details!r})"
        )


# ===========================================================================
# Data Provider Errors
# ===========================================================================

class DataProviderError(GeoVistaError):
    """Raised when a remote data provider (NASA CMR, ASF, ESA, …) fails."""

    default_message = "A remote data provider returned an unexpected error."


class AuthenticationError(DataProviderError):
    """
    Raised when credentials are missing, invalid, or expired.

    Common causes
    -------------
    * Missing ``NASA_EARTHDATA_USERNAME`` / ``NASA_EARTHDATA_PASSWORD``
    * Expired bearer token
    * Missing Earthdata application approval for a dataset
    """

    default_message = (
        "Authentication failed. Please check your Earthdata / ASF credentials. "
        "Ensure your Earthdata account has accepted the EULA for the requested dataset."
    )


class DataNotFoundError(DataProviderError):
    """
    Raised when no granules / scenes are found for the requested parameters.

    Common causes
    -------------
    * AOI does not intersect any available scenes
    * Date range outside the dataset's temporal coverage
    * Wrong product short-name or version
    """

    default_message = (
        "No data found for the requested area, time range, or product. "
        "Check your AOI, date range, and product configuration."
    )


class DataDownloadError(DataProviderError):
    """Raised when a file download fails (network error, partial file, …)."""

    default_message = (
        "Data download failed. The file may be unavailable or the connection was interrupted."
    )


# ===========================================================================
# Preprocessing Errors
# ===========================================================================

class PreprocessingError(GeoVistaError):
    """Base class for errors that occur during data preprocessing."""

    default_message = "An error occurred during data preprocessing."


class AlignmentError(PreprocessingError):
    """
    Raised when multi-sensor raster alignment fails.

    Common causes
    -------------
    * CRS mismatch that cannot be resolved
    * Rasters do not spatially overlap
    * Resolution incompatibility after reprojection
    """

    default_message = (
        "Raster alignment failed. Verify that all input datasets overlap spatially "
        "and that CRS transformations are supported."
    )


class QualityFilterError(PreprocessingError):
    """
    Raised when too many pixels are masked out after quality filtering.

    Common causes
    -------------
    * Excessive cloud cover for the requested scene
    * Invalid QA bit masks
    * All pixels outside valid range after scale/offset application
    """

    default_message = (
        "Quality filtering removed too many pixels. "
        "Consider relaxing quality thresholds or choosing different acquisition dates."
    )


# ===========================================================================
# Model Errors
# ===========================================================================

class ModelError(GeoVistaError):
    """Base class for ML model-related errors."""

    default_message = "A model error occurred."


class TrainingError(ModelError):
    """
    Raised when model training fails.

    Common causes
    -------------
    * NaN loss (learning rate too high, bad normalisation)
    * Out-of-memory during forward/backward pass
    * Incompatible label dimensions
    """

    default_message = (
        "Model training failed. Check loss curves, learning rate, "
        "batch size, and input normalisation."
    )


class InferenceError(ModelError):
    """
    Raised when model inference fails.

    Common causes
    -------------
    * Missing or incompatible checkpoint
    * Input shape mismatch
    * Device / dtype incompatibility
    """

    default_message = (
        "Model inference failed. Verify the checkpoint path, input shape, "
        "and that the model is in evaluation mode."
    )


# ===========================================================================
# Ensemble Errors
# ===========================================================================

class EnsembleError(GeoVistaError):
    """
    Raised when ensemble combination or meta-learner training fails.

    Common causes
    -------------
    * Base model predictions have incompatible shapes
    * Stacking cross-validation folds produce NaN predictions
    * Insufficient base models for weighted averaging
    """

    default_message = (
        "Ensemble combination failed. Check that all base model predictions "
        "are available and have compatible shapes."
    )


# ===========================================================================
# Configuration Errors
# ===========================================================================

class ConfigurationError(GeoVistaError):
    """
    Raised when a project YAML config is missing required fields,
    has invalid values, or references non-existent resources.
    """

    default_message = (
        "Invalid or incomplete configuration. "
        "Review the project YAML and compare it with the schema documentation."
    )
