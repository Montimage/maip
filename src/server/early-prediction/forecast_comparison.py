#!/usr/bin/env python3
"""
Multi-Algorithm Forecast Comparison
Generates forecasts using different methods matching detection algorithms
"""

import os
import pandas as pd
import numpy as np
import json
from sklearn.linear_model import LinearRegression, HuberRegressor
from sklearn.ensemble import RandomForestRegressor
import warnings
warnings.filterwarnings('ignore')

def forecast_zscore(df, anomaly_column, forecast_minutes=60):
    """Z-Score: Simple moving average with trend"""
    train_window = 5 * 24 * 60
    train_df = df.iloc[-train_window:].copy() if len(df) > train_window else df.copy()
    
    # Simple linear regression on recent data
    train_df['minute_of_day'] = pd.to_datetime(train_df['timestamp']).dt.hour * 60 + pd.to_datetime(train_df['timestamp']).dt.minute
    train_df['day_of_week'] = pd.to_datetime(train_df['timestamp']).dt.dayofweek
    
    for lag in [1, 5, 10, 60]:
        train_df[f'lag_{lag}'] = train_df['flows_per_min'].shift(lag)
    
    train_df = train_df.dropna()
    feature_cols = ['minute_of_day', 'day_of_week'] + [f'lag_{lag}' for lag in [1, 5, 10, 60]]
    X_train = train_df[feature_cols].values
    y_train = train_df['flows_per_min'].values
    
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    return model, train_df

def forecast_ewma(df, anomaly_column, forecast_minutes=60):
    """EWMA: Exponentially weighted forecast giving more weight to recent data"""
    train_window = 5 * 24 * 60
    train_df = df.iloc[-train_window:].copy() if len(df) > train_window else df.copy()
    
    # Calculate exponential weights (more weight to recent data)
    alpha = 0.3
    weights = np.array([alpha * (1 - alpha) ** i for i in range(len(train_df))][::-1])
    weights = weights / weights.sum()  # Normalize
    
    train_df['minute_of_day'] = pd.to_datetime(train_df['timestamp']).dt.hour * 60 + pd.to_datetime(train_df['timestamp']).dt.minute
    train_df['day_of_week'] = pd.to_datetime(train_df['timestamp']).dt.dayofweek
    
    for lag in [1, 5, 10, 60]:
        train_df[f'lag_{lag}'] = train_df['flows_per_min'].shift(lag)
    
    train_df = train_df.dropna()
    feature_cols = ['minute_of_day', 'day_of_week'] + [f'lag_{lag}' for lag in [1, 5, 10, 60]]
    X_train = train_df[feature_cols].values
    y_train = train_df['flows_per_min'].values
    
    # Use weighted regression
    model = LinearRegression()
    sample_weights = weights[-len(X_train):]
    model.fit(X_train, y_train, sample_weight=sample_weights)
    
    return model, train_df

def forecast_iforest(df, anomaly_column, forecast_minutes=60):
    """Isolation Forest: Train only on normal data, use Random Forest"""
    train_window = 5 * 24 * 60
    train_df = df.iloc[-train_window:].copy() if len(df) > train_window else df.copy()
    
    # Filter out anomalies for training
    train_df = train_df[train_df[anomaly_column] == 0].copy()
    
    train_df['minute_of_day'] = pd.to_datetime(train_df['timestamp']).dt.hour * 60 + pd.to_datetime(train_df['timestamp']).dt.minute
    train_df['day_of_week'] = pd.to_datetime(train_df['timestamp']).dt.dayofweek
    
    for lag in [1, 5, 10, 60]:
        train_df[f'lag_{lag}'] = train_df['flows_per_min'].shift(lag)
    
    train_df = train_df.dropna()
    feature_cols = ['minute_of_day', 'day_of_week'] + [f'lag_{lag}' for lag in [1, 5, 10, 60]]
    X_train = train_df[feature_cols].values
    y_train = train_df['flows_per_min'].values
    
    # Use Random Forest (ensemble method like Isolation Forest)
    model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    return model, train_df

def forecast_iqr(df, anomaly_column, forecast_minutes=60):
    """IQR: Robust regression resistant to outliers"""
    train_window = 5 * 24 * 60
    train_df = df.iloc[-train_window:].copy() if len(df) > train_window else df.copy()
    
    train_df['minute_of_day'] = pd.to_datetime(train_df['timestamp']).dt.hour * 60 + pd.to_datetime(train_df['timestamp']).dt.minute
    train_df['day_of_week'] = pd.to_datetime(train_df['timestamp']).dt.dayofweek
    
    for lag in [1, 5, 10, 60]:
        train_df[f'lag_{lag}'] = train_df['flows_per_min'].shift(lag)
    
    train_df = train_df.dropna()
    feature_cols = ['minute_of_day', 'day_of_week'] + [f'lag_{lag}' for lag in [1, 5, 10, 60]]
    X_train = train_df[feature_cols].values
    y_train = train_df['flows_per_min'].values
    
    # Use Huber Regressor (robust to outliers, similar to IQR philosophy)
    model = HuberRegressor(epsilon=1.35, max_iter=100)
    model.fit(X_train, y_train)
    
    return model, train_df

