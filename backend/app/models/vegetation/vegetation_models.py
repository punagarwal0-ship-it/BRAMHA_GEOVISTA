"""
Vegetation model implementations for GEOVISTA Intelligence.

Includes:
  - VegetationRandomForest   (sklearn)
  - VegetationXGBoost        (xgboost)
  - VegetationLSTM           (PyTorch)
  - VegetationTCN            (PyTorch)
  - VegetationTransformer    (PyTorch)
"""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feature definitions shared across vegetation models
# ---------------------------------------------------------------------------
VEGETATION_FEATURES = ["ndvi", "evi", "red", "nir", "blue", "mir", "doy", "qa"]
VEGETATION_FEATURES_TS = ["ndvi", "evi", "red", "nir", "blue", "doy_sin", "doy_cos", "qa_weight"]


# ===========================================================================
# 1. VegetationRandomForest
# ===========================================================================

class VegetationRandomForest:
    """
    Random-Forest model for vegetation prediction.

    Uses sklearn RandomForestRegressor (NDVI regression) and
    RandomForestClassifier (NDVI class: low/medium/high/very-high).

    Input  : tabular feature vectors [N, n_features]
             Features: ndvi, evi, red, nir, blue, mir, doy, qa
    Output : predicted NDVI value (regression) + class (classification)
    """

    FEATURES = VEGETATION_FEATURES
    NDVI_BINS = [0.0, 0.2, 0.4, 0.6, 1.0]
    CLASS_NAMES = ["bare_soil", "sparse", "moderate", "dense"]

    def __init__(
        self,
        n_estimators: int = 200,
        max_depth: int | None = None,
        min_samples_leaf: int = 4,
        n_jobs: int = -1,
        random_state: int = 42,
    ):
        from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier

        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_leaf = min_samples_leaf
        self.n_jobs = n_jobs
        self.random_state = random_state

        self.regressor = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_leaf=min_samples_leaf,
            n_jobs=n_jobs,
            random_state=random_state,
        )
        self.classifier = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_leaf=min_samples_leaf,
            n_jobs=n_jobs,
            random_state=random_state,
        )
        self._is_fitted = False

    # ------------------------------------------------------------------
    def _ndvi_to_class(self, ndvi: np.ndarray) -> np.ndarray:
        return np.digitize(ndvi, self.NDVI_BINS[1:-1]).astype(int)

    def fit(self, X: np.ndarray, y_ndvi: np.ndarray) -> "VegetationRandomForest":
        """
        Train both regressor and classifier.

        Parameters
        ----------
        X       : [N, n_features]
        y_ndvi  : [N] continuous NDVI values in [-1, 1]
        """
        y_cls = self._ndvi_to_class(y_ndvi)
        self.regressor.fit(X, y_ndvi)
        self.classifier.fit(X, y_cls)
        self._is_fitted = True
        logger.info("VegetationRandomForest fitted on %d samples", len(X))
        return self

    def predict(self, X: np.ndarray) -> dict:
        """
        Returns
        -------
        dict:
            'ndvi_pred'   : [N] float
            'class_pred'  : [N] int
            'class_proba' : [N, 4] float
            'class_names' : list[str]
        """
        if not self._is_fitted:
            raise RuntimeError("Model must be fitted before predict().")
        ndvi_pred = self.regressor.predict(X)
        class_pred = self.classifier.predict(X)
        class_proba = self.classifier.predict_proba(X)
        return {
            "ndvi_pred": ndvi_pred,
            "class_pred": class_pred,
            "class_proba": class_proba,
            "class_names": self.CLASS_NAMES,
        }

    def feature_importance(self) -> dict:
        """Return feature importances from both regressor and classifier."""
        if not self._is_fitted:
            raise RuntimeError("Model must be fitted before feature_importance().")
        return {
            "regressor": dict(zip(self.FEATURES, self.regressor.feature_importances_)),
            "classifier": dict(zip(self.FEATURES, self.classifier.feature_importances_)),
        }

    # ------------------------------------------------------------------
    def save(self, path: Path) -> None:
        import joblib
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "regressor": self.regressor,
            "classifier": self.classifier,
            "config": self.get_config(),
        }
        joblib.dump(payload, path)
        logger.info("VegetationRandomForest saved to %s", path)

    @classmethod
    def load(cls, path: Path) -> "VegetationRandomForest":
        import joblib
        payload = joblib.load(Path(path))
        cfg = payload["config"]
        obj = cls(**{k: v for k, v in cfg.items()})
        obj.regressor = payload["regressor"]
        obj.classifier = payload["classifier"]
        obj._is_fitted = True
        return obj

    def get_config(self) -> dict:
        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "min_samples_leaf": self.min_samples_leaf,
            "n_jobs": self.n_jobs,
            "random_state": self.random_state,
        }


