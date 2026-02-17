import json
import os
import sys
import pandas as pd
import numpy as np
from pathlib import Path
from tensorflow.keras.models import load_model
from datetime import datetime
from lime import lime_tabular
from tools import dataScale_cnn
import constants

"""
Usage: python xai-lime-instance.py <modelId> <instance_json_path> <numberFeatures>
- modelId: e.g., ad-my-model.h5
- instance_json_path: JSON file containing either:
    - an array of raw feature values in the SAME order as constants.AD_FEATURES[3:], or
    - an object mapping featureName -> value, where featureName belongs to constants.AD_FEATURES[3:]
- numberFeatures: max number of features in explanation

The script loads the training/test datasets to construct the explainer and scaler, aligns and scales the provided
instance, computes LIME explanations for the Malware class (index 1 for AD), and writes outputs to:
  deep-learning/xai/<model_name>/Malware_lime_explanations.json
  deep-learning/xai/<model_name>/Malware_lime_values.json
It also writes time stats to time_stats_lime.txt
"""

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
features_names = constants.AD_FEATURES[3:]  # drop ['ip.session_id', 'meta.direction', 'ip']

if __name__ == "__main__":
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python xai-lime-instance.py modelId instance_json_path numberFeatures')
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
    # Be resilient to length mismatch: trim extras or pad zeros
    exp_len = len(features_names)
    if len(instance_payload) < exp_len:
      padded = instance_payload + [0] * (exp_len - len(instance_payload))
      ordered_values = [float(v) for v in padded[:exp_len]]
    else:
      ordered_values = [float(v) for v in instance_payload[:exp_len]]
  elif isinstance(instance_payload, dict):
    # Build in the exact order of features_names, default missing keys to 0
    ordered_values = [float(instance_payload.get(name, 0)) for name in features_names]
  else:
    raise ValueError('instance_json must be either an array (ordered values) or an object (featureName->value)')

  # Scale instance according to training scaler
  instance_arr = np.array(ordered_values, dtype=float).reshape(1, -1)
  instance_scaled = scaler.transform(instance_arr).reshape(-1)

  # Build explainer
  classes=['Normal', 'Malware']
  explainer = lime_tabular.LimeTabularExplainer(x_train,
                                  training_labels=y_train,
                                  mode="classification",
                                  feature_selection= 'auto',
                                  class_names=classes,
                                  feature_names=features_names,
                                  kernel_width=None,
                                  discretize_continuous=True)

  # Explain provided instance for Malware; model outputs a single probability column -> label index 0
  explanation = explainer.explain_instance(instance_scaled, model.predict, labels=(0,), num_features=numberFeatures)
  full_explanation = explainer.explain_instance(instance_scaled, model.predict, labels=(0,), num_features=len(features_names))
  full_lime_exps = full_explanation.as_list(label=0)
  full_lime_values = full_explanation.as_map()

  columns = ['feature','value']
  exps_to_display = [dict(zip(columns, row)) for row in full_lime_exps]
  values_to_display = [{"feature": features_names[x], "value": y} for x, y in full_lime_values[0]]

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  label = classes[1]
  exps_file = os.path.join(explanations_path, f'{label}_lime_explanations.json')
  with open(exps_file, "w") as outfile:
    json.dump(exps_to_display, outfile)

  values_file = os.path.join(explanations_path, f'{label}_lime_values.json')
  with open(values_file, "w") as outfile:
    json.dump(values_to_display, outfile)

  # time stats
  statsfile = os.path.join(explanations_path, 'time_stats_lime.txt')
  with open(statsfile, 'w') as f:
    f.write('flow-instance')

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
  except Exception as e:
    # Do not fail the entire run if probs writing fails
    pass