def generate_forecast(model, train_df, forecast_minutes=60):
    """Generate forecast using trained model"""
    
    # Generate forecast
    last_row = train_df.iloc[-1]
    last_timestamp = pd.to_datetime(last_row['timestamp'])
    
    forecast_data = []
    current_lags = {
        1: last_row['flows_per_min'],
        5: train_df['flows_per_min'].iloc[-5] if len(train_df) >= 5 else last_row['flows_per_min'],
        10: train_df['flows_per_min'].iloc[-10] if len(train_df) >= 10 else last_row['flows_per_min'],
        60: train_df['flows_per_min'].iloc[-60] if len(train_df) >= 60 else last_row['flows_per_min']
    }
    
    predictions = []
    
    for i in range(1, forecast_minutes + 1):
        future_timestamp = last_timestamp + pd.Timedelta(minutes=i)
        minute_of_day = future_timestamp.hour * 60 + future_timestamp.minute
        day_of_week = future_timestamp.dayofweek
        
        # Prepare features
        X_pred = np.array([[
            minute_of_day,
            day_of_week,
            current_lags[1],
            current_lags[5],
            current_lags[10],
            current_lags[60]
        ]])
        
        # Predict
        pred = model.predict(X_pred)[0]
        predictions.append(pred)
        
        # Update lags
        current_lags[60] = current_lags[10] if i >= 50 else current_lags[60]
        current_lags[10] = current_lags[5] if i >= 5 else current_lags[10]
        current_lags[5] = current_lags[1] if i >= 1 else current_lags[5]
        current_lags[1] = pred
        
        forecast_data.append({
            'timestamp': future_timestamp.isoformat(),
            'pred': float(pred)
        })
    
    # Calculate prediction intervals using standard deviation of predictions
    std_residual = np.std(train_df['flows_per_min'])
    
    for i, row in enumerate(forecast_data):
        row['lower95'] = float(row['pred'] - 1.96 * std_residual)
        row['upper95'] = float(row['pred'] + 1.96 * std_residual)
    
    # Return as DataFrame
    forecast_df = pd.DataFrame(forecast_data)
    
    return forecast_df

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Read comparison CSV with all algorithm results
    csv_path = os.path.join(script_dir, "detection_comparison.csv")
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found. Run detect_comparison.py first.")
        return
    
    df = pd.read_csv(csv_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    print(f"Loaded {len(df)} records from {csv_path}")
    
    # Algorithms to forecast with their specific methods
    algorithms = {
        'zscore': ('zscore_flag', forecast_zscore),
        'ewma': ('ewma_flag', forecast_ewma),
        'iforest': ('iforest_flag', forecast_iforest),
        'iqr': ('iqr_flag', forecast_iqr)
    }
    
    # Generate forecasts for each algorithm
    all_forecasts = {}
    
    print("\n=== Generating Forecasts ===")
    for algo_name, (flag_column, forecast_func) in algorithms.items():
        print(f"Forecasting with {algo_name.upper()} method...")
        
        # Train algorithm-specific model
        model, train_df = forecast_func(df, flag_column, forecast_minutes=60)
        
        # Generate forecast
        forecast_df = generate_forecast(model, train_df, forecast_minutes=60)
        
        # Calculate threshold and early warning
        mean_flow = train_df['flows_per_min'].mean()
        std_flow = train_df['flows_per_min'].std()
        threshold = mean_flow + 3 * std_flow
        
        mean_forecast = forecast_df['pred'].mean()
        max_upper95 = forecast_df['upper95'].max()
        
        early_warning = False
        warning_reasons = []
        
        if mean_forecast > threshold:
            early_warning = True
            warning_reasons.append("mean forecast crosses 3σ threshold")
        
        if max_upper95 > threshold:
            early_warning = True
            warning_reasons.append("upper 95% band crosses 3σ threshold")
        
        all_forecasts[algo_name] = {
            'forecast': forecast_df.to_dict(orient='records'),
            'early_warning': bool(early_warning),
            'warning_reasons': warning_reasons,
            'anomaly_threshold': float(threshold)
        }
        
        print(f"  - Threshold: {threshold:.2f}")
        print(f"  - Early Warning: {early_warning}")
        if warning_reasons:
            print(f"  - Reasons: {', '.join(warning_reasons)}")
    
    # Get historical data (last 12 hours)
    hist_window = 12 * 60  # 12 hours
    hist_df = df.iloc[-hist_window:][['timestamp', 'flows_per_min']].copy()
    
    # Prepare export data
    export_data = {
        'historical': hist_df.to_dict(orient='records'),
        'forecasts': all_forecasts
    }
    
    # Convert timestamps to ISO format
    for item in export_data['historical']:
        item['timestamp'] = item['timestamp'].isoformat() if hasattr(item['timestamp'], 'isoformat') else str(item['timestamp'])
        item['flows_per_min'] = float(item['flows_per_min'])
    
    # Save to JSON
    fig_dir = os.path.join(script_dir, "figures")
    os.makedirs(fig_dir, exist_ok=True)
    
    output_json = os.path.join(fig_dir, "forecast_comparison_data.json")
    with open(output_json, "w") as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\n=== Forecast Comparison Complete ===")
    print(f"Wrote forecast data: {output_json}")
    
    # Summary
    print("\n=== Summary ===")
    for algo_name in algorithms.keys():
        warning_status = "⚠️ WARNING" if all_forecasts[algo_name]['early_warning'] else "✓ Normal"
        print(f"{algo_name.upper():15} {warning_status}")

if __name__ == "__main__":
    main()