# ===========================================================================
# 2. VegetationXGBoost
# ===========================================================================

class VegetationXGBoost:
    """
    XGBoost model for vegetation NDVI regression.

    Supports early stopping during training and SHAP-based feature importance.

    Input  : tabular feature vectors [N, n_features]
             Features: ndvi, evi, red, nir, blue, mir, doy, qa
    Output : predicted NDVI value
    """

    FEATURES = VEGETATION_FEATURES

    def __init__(
        self,
        n_estimators: int = 500,
        max_depth: int = 6,
        learning_rate: float = 0.05,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        min_child_weight: int = 3,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        n_jobs: int = -1,
        random_state: int = 42,
        early_stopping_rounds: int = 50,
        eval_metric: str = "rmse",
        task: str = "regression",  # 'regression' or 'classification'
    ):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.min_child_weight = min_child_weight
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.n_jobs = n_jobs
        self.random_state = random_state
        self.early_stopping_rounds = early_stopping_rounds
        self.eval_metric = eval_metric
        self.task = task
        self._is_fitted = False
        self._model = None

    def _build_model(self):
        import xgboost as xgb
        common = dict(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            subsample=self.subsample,
            colsample_bytree=self.colsample_bytree,
            min_child_weight=self.min_child_weight,
            reg_alpha=self.reg_alpha,
            reg_lambda=self.reg_lambda,
            n_jobs=self.n_jobs,
            random_state=self.random_state,
            early_stopping_rounds=self.early_stopping_rounds,
            eval_metric=self.eval_metric,
        )
        if self.task == "regression":
            return xgb.XGBRegressor(**common)
        else:
            return xgb.XGBClassifier(**common)

    def fit(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray | None = None,
        y_val: np.ndarray | None = None,
    ) -> "VegetationXGBoost":
        """
        Fit the model with optional early-stopping validation set.

        IMPORTANT: Use chronological splits for time-series data.
        X_val / y_val should be temporally later than X_train / y_train.
        """
        self._model = self._build_model()
        eval_set = [(X_val, y_val)] if X_val is not None else None
        self._model.fit(X_train, y_train, eval_set=eval_set, verbose=False)
        self._is_fitted = True
        logger.info(
            "VegetationXGBoost fitted (%s) on %d samples",
            self.task, len(X_train),
        )
        return self

    def predict(self, X: np.ndarray) -> dict:
        if not self._is_fitted:
            raise RuntimeError("Model must be fitted before predict().")
        pred = self._model.predict(X)
        result = {"prediction": pred}
        if self.task == "classification":
            result["proba"] = self._model.predict_proba(X)
        return result

    def shap_values(self, X: np.ndarray) -> np.ndarray:
        """Compute SHAP values using the XGBoost built-in booster."""
        if not self._is_fitted:
            raise RuntimeError("Model must be fitted before shap_values().")
        import xgboost as xgb
        booster = self._model.get_booster()
        dmatrix = xgb.DMatrix(X, feature_names=self.FEATURES)
        shap = booster.predict(dmatrix, pred_contribs=True)
        return shap[:, :-1]  # exclude bias column

    def feature_importance(self) -> dict:
        if not self._is_fitted:
            raise RuntimeError("Model must be fitted before feature_importance().")
        scores = self._model.get_booster().get_fscore()
        # Map feature indices back to names if needed
        return {self.FEATURES[int(k.replace("f", ""))]: v
                for k, v in scores.items()
                if k.startswith("f")} if scores else {}

    def save(self, path: Path) -> None:
        import joblib
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self._model, "config": self.get_config()}, path)
        logger.info("VegetationXGBoost saved to %s", path)

    @classmethod
    def load(cls, path: Path) -> "VegetationXGBoost":
        import joblib
        payload = joblib.load(Path(path))
        obj = cls(**{k: v for k, v in payload["config"].items()})
        obj._model = payload["model"]
        obj._is_fitted = True
        return obj

    def get_config(self) -> dict:
        return {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "learning_rate": self.learning_rate,
            "subsample": self.subsample,
            "colsample_bytree": self.colsample_bytree,
            "min_child_weight": self.min_child_weight,
            "reg_alpha": self.reg_alpha,
            "reg_lambda": self.reg_lambda,
            "n_jobs": self.n_jobs,
            "random_state": self.random_state,
            "early_stopping_rounds": self.early_stopping_rounds,
            "eval_metric": self.eval_metric,
            "task": self.task,
        }


