#!/usr/bin/env python3
"""
Anomaly Detection Comparison
Compares multiple algorithms: Z-Score, EWMA, Isolation Forest, and IQR
"""

import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

def detect_zscore(df, window=120, sigma_mult=3.0):
    """Original Z-Score method with rolling window"""
    roll_mean = df['flows_per_min'].rolling(window=window, min_periods=1).mean()
    roll_std = df['flows_per_min'].rolling(window=window, min_periods=1).std()
    z = (df['flows_per_min'] - roll_mean) / roll_std
    anomaly_flag = (z.abs() >= sigma_mult).astype(int)
    return anomaly_flag, z

def detect_ewma(df, alpha=0.3, sigma_mult=3.0):
    """Exponentially Weighted Moving Average"""
    ewma = df['flows_per_min'].ewm(alpha=alpha, adjust=False).mean()
    ewma_std = df['flows_per_min'].ewm(alpha=alpha, adjust=False).std()
    # Replace NaN and zero std with a small value to avoid division by zero
    ewma_std = ewma_std.fillna(1.0)
    ewma_std = ewma_std.replace(0, 1.0)
    z_ewma = (df['flows_per_min'] - ewma) / ewma_std
    anomaly_flag = (z_ewma.abs() >= sigma_mult).astype(int)
    return anomaly_flag, z_ewma, ewma, ewma_std

def detect_isolation_forest(df, contamination=0.01):
    """Isolation Forest algorithm"""
    model = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
    X = df[['flows_per_min']].values
    predictions = model.fit_predict(X)
    # -1 = anomaly, 1 = normal
    anomaly_flag = (predictions == -1).astype(int)
    # Get anomaly scores (lower = more anomalous)
    scores = model.score_samples(X)
    return anomaly_flag, scores

def detect_iqr(df, multiplier=1.5):
    """Interquartile Range method with rolling window"""
    window = 120
    anomaly_flags = []
    
    for i in range(len(df)):
        if i < window:
            # Use all available data for first window points
            window_data = df['flows_per_min'].iloc[:i+1]
        else:
            window_data = df['flows_per_min'].iloc[i-window:i+1]
        
        Q1 = window_data.quantile(0.25)
        Q3 = window_data.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - multiplier * IQR
        upper_bound = Q3 + multiplier * IQR
        
        value = df['flows_per_min'].iloc[i]
        is_anomaly = (value < lower_bound) or (value > upper_bound)
        anomaly_flags.append(1 if is_anomaly else 0)
    
    return pd.Series(anomaly_flags, index=df.index)

def detect_lof(df, contamination=0.015, n_neighbors=30):
    """Local Outlier Factor - density-based anomaly detection
    
    Uses larger neighborhood (30) for more context and slightly higher contamination (1.5%)
    to differentiate from Isolation Forest which uses 1% contamination.
    """
    model = LocalOutlierFactor(contamination=contamination, n_neighbors=n_neighbors, novelty=False)
    X = df[['flows_per_min']].values
    predictions = model.fit_predict(X)
    # -1 = anomaly, 1 = normal
    anomaly_flag = (predictions == -1).astype(int)
    # Get negative outlier factor scores (more negative = more anomalous)
    scores = model.negative_outlier_factor_
    return anomaly_flag, scores

