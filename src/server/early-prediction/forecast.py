#!/usr/bin/env python3
"""
script2_forecast.py
- Loads synthetic_flows_detected.csv (or synthetic_flows.csv if not present)
- Builds a simple OLS model using lag features and time-of-day seasonality
- Forecasts the next 60 minutes with 95% prediction bands
- Emits an "early warning" if forecasted mean or upper band exceeds the 3σ anomaly threshold
- Produces a figure at figures/forecast_next_hour.png
- Prints a brief explanation of which lags/time-of-day terms contributed (by coefficient magnitude)
"""
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

FORECAST_HORIZON = 60      # minutes
LAGS = 12                  # use t-1 ... t-12
TRAIN_WINDOW = 60*24*5     # last 5 days for training
SIGMA_MULT = 3.0

def add_time_features(df):
    df = df.copy()
    # time-of-day seasonality via sin/cos
    minutes_in_day = 24*60
    minute_of_day = (df["timestamp"].dt.hour*60 + df["timestamp"].dt.minute).astype(int)
    angle = 2*np.pi*minute_of_day/minutes_in_day
    df["tod_sin"] = np.sin(angle)
    df["tod_cos"] = np.cos(angle)
    return df

def build_lags(y, lags=LAGS):
    X = []
    for i in range(1, lags+1):
        X.append(np.roll(y, i))
    X = np.vstack(X).T
    return X

def fit_ols(X, y):
    # X: (n, p), y: (n,)
    # add intercept
    X_aug = np.hstack([np.ones((X.shape[0],1)), X])
    beta, *_ = np.linalg.lstsq(X_aug, y, rcond=None)
    yhat = X_aug @ beta
    resid = y - yhat
    sigma = np.std(resid, ddof=X_aug.shape[1])
    return beta, sigma, yhat, resid

