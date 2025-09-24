import json
import os
import warnings
import shap
import numpy as np
import pandas as pd
from pathlib import Path
from tensorflow.keras.models import load_model
from datetime import datetime
from tools import dataScale_cnn
import constants

"""
Usage: python xai-shap-instance.py <modelId> <instance_json_path> <numberFeatures>
- instance_json_path: JSON with either a list of values (ordered as constants.AD_FEATURES[3:])
  or a dict featureName->value. Dict will be aligned to constants.AD_FEATURES[3:].
Writes:
- deep-learning/xai/<model_name>/Malware_shap_values.json (local explanation for this instance)
- deep-learning/xai/<model_name>/instance_probs.json (normal/malware probabilities for the instance)
"""

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
features_names = constants.AD_FEATURES[3:]

if __name__ == "__main__":
  import sys
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python xai-shap-instance.py modelId instance_json_path numberFeatures')
    sys.exit(1)

  modelId = sys.argv[1]
  instance_json_path = sys.argv[2]
  numberFeatures = int(sys.argv[3])

  model_name = os.path.splitext(modelId)[0]
  model = load_model(deepLearningPath + '/models/' + modelId)
  print("Model has been loaded ...")

  output_path = deepLearningPath + '/trainings/' + model_name
  output_datasets_path = output_path + '/datasets/'
  train_data_path = os.path.join(output_datasets_path,'Train_samples.csv')
  test_data_path = os.path.join(output_datasets_path,'Test_samples.csv')

  train_data = pd.read_csv(train_data_path, delimiter=",")
  train_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)
  test_data = pd.read_csv(test_data_path, delimiter=",")
  test_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

  # Prepare scaler and training data for explainer
  d = datetime.now()
  x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler = dataScale_cnn(output_path,
    train_data, test_data, datetime=d)

  # Load instance raw features (not scaled), support list or dict
  with open(instance_json_path, 'r') as f:
    instance_payload = json.load(f)

  if isinstance(instance_payload, list):
    exp_len = len(features_names)
    if len(instance_payload) < exp_len:
      padded = instance_payload + [0] * (exp_len - len(instance_payload))
      ordered_values = [float(v) for v in padded[:exp_len]]
    else:
      ordered_values = [float(v) for v in instance_payload[:exp_len]]
  elif isinstance(instance_payload, dict):
    ordered_values = [float(instance_payload.get(name, 0)) for name in features_names]
  else:
    raise ValueError('instance_json must be either an array (ordered values) or an object (featureName->value)')

  # Scale instance according to training scaler
  instance_arr = np.array(ordered_values, dtype=float).reshape(1, -1)
  instance_scaled = scaler.transform(instance_arr)

  # KernelExplainer with a background subset from x_train
  background_idx = np.random.choice(x_train.shape[0], min(100, x_train.shape[0]), replace=False)
  background = x_train[background_idx]
  explainer = shap.KernelExplainer(model.predict, background)

  with warnings.catch_warnings():
    warnings.filterwarnings("ignore")
    shap_values = explainer.shap_values(instance_scaled, nsamples='auto')

  # shap_values may be a list (per-class) or array. We take the malware class if list.
  if isinstance(shap_values, list):
    # If model outputs a single probability, SHAP returns a single array
    shap_arr = shap_values[-1] if len(shap_values) > 1 else shap_values[0]
  else:
    shap_arr = shap_values

  # Convert to feature/value pairs, limited by numberFeatures (sorted by absolute value)
  vals = shap_arr.reshape(-1)
  pairs = list(zip(features_names, vals))
  pairs_sorted = sorted(pairs, key=lambda x: abs(x[1]), reverse=True)[:numberFeatures]
  shap_values_to_display = [{"feature": f, "importance_value": float(v)} for f, v in pairs_sorted]

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  values_file = os.path.join(explanations_path, f'Malware_importance_values.json')
  with open(values_file, 'w') as outfile:
    json.dump(shap_values_to_display, outfile)

  # Also write instance-level predicted probabilities for UI pie chart (Normal vs Malware)
  try:
    raw = model.predict(instance_arr)
    flat = raw.reshape(-1)
    if flat.shape[0] == 1:
      malware = float(flat[0])
      normal = float(1.0 - malware)
      probs = [normal, malware]
    else:
      # assume [Normal, Malware]
      probs = [float(flat[0]), float(flat[1])]
    probs_file = os.path.join(explanations_path, 'instance_probs.json')
    with open(probs_file, 'w') as pf:
      json.dump({"normal": probs[0], "malware": probs[1]}, pf)
  except Exception:
    pass