def main():
    # Read input CSV
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "synthetic_flows.csv")
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found")
        return
    
    df = pd.read_csv(csv_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    print(f"Loaded {len(df)} records from {csv_path}")
    
    # Run all detection algorithms
    print("\n=== Running Detection Algorithms ===")
    
    # 1. Z-Score (original)
    print("1. Z-Score (Rolling Window)...")
    zscore_flags, z_values = detect_zscore(df)
    zscore_count = zscore_flags.sum()
    
    # 2. EWMA
    print("2. EWMA (Exponentially Weighted Moving Average)...")
    ewma_flags, z_ewma, ewma_mean, ewma_std = detect_ewma(df)
    ewma_count = ewma_flags.sum()
    
    # 3. Isolation Forest
    print("3. Isolation Forest...")
    iforest_flags, iforest_scores = detect_isolation_forest(df)
    iforest_count = iforest_flags.sum()
    
    # 4. IQR
    print("4. IQR (Interquartile Range)...")
    iqr_flags = detect_iqr(df)
    iqr_count = iqr_flags.sum()
    
    # 5. LOF
    print("5. LOF (Local Outlier Factor)...")
    lof_flags, lof_scores = detect_lof(df)
    lof_count = lof_flags.sum()
    
    # Print summary
    print("\n=== Detection Summary ===")
    print(f"Z-Score:          {zscore_count} anomalies ({zscore_count/len(df)*100:.2f}%)")
    print(f"EWMA:             {ewma_count} anomalies ({ewma_count/len(df)*100:.2f}%)")
    print(f"Isolation Forest: {iforest_count} anomalies ({iforest_count/len(df)*100:.2f}%)")
    print(f"IQR:              {iqr_count} anomalies ({iqr_count/len(df)*100:.2f}%)")
    print(f"LOF:              {lof_count} anomalies ({lof_count/len(df)*100:.2f}%)")
    
    # Save results to CSV with additional statistical data
    output_df = df.copy()
    output_df['zscore_flag'] = zscore_flags
    output_df['ewma_flag'] = ewma_flags
    output_df['iforest_flag'] = iforest_flags
    output_df['iqr_flag'] = iqr_flags
    output_df['lof_flag'] = lof_flags
    
    # Add rolling statistics for Z-Score visualization
    window = 120
    output_df['roll_mean'] = df['flows_per_min'].rolling(window=window, min_periods=1).mean()
    output_df['roll_std'] = df['flows_per_min'].rolling(window=window, min_periods=1).std()
    
    output_csv = os.path.join(script_dir, "detection_comparison.csv")
    output_df.to_csv(output_csv, index=False)
    print(f"\nWrote results to: {output_csv}")
    
    # Create comparison visualization
    fig, axes = plt.subplots(5, 1, figsize=(14, 15), sharex=True)
    
    # Plot 1: Z-Score
    ax = axes[0]
    ax.plot(df['timestamp'], df['flows_per_min'], 'b-', alpha=0.6, linewidth=0.8, label='Flows/min')
    anomaly_idx = zscore_flags == 1
    ax.scatter(df.loc[anomaly_idx, 'timestamp'], df.loc[anomaly_idx, 'flows_per_min'], 
               color='red', s=20, alpha=0.7, label=f'Anomalies ({zscore_count})', zorder=5)
    ax.set_ylabel('Flows/min')
    ax.set_title('Z-Score (Rolling Window)', fontsize=12, fontweight='bold')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    # Plot 2: EWMA
    ax = axes[1]
    ax.plot(df['timestamp'], df['flows_per_min'], 'b-', alpha=0.6, linewidth=0.8, label='Flows/min')
    ax.plot(df['timestamp'], ewma_mean, 'g-', alpha=0.8, linewidth=1, label='EWMA Mean')
    anomaly_idx = ewma_flags == 1
    ax.scatter(df.loc[anomaly_idx, 'timestamp'], df.loc[anomaly_idx, 'flows_per_min'], 
               color='red', s=20, alpha=0.7, label=f'Anomalies ({ewma_count})', zorder=5)
    ax.set_ylabel('Flows/min')
    ax.set_title('EWMA (Exponentially Weighted Moving Average)', fontsize=12, fontweight='bold')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    # Plot 3: Isolation Forest
    ax = axes[2]
    ax.plot(df['timestamp'], df['flows_per_min'], 'b-', alpha=0.6, linewidth=0.8, label='Flows/min')
    anomaly_idx = iforest_flags == 1
    ax.scatter(df.loc[anomaly_idx, 'timestamp'], df.loc[anomaly_idx, 'flows_per_min'], 
               color='red', s=20, alpha=0.7, label=f'Anomalies ({iforest_count})', zorder=5)
    ax.set_ylabel('Flows/min')
    ax.set_title('Isolation Forest', fontsize=12, fontweight='bold')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    # Plot 4: IQR
    ax = axes[3]
    ax.plot(df['timestamp'], df['flows_per_min'], 'b-', alpha=0.6, linewidth=0.8, label='Flows/min')
    anomaly_idx = iqr_flags == 1
    ax.scatter(df.loc[anomaly_idx, 'timestamp'], df.loc[anomaly_idx, 'flows_per_min'], 
               color='red', s=20, alpha=0.7, label=f'Anomalies ({iqr_count})', zorder=5)
    ax.set_ylabel('Flows/min')
    ax.set_title('IQR (Interquartile Range)', fontsize=12, fontweight='bold')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    # Plot 5: LOF
    ax = axes[4]
    ax.plot(df['timestamp'], df['flows_per_min'], 'b-', alpha=0.6, linewidth=0.8, label='Flows/min')
    anomaly_idx = lof_flags == 1
    ax.scatter(df.loc[anomaly_idx, 'timestamp'], df.loc[anomaly_idx, 'flows_per_min'], 
               color='red', s=20, alpha=0.7, label=f'Anomalies ({lof_count})', zorder=5)
    ax.set_ylabel('Flows/min')
    ax.set_xlabel('Time')
    ax.set_title('LOF (Local Outlier Factor)', fontsize=12, fontweight='bold')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save figure
    fig_dir = os.path.join(script_dir, "figures")
    os.makedirs(fig_dir, exist_ok=True)
    fig_path = os.path.join(fig_dir, "detection_comparison.png")
    plt.savefig(fig_path, dpi=150, bbox_inches='tight')
    print(f"Wrote comparison figure: {fig_path}")
    
    # Create summary statistics JSON
    import json
    summary = {
        "algorithms": [
            {
                "name": "Z-Score",
                "anomalies": int(zscore_count),
                "rate": float(zscore_count/len(df)*100)
            },
            {
                "name": "EWMA",
                "anomalies": int(ewma_count),
                "rate": float(ewma_count/len(df)*100)
            },
            {
                "name": "Isolation Forest",
                "anomalies": int(iforest_count),
                "rate": float(iforest_count/len(df)*100)
            },
            {
                "name": "IQR",
                "anomalies": int(iqr_count),
                "rate": float(iqr_count/len(df)*100)
            },
            {
                "name": "LOF",
                "anomalies": int(lof_count),
                "rate": float(lof_count/len(df)*100)
            }
        ],
        "total_points": len(df)
    }
    
    summary_json = os.path.join(fig_dir, "detection_comparison_summary.json")
    with open(summary_json, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Wrote summary JSON: {summary_json}")
    
    print("\n=== Comparison Complete ===")

if __name__ == "__main__":
    main()