# ===========================================================================
# 3. VegetationLSTM
# ===========================================================================

class VegetationLSTM(nn.Module):
    """
    LSTM model for vegetation time-series forecasting.

    Input shape : [batch, sequence_length, n_features]
    Features per timestep:
        [ndvi, evi, red, nir, blue, doy_sin, doy_cos, qa_weight]

    Output : [batch, forecast_horizon] – predicted NDVI values

    Notes
    -----
    - Day-of-year is encoded as sin/cos to handle the circular nature of the
      annual cycle.
    - ALWAYS use chronological splits when training; never random.
    - QA weights can be used to down-weight cloud-contaminated observations
      via a simple attention mechanism.
    """

    task = "vegetation"
    model_type = "temporal_lstm"
    input_bands = VEGETATION_FEATURES_TS
    target_description = "NDVI forecast over forecast_horizon timesteps"

    def __init__(
        self,
        input_size: int = 8,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
        forecast_horizon: int = 12,
        bidirectional: bool = False,
    ):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.dropout = dropout
        self.forecast_horizon = forecast_horizon
        self.bidirectional = bidirectional

        self.input_norm = nn.LayerNorm(input_size)

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
            bidirectional=bidirectional,
        )

        lstm_out_size = hidden_size * (2 if bidirectional else 1)

        self.layer_norm = nn.LayerNorm(lstm_out_size)

        # QA-based soft attention over sequence
        self.qa_attention = nn.Linear(1, 1, bias=False)

        self.dropout_layer = nn.Dropout(dropout)

        self.head = nn.Sequential(
            nn.Linear(lstm_out_size, hidden_size),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, forecast_horizon),
        )

        self._init_weights()

    def _init_weights(self) -> None:
        for name, param in self.lstm.named_parameters():
            if "weight_ih" in name:
                nn.init.xavier_uniform_(param)
            elif "weight_hh" in name:
                nn.init.orthogonal_(param)
            elif "bias" in name:
                nn.init.zeros_(param)
                # Set forget-gate bias to 1 for better gradient flow
                n = param.size(0)
                param.data[n // 4: n // 2].fill_(1.0)
        for m in self.head:
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(
        self,
        x: torch.Tensor,
        qa_weights: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """
        Parameters
        ----------
        x          : [B, T, C]
        qa_weights : [B, T] optional QA weights in [0, 1]

        Returns
        -------
        [B, forecast_horizon]
        """
        x = self.input_norm(x)
        lstm_out, _ = self.lstm(x)          # [B, T, H]
        lstm_out = self.layer_norm(lstm_out)

        if qa_weights is not None:
            # Soft attention: scale each timestep by its QA weight
            attn = torch.sigmoid(self.qa_attention(qa_weights.unsqueeze(-1)))  # [B, T, 1]
            # Weighted average over sequence
            context = (lstm_out * attn).sum(dim=1) / (attn.sum(dim=1) + 1e-8)
        else:
            context = lstm_out[:, -1, :]  # Last timestep

        context = self.dropout_layer(context)
        return self.head(context)  # [B, forecast_horizon]

    def predict(self, x: torch.Tensor) -> dict:
        self.eval()
        with torch.no_grad():
            pred = self.forward(x)
        return {"prediction": pred, "confidence": None, "metadata": {"model": "VegetationLSTM"}}

    def predict_with_uncertainty(
        self, x: torch.Tensor, n_mc_dropout: int = 50
    ) -> dict:
        """
        Monte-Carlo Dropout uncertainty estimation.

        Enables dropout at inference time and runs n_mc_dropout forward passes
        to estimate predictive mean and standard deviation.

        Returns
        -------
        dict:
            'mean'  : [B, H] mean prediction
            'std'   : [B, H] standard deviation (uncertainty)
            'samples' : [n_mc_dropout, B, H] all MC samples
        """
        # Enable dropout (keep model in train mode for dropout layers)
        self.train()
        samples = []
        with torch.no_grad():
            for _ in range(n_mc_dropout):
                samples.append(self.forward(x))
        self.eval()
        samples_tensor = torch.stack(samples, dim=0)  # [MC, B, H]
        return {
            "mean": samples_tensor.mean(dim=0),
            "std": samples_tensor.std(dim=0),
            "samples": samples_tensor,
        }

    def get_config(self) -> dict:
        return {
            "input_size": self.input_size,
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
            "dropout": self.dropout,
            "forecast_horizon": self.forecast_horizon,
            "bidirectional": self.bidirectional,
        }


# ===========================================================================
# 4. VegetationTCN  (Temporal Convolutional Network)
# ===========================================================================

class _Chomp1d(nn.Module):
    """Remove future padding to enforce causality."""

    def __init__(self, chomp_size: int):
        super().__init__()
        self.chomp_size = chomp_size

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x[:, :, : -self.chomp_size].contiguous()


class TemporalBlock(nn.Module):
    """Dilated causal convolution residual block for TCN."""

    def __init__(
        self,
        n_inputs: int,
        n_outputs: int,
        kernel_size: int,
        stride: int,
        dilation: int,
        padding: int,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.conv1 = nn.utils.parametrize.register_parametrization if False else \
            nn.utils.weight_norm(
                nn.Conv1d(
                    n_inputs, n_outputs, kernel_size,
                    stride=stride, padding=padding, dilation=dilation,
                )
            )
        self.chomp1 = _Chomp1d(padding)
        self.relu1 = nn.ReLU()
        self.dropout1 = nn.Dropout(dropout)

        self.conv2 = nn.utils.weight_norm(
            nn.Conv1d(
                n_outputs, n_outputs, kernel_size,
                stride=stride, padding=padding, dilation=dilation,
            )
        )
        self.chomp2 = _Chomp1d(padding)
        self.relu2 = nn.ReLU()
        self.dropout2 = nn.Dropout(dropout)

        self.net = nn.Sequential(
            self.conv1, self.chomp1, self.relu1, self.dropout1,
            self.conv2, self.chomp2, self.relu2, self.dropout2,
        )

        self.downsample = (
            nn.Conv1d(n_inputs, n_outputs, 1) if n_inputs != n_outputs else None
        )
        self.relu = nn.ReLU()
        self._init_weights()

    def _init_weights(self) -> None:
        for m in [self.conv1, self.conv2]:
            nn.init.normal_(m.weight, mean=0.0, std=0.01)
            nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.net(x)
        res = x if self.downsample is None else self.downsample(x)
        return self.relu(out + res)


class VegetationTCN(nn.Module):
    """
    Temporal Convolutional Network for vegetation time-series.

    Advantages over LSTM:
    - Faster training (fully parallelisable)
    - Explicit receptive field (no vanishing gradients)
    - Comparable or superior accuracy on vegetation time-series

    Input  : [B, T, C]
    Output : [B, forecast_horizon]
    """

    task = "vegetation"
    model_type = "temporal_tcn"
    input_bands = VEGETATION_FEATURES_TS
    target_description = "NDVI forecast over forecast_horizon timesteps"

    def __init__(
        self,
        input_size: int = 8,
        num_channels: list[int] | None = None,
        kernel_size: int = 3,
        dropout: float = 0.2,
        forecast_horizon: int = 12,
    ):
        super().__init__()
        if num_channels is None:
            num_channels = [64, 128, 128, 64]

        self.input_size = input_size
        self.num_channels = num_channels
        self.kernel_size = kernel_size
        self.dropout = dropout
        self.forecast_horizon = forecast_horizon

        layers: list[nn.Module] = []
        in_ch = input_size
        for i, out_ch in enumerate(num_channels):
            dilation = 2 ** i
            padding = (kernel_size - 1) * dilation
            layers.append(
                TemporalBlock(in_ch, out_ch, kernel_size, stride=1,
                              dilation=dilation, padding=padding, dropout=dropout)
            )
            in_ch = out_ch

        self.network = nn.Sequential(*layers)
        self.head = nn.Sequential(
            nn.Linear(num_channels[-1], 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, forecast_horizon),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : [B, T, C]

        Returns
        -------
        [B, forecast_horizon]
        """
        # TCN expects [B, C, T]
        x = x.permute(0, 2, 1)
        out = self.network(x)        # [B, channels[-1], T]
        out = out[:, :, -1]          # Last timestep
        return self.head(out)

    def predict(self, x: torch.Tensor) -> dict:
        self.eval()
        with torch.no_grad():
            pred = self.forward(x)
        return {"prediction": pred, "confidence": None, "metadata": {"model": "VegetationTCN"}}

    def get_config(self) -> dict:
        return {
            "input_size": self.input_size,
            "num_channels": self.num_channels,
            "kernel_size": self.kernel_size,
            "dropout": self.dropout,
            "forecast_horizon": self.forecast_horizon,
        }


# ===========================================================================
# 5. VegetationTransformer
# ===========================================================================

class VegetationTransformer(nn.Module):
    """
    Transformer encoder for vegetation time-series.

    Uses sinusoidal positional encoding based on acquisition DOY.

    Input  : [B, T, C]
    Output : [B, forecast_horizon]
    """

    task = "vegetation"
    model_type = "temporal_transformer"
    input_bands = VEGETATION_FEATURES_TS
    target_description = "NDVI forecast over forecast_horizon timesteps"

    def __init__(
        self,
        input_size: int = 8,
        d_model: int = 128,
        nhead: int = 8,
        num_encoder_layers: int = 4,
        dim_feedforward: int = 256,
        dropout: float = 0.1,
        forecast_horizon: int = 12,
        max_seq_len: int = 128,
    ):
        super().__init__()
        self.input_size = input_size
        self.d_model = d_model
        self.nhead = nhead
        self.num_encoder_layers = num_encoder_layers
        self.dim_feedforward = dim_feedforward
        self.dropout = dropout
        self.forecast_horizon = forecast_horizon
        self.max_seq_len = max_seq_len

        self.input_proj = nn.Linear(input_size, d_model)
        self.input_norm = nn.LayerNorm(d_model)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
            norm_first=True,       # Pre-LN for training stability
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer,
            num_layers=num_encoder_layers,
            enable_nested_tensor=False,
        )

        self.dropout_layer = nn.Dropout(dropout)

        self.head = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model, forecast_horizon),
        )

        # Pre-compute positional encoding buffer
        pe = self._positional_encoding(max_seq_len, d_model)
        self.register_buffer("positional_encoding", pe)  # [max_seq_len, d_model]

        self._init_weights()

    def _positional_encoding(self, seq_len: int, d_model: int) -> torch.Tensor:
        """Standard sinusoidal positional encoding.

        Returns
        -------
        [seq_len, d_model]
        """
        pe = torch.zeros(seq_len, d_model)
        position = torch.arange(0, seq_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float32)
            * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term[:d_model // 2])
        return pe

    def _init_weights(self) -> None:
        nn.init.xavier_uniform_(self.input_proj.weight)
        nn.init.zeros_(self.input_proj.bias)
        for m in self.head:
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(
        self,
        x: torch.Tensor,
        src_key_padding_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """
        Parameters
        ----------
        x                    : [B, T, C]
        src_key_padding_mask : [B, T] bool mask (True = padded / ignore)

        Returns
        -------
        [B, forecast_horizon]
        """
        B, T, _ = x.shape

        x = self.input_proj(x)  # [B, T, d_model]
        # Add positional encoding
        x = x + self.positional_encoding[:T].unsqueeze(0)
        x = self.input_norm(x)
        x = self.dropout_layer(x)

        enc_out = self.encoder(x, src_key_padding_mask=src_key_padding_mask)  # [B, T, d_model]

        # Global average pooling over sequence (robust to variable lengths)
        if src_key_padding_mask is not None:
            mask = (~src_key_padding_mask).float().unsqueeze(-1)  # [B, T, 1]
            context = (enc_out * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
        else:
            context = enc_out.mean(dim=1)

        return self.head(context)  # [B, forecast_horizon]

    def predict(self, x: torch.Tensor) -> dict:
        self.eval()
        with torch.no_grad():
            pred = self.forward(x)
        return {
            "prediction": pred,
            "confidence": None,
            "metadata": {"model": "VegetationTransformer"},
        }

    def get_config(self) -> dict:
        return {
            "input_size": self.input_size,
            "d_model": self.d_model,
            "nhead": self.nhead,
            "num_encoder_layers": self.num_encoder_layers,
            "dim_feedforward": self.dim_feedforward,
            "dropout": self.dropout,
            "forecast_horizon": self.forecast_horizon,
            "max_seq_len": self.max_seq_len,
        }
