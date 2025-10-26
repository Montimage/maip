#!/usr/bin/env python3
# Fix sys.path BEFORE any imports to prevent TensorFlow errors
import sys
sys.path = [str(p) if not isinstance(p, str) else p for p in sys.path]

import json
import os
import shutil
import warnings
import numpy as np
import pandas as pd
import lime
import matplotlib.pyplot as plt
import timeit

from lime import lime_tabular
from lime.lime_tabular import LimeTabularExplainer
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
import constants

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'

def running_lime(sampleId, numberFeatures, features):

  """
    Produce explanations of a particular sample

    :param sampleId: a sample of testing dataset being explained
    :param numberFeatures: maximum number of features in explanation
    :return:
  """

  classes=['Normal', 'Malware']
  idx = int(sampleId)
  print("Prediction : ", model.predict(x_test[idx].reshape(1,-1)))
  print("Actual :     ", y_test[idx])
  print(features)

  predict_fn_nn= lambda x: model.predict(x.reshape(1,-1))
  explainer = LimeTabularExplainer(x_train,
                                  training_labels=y_train,
                                  mode="classification",
                                  feature_selection= 'auto',
                                  class_names=classes,
                                  feature_names=features,
                                  kernel_width=None,
                                  discretize_continuous=True)
  explanation = explainer.explain_instance(x_test[idx], model.predict, labels=(0,), num_features=int(numberFeatures))
  full_explanation = explainer.explain_instance(x_test[idx], model.predict, labels=(0,), num_features=len(features))
  full_lime_exps = full_explanation.as_list(label=0)
  print(full_lime_exps)
  full_lime_values = full_explanation.as_map()
  print(full_lime_values[0])

  columns = ['feature','value']

  exps_to_display = [dict(zip(columns, row)) for row in full_lime_exps]
  print(json.dumps(exps_to_display, indent=2, ensure_ascii=False))
  values_to_display = [{"feature": features[x], "value": y} for x, y in full_lime_values[0]]
  print(json.dumps(values_to_display, indent=2, ensure_ascii=False))

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  # the current model only returns the probability for the positive class (Malware)
  # thus, we only obtain LIME explanations for this class
  label = classes[1]
  exps_file = os.path.join(explanations_path, f'{label}_lime_explanations.json')
  print(exps_file)
  with open(exps_file, "w") as outfile:
    json.dump(exps_to_display, outfile)

  values_file = os.path.join(explanations_path, f'{label}_lime_values.json')
  print(values_file)
  with open(values_file, "w") as outfile:
    json.dump(values_to_display, outfile)


if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python xai-lime.py modelId sampleId numberFeatures')
    sys.exit(1)
  
  try:
    modelId = sys.argv[1]
    sampleId = sys.argv[2]
    numberFeatures = sys.argv[3]

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

    #running_lime(sampleId, numberFeatures, features)

    # Compute time for producing explanations and save it to file
    generation_iters = 1
    time_taken =  timeit.timeit(lambda: running_lime(sampleId, numberFeatures, features), number=generation_iters)
    print("Time taken for LIME in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + model_name
    statsfile = os.path.join(xai_path, 'time_stats_lime.txt')
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()
    
    print("LIME explanations generated successfully")
    sys.exit(0)
  
  except Exception as e:
    print(f"Error generating LIME explanations: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)