#!/usr/bin/env python3
"""
script1_detect.py
- Loads synthetic_flows.csv
- Applies rolling z-score anomaly detection (3σ rule) on flows_per_min
- Saves an annotated plot to figures/detect_overview.png
"""
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def detect_anomalies(df, col="flows_per_min", window=120):
    df = df.copy()
    df["roll_mean"] = df[col].rolling(window, min_periods=window//2).mean()
    df["roll_std"] = df[col].rolling(window, min_periods=window//2).std(ddof=0)
    df["z"] = (df[col] - df["roll_mean"]) / df["roll_std"]
    # 3σ rule
    df["anomaly_flag"] = (df["z"].abs() >= 3).astype(int)
    return df

def main():
    base = os.path.dirname(__file__) or "."
    data_path = os.path.join(base, "synthetic_flows.csv")
    out_dir = os.path.join(base, "figures")
    os.makedirs(out_dir, exist_ok=True)

    df = pd.read_csv(data_path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp")

    df_det = detect_anomalies(df, "flows_per_min", window=120)

    # Save enriched CSV
    out_csv = os.path.join(base, "synthetic_flows_detected.csv")
    df_det.to_csv(out_csv, index=False)

    # Plot a 1.5-day window around the most recent major attack for clarity
    last_attack_idx = df_det.index[df_det["label"]==2]
    if len(last_attack_idx) > 0:
        center = last_attack_idx[-1]
        span = 60*36  # 36 hours
        lo = max(0, center - span//2)
        hi = min(len(df_det)-1, center + span//2)
        plot_df = df_det.iloc[lo:hi+1]
    else:
        plot_df = df_det.tail(60*24)  # last day as fallback

    plt.figure(figsize=(12,5))
    plt.plot(plot_df["timestamp"], plot_df["flows_per_min"], label="flows_per_min")
    plt.plot(plot_df["timestamp"], plot_df["roll_mean"], label="rolling_mean")
    upper = (plot_df["roll_mean"] + 3*plot_df["roll_std"]).to_numpy(dtype=float)
    lower = (plot_df["roll_mean"] - 3*plot_df["roll_std"]).to_numpy(dtype=float)
    # Replace NaNs at the edges for plotting
    import numpy as _np
    mask = _np.isnan(upper) | _np.isnan(lower)
    if mask.any():
        # forward/backward fill simple
        def _ffill(a):
            last = _np.nan
            out = []
            for v in a:
                if not _np.isnan(v): last = v
                out.append(last)
            # backfill
            last = _np.nan
            for i in range(len(out)-1, -1, -1):
                if not _np.isnan(out[i]): last = out[i]
                elif not _np.isnan(last): out[i] = last
            return _np.array(out, dtype=float)
        upper = _ffill(upper)
        lower = _ffill(lower)
    plt.fill_between(plot_df["timestamp"], upper, lower, alpha=0.2, label="±3σ band")
    # Mark anomalies
    anomalies = plot_df[plot_df["anomaly_flag"]==1]
    plt.scatter(anomalies["timestamp"], anomalies["flows_per_min"], s=15, marker="o", label="3σ anomaly")

    plt.title("Rolling 3σ Anomaly Detection on flows_per_min")
    plt.xlabel("Time")
    plt.ylabel("Flows per minute")
    plt.legend()
    plt.tight_layout()
    fig_path = os.path.join(out_dir, "detect_overview.png")
    plt.savefig(fig_path, dpi=150)
    print(f"Wrote: {out_csv}")
    print(f"Wrote: {fig_path}")

if __name__ == "__main__":
    main()