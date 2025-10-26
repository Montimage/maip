#!/usr/bin/env python3
# Fix sys.path BEFORE any imports to prevent TensorFlow errors
import sys
sys.path = [str(p) if not isinstance(p, str) else p for p in sys.path]

import json
import os
import shutil
import warnings
import shap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import timeit

from pathlib import Path

# Fix sys.path again before importing local modules that might modify it
sys.path = [str(p) if not isinstance(p, str) else p for p in sys.path]

from trafficToFeature import trafficToFeatures
from createDatasetMMT import createTrainTestSet

# Fix sys.path one more time right before TensorFlow import
sys.path = [str(p) if not isinstance(p, str) else p for p in sys.path]

from tensorflow.keras.models import load_model
from pydoc import classname
from datetime import datetime
from tools import dataScale_cnn

from sklearn.inspection import permutation_importance
import constants

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'

def running_shap(numberBackgroundSamples, numberExplainedSamples, maxDisplay, features):

  """
    Produce explanations of feature importance

    :param numberBackgroundSamples: number of background samples used for explanations
    :param numberExplainedSamples: number of samples to be explained
    :param maxDisplay: maximum number of features in explanations
    :return:
  """
  classes=['Normal', 'Malware']

  x_train_df = pd.DataFrame(x_train, columns=features)
  x_test_df = pd.DataFrame(x_test, columns=features)
  x_train_df = x_train_df.reset_index(drop=True)

  #print(features)

  background = x_train[np.random.choice(x_train.shape[0], int(numberBackgroundSamples), replace=False)]
  explainer = shap.KernelExplainer(model.predict, background)
  with warnings.catch_warnings():
    warnings.filterwarnings("ignore")
    x_samples = shap.sample(x_test_df, int(numberExplainedSamples))
    shap_values = explainer.shap_values(x_samples)
    #print(shap_values[0])
    shap_df = pd.DataFrame(shap_values[0], columns=features)

  columns = ['feature','importance_value']
  vals= np.abs(shap_values).mean(0)
  sorted_feature_vals = sorted(list(zip(features,sum(vals))), key = lambda x: x[1], reverse=True)
  features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals]
  #print(json.dumps(features_to_display, indent=2, ensure_ascii=False))

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  # the current model only returns the probability for the positive class (Malware)
  # thus, we only obtain LIME explanations for this class
  label = classes[1]
  jsonfile = os.path.join(explanations_path, f'{label}_importance_values.json')
  #print(jsonfile)
  with open(jsonfile, "w") as outfile:
    json.dump(features_to_display, outfile)


if __name__ == "__main__":
  import sys
  #print(sys.argv)
  if len(sys.argv) != 5:
    print('Invalid inputs')
    print('python xai-shap.py modelId numberBackgroundSamples numberExplainedSamples maxDisplay')
    sys.exit(1)
  
  try:
    modelId = sys.argv[1]
    numberBackgroundSamples = sys.argv[2]
    numberExplainedSamples = sys.argv[3]
    maxDisplay = sys.argv[4]

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

    # Get actual feature names from the training data (excluding the label column)
    features = [col for col in train_data.columns if col != 'malware']
    print(f"Number of features: {len(features)}")

    d = datetime.now()
    x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler = dataScale_cnn(output_path,
      train_data, test_data, datetime=d)

    # Verify feature count matches data shape
    if x_train.shape[1] != len(features):
        print(f"Warning: Data has {x_train.shape[1]} features but feature list has {len(features)} names")
        print(f"Using only the first {x_train.shape[1]} feature names")
        features = features[:x_train.shape[1]]

    # Compute time for producing explanations and save it to file
    generation_iters = 1
    time_taken = timeit.timeit(lambda: running_shap(numberBackgroundSamples, numberExplainedSamples, maxDisplay, features), number=generation_iters)
    print("Time taken for SHAP in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + model_name
    statsfile = os.path.join(xai_path, 'time_stats_shap.txt')
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()
    
    print("SHAP explanations generated successfully")
    sys.exit(0)
  
  except Exception as e:
    print(f"Error generating SHAP explanations: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)