def main():
    base = os.path.dirname(__file__) or "."
    data_detected = os.path.join(base, "synthetic_flows_detected.csv")
    data_raw = os.path.join(base, "synthetic_flows.csv")
    out_dir = os.path.join(base, "figures")
    os.makedirs(out_dir, exist_ok=True)

    if os.path.exists(data_detected):
        df = pd.read_csv(data_detected, parse_dates=["timestamp"])
    else:
        df = pd.read_csv(data_raw, parse_dates=["timestamp"])

    df = df.sort_values("timestamp").reset_index(drop=True)
    df = add_time_features(df)

    y = df["flows_per_min"].values.astype(float)

    # training slice from the tail
    end = len(df)-1
    start = max(0, end-TRAIN_WINDOW+1)
    df_train = df.iloc[start:end+1].copy()
    y_train = df_train["flows_per_min"].values.astype(float)

    # Build lag matrix from the training y
    X_lags = build_lags(y_train, LAGS)
    # Mask-out first LAGS rows (invalid due to roll)
    valid_mask = np.arange(len(df_train)) >= LAGS
    X_lags = X_lags[valid_mask]
    # time features aligned
    X_time = df_train.loc[valid_mask, ["tod_sin","tod_cos"]].values
    # Combine
    X = np.hstack([X_lags, X_time])
    y_fit = y_train[valid_mask]

    beta, sigma, yhat, resid = fit_ols(X, y_fit)

    # Prepare to forecast next H minutes recursively
    hist = y[-LAGS:].tolist()
    last_ts = df["timestamp"].iloc[-1]
    freq = pd.infer_freq(df["timestamp"])
    if freq is None:
        freq = "min"
    future_times = pd.date_range(last_ts + pd.Timedelta(minutes=1), periods=FORECAST_HORIZON, freq=freq)
    preds = []
    lower = []
    upper = []
    contrib_records = []  # store contributions per step

    # anomaly threshold from training (3σ around rolling mean approximation via global mean/std of train)
    mu_hist = np.mean(y_fit)
    std_hist = np.std(y_fit, ddof=1)
    anomaly_threshold = mu_hist + SIGMA_MULT*std_hist

    # feature names for contributions
    lag_names = [f"lag_{i}" for i in range(1, LAGS+1)]
    feat_names = lag_names + ["tod_sin", "tod_cos"]

    for ts in future_times:
        # construct feature row: lags from hist + time features
        lags_row = np.array(hist[::-1])[:LAGS]  # hist[-1] is t-1
        # ensure order t-1 ... t-LAGS
        lags_row = lags_row[:LAGS]
        # time features
        minute_of_day = ts.hour*60 + ts.minute
        angle = 2*np.pi*minute_of_day/(24*60)
        tod_sin = np.sin(angle)
        tod_cos = np.cos(angle)

        x_row = np.hstack([lags_row, [tod_sin, tod_cos]]).astype(float)

        # linear prediction
        # beta: [intercept, lag_1...lag_L, tod_sin, tod_cos]
        intercept = beta[0]
        coef = beta[1:]
        y_pred = intercept + np.dot(coef, x_row)

        # prediction interval using residual sigma (simple)
        preds.append(y_pred)
        lower.append(y_pred - 1.96*sigma)
        upper.append(y_pred + 1.96*sigma)

        # record approximate contributions (coef_i * x_i)
        contrib = {name: float(c*w) for name, c, w in zip(feat_names, coef, x_row)}
        # sort by absolute contribution
        top = sorted(contrib.items(), key=lambda kv: abs(kv[1]), reverse=True)[:5]
        contrib_records.append({"timestamp": ts.isoformat(), "top_contributions": top})

        # recursive: append to history
        hist.append(y_pred)
        if len(hist) > LAGS:
            hist = hist[-LAGS:]

    forecast_df = pd.DataFrame({
        "timestamp": future_times,
        "pred": preds,
        "lower95": lower,
        "upper95": upper,
        "anomaly_threshold": anomaly_threshold
    })

    # Early warning logic
    warn = (forecast_df["pred"].max() >= anomaly_threshold) or (forecast_df["upper95"].max() >= anomaly_threshold)
    reason = []
    if forecast_df["pred"].max() >= anomaly_threshold:
        reason.append("mean forecast crosses 3σ threshold")
    if forecast_df["upper95"].max() >= anomaly_threshold:
        reason.append("upper 95% band crosses 3σ threshold")

    # Plot last 12 hours + next hour forecast
    lookback = 60*12
    hist_df = df.iloc[-lookback:].copy()

    plt.figure(figsize=(12,5))
    plt.plot(hist_df["timestamp"], hist_df["flows_per_min"], label="observed")
    plt.plot(forecast_df["timestamp"], forecast_df["pred"], label="forecast")
    low = forecast_df["lower95"].to_numpy(dtype=float)
    up = forecast_df["upper95"].to_numpy(dtype=float)
    plt.fill_between(forecast_df["timestamp"], low, up, alpha=0.2, label="95% PI")
    plt.hlines(anomaly_threshold, xmin=hist_df["timestamp"].iloc[0], xmax=forecast_df["timestamp"].iloc[-1], linestyles="dashed", label="3σ threshold")
    plt.title("Short-term Forecast and Early Warning")
    plt.xlabel("Time")
    plt.ylabel("Flows per minute")
    plt.legend()
    plt.tight_layout()
    fig_path = os.path.join(out_dir, "forecast_next_hour.png")
    plt.savefig(fig_path, dpi=150)

    # Print a human-readable explanation
    print(f"Wrote forecast figure: {fig_path}")
    print(f"3σ anomaly threshold (train): {anomaly_threshold:.2f}")
    if warn:
        print("EARLY WARNING: Potential staged attack forecasted! Reason(s): " + "; ".join(reason))
    else:
        print("No early-warning trigger based on the next hour forecast.")

    # Show average top contributors across horizon
    # Aggregate contribution magnitudes
    agg = {}
    for rec in contrib_records:
        for name, val in rec["top_contributions"]:
            agg.setdefault(name, []).append(abs(val))
    contrib_summary = sorted([(k, float(np.mean(v))) for k,v in agg.items()], key=lambda kv: kv[1], reverse=True)[:5]
    print("Top contributing temporal terms (avg |coef*x| over horizon):")
    for name, score in contrib_summary:
        print(f"  - {name}: {score:.2f}")

    # Save machine-readable artifacts
    contrib_json = os.path.join(out_dir, "forecast_top_contributions.json")
    import json
    with open(contrib_json, "w") as f:
        json.dump(contrib_records, f, indent=2)
    print(f"Wrote contributions detail: {contrib_json}")
    
    # Save forecast data for interactive visualization
    forecast_data_json = os.path.join(out_dir, "forecast_data.json")
    forecast_export = {
        "historical": hist_df[["timestamp", "flows_per_min"]].to_dict(orient="records"),
        "forecast": forecast_df.to_dict(orient="records"),
        "anomaly_threshold": float(anomaly_threshold),
        "early_warning": bool(warn),  # Convert numpy bool to Python bool
        "warning_reasons": reason
    }
    # Convert timestamps and numeric types to JSON-serializable formats
    for item in forecast_export["historical"]:
        item["timestamp"] = item["timestamp"].isoformat() if hasattr(item["timestamp"], "isoformat") else str(item["timestamp"])
        item["flows_per_min"] = float(item["flows_per_min"])
    for item in forecast_export["forecast"]:
        item["timestamp"] = item["timestamp"].isoformat() if hasattr(item["timestamp"], "isoformat") else str(item["timestamp"])
        item["pred"] = float(item["pred"])
        item["lower95"] = float(item["lower95"])
        item["upper95"] = float(item["upper95"])
        item["anomaly_threshold"] = float(item["anomaly_threshold"])
    
    with open(forecast_data_json, "w") as f:
        json.dump(forecast_export, f, indent=2)
    print(f"Wrote forecast data: {forecast_data_json}")

if __name__ == "__main__":
    main()