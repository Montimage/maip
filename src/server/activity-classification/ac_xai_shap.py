import json
import os
import shutil
import warnings
import shap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import timeit
import xgboost as xgb
from pathlib import Path
from tensorflow.keras.models import load_model
from pydoc import classname
from datetime import datetime
from sklearn.preprocessing import StandardScaler
from sklearn.inspection import permutation_importance
import constants

#deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
deepLearningPath = "/home/strongcourage/maip/src/server/deep-learning/"

def preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig):
  # Convert the expected output into arrays, e.g., 1 -> [1,0,0], 2 -> [0,1,0], 3 -> [0,0,1]
  prep_outputs = {1: [1,0,0], 2: [0,1,0], 3: [0,0,1]}

  y_train = np.array(y_train_orig.map(prep_outputs).tolist())
  y_test = np.array(y_test_orig.map(prep_outputs).tolist())
  
  # Preprocessing the data
  scaler = StandardScaler().fit(X_train)
  
  # Apply transform to both the training/testing dataset.
  X_train = scaler.transform(X_train)
  X_test = scaler.transform(X_test)

  return X_train, y_train, X_test, y_test

def running_shap(numberBackgroundSamples, maxDisplay):
  classes=['Web', 'Interactive', 'Video']

  # Create the SHAP explainer
  explainer = shap.KernelExplainer(xgbc_model.predict, X_test)
  
  # Calculate SHAP values
  with warnings.catch_warnings():
    warnings.filterwarnings("ignore")
    shap_values = explainer.shap_values(X_test, nsamples=len(X_test)) 
    #shap_values = explainer.shap_values(X_test, nsamples=numberBackgroundSamples)
    print(shap_values)

  explanations_path = deepLearningPath + '/xai/' + modelId
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  for i, label in enumerate(classes):
    shap_df = pd.DataFrame(shap_values[i], columns=constants.AC_FEATURES)
    
    columns = ['feature', 'importance_value']
    vals = np.abs(shap_df.values).mean(0)
    sorted_feature_vals = sorted(list(zip(constants.AC_FEATURES, vals)), key=lambda x: x[1], reverse=True)
    features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals]

    jsonfile = os.path.join(explanations_path, f'{label}_importance_values.json')
    print(jsonfile)
    with open(jsonfile, "w") as outfile:
      json.dump(features_to_display, outfile)

  # # Convert SHAP values into a dictionary with class labels as keys
  # shap_dict = {}
  # for idx, label in enumerate(classes):
  #   shap_df = pd.DataFrame(shap_values[idx], columns=constants.AC_FEATURES)
  #   shap_dict[label] = shap_df.to_dict(orient="list")

  # # Dump the SHAP values dictionary to a JSON file
  # with open("shap_values.json", "w") as file:
  #   json.dump(shap_dict, file, indent=2, ensure_ascii=False)

  # print("SHAP values dumped to shap_values.json")
  # print(json.dump(shap_dict, file, indent=2, ensure_ascii=False))

if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python ac_xai_shap.py modelId numberBackgroundSamples maxDisplay ')
  else:
    modelId = sys.argv[1]
    numberBackgroundSamples = sys.argv[2]
    maxDisplay = sys.argv[3]

    # Step 1: Read the datasets from the csv files
    output_path = deepLearningPath + '/trainings/' + modelId
    output_datasets_path = output_path + '/datasets/'
    train_data_path = os.path.join(output_datasets_path,'Train_samples.csv')
    test_data_path = os.path.join(output_datasets_path,'Test_samples.csv')    
    train_data = pd.read_csv(train_data_path, delimiter=";")
    test_data = pd.read_csv(test_data_path, delimiter=";")

    # Step 2: Split the train_dataset into X_train and y_train_orig
    X_train = train_data.drop(columns=['output'])  # Assuming 'output' is the name of the target column
    y_train_orig = train_data['output']

    # Step 3: Split the test_dataset into X_test and y_test_orig
    X_test = test_data.drop(columns=['output'])
    y_test_orig = test_data['output']

    X_train, y_train, X_test, y_test = preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig) 
    
    xgbc_model = xgb.XGBClassifier()
    xgbc_model.fit(X_train, y_train)

    #running_shap(numberBackgroundSamples, maxDisplay)

    # Compute time for producing explanations and save it to file 
    generation_iters = 1
    time_taken = timeit.timeit(lambda: running_shap(numberBackgroundSamples, maxDisplay), number=generation_iters)
    print("Time taken for SHAP in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + modelId
    statsfile = os.path.join(xai_path, 'time_stats_shap.txt')
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()