import sys
import json
import os
import shutil
import warnings
import lime
from lime.lime_tabular import LimeTabularExplainer
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import timeit
import xgboost as xgb
import lightgbm as ltb
from pathlib import Path
from tensorflow.keras.models import load_model
from pydoc import classname
from datetime import datetime
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
from sklearn.inspection import permutation_importance
import constants

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
#deepLearningPath = "/home/strongcourage/maip/src/server/deep-learning/"

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

# TODO: should use load_model() instead
def get_model(modelType, X_train, y_train, y_train_orig):
  model = None
  if modelType == "Neural Network":
    model = Sequential()
    model.add(Dense(12, input_shape=(21,), activation='relu'))
    model.add(Dense(8, activation='relu'))
    model.add(Dense(3, activation='sigmoid'))
    model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])
    model.fit(X_train, y_train, epochs=150, batch_size=10)
  elif modelType == "XGBoost":
    model = xgb.XGBClassifier()
    model.fit(X_train, y_train)
  elif modelType == "LightGBM":
    model = ltb.LGBMClassifier()
    model.fit(X_train, y_train_orig)
  else:
    print("ERROR: Model type is not valid")
  return model

def running_lime(model, sampleId, numberFeatures, modelType, X_train, y_train, y_train_orig):
  classes=['Web', 'Interactive', 'Video']
  idx = int(sampleId)
  
  predict_fn = lambda x: model.predict(x)
  train_data = y_train
    
  if modelType == "LightGBM":
    train_data = y_train_orig
    predict_fn = lambda x: model.predict_proba(x, raw_score=False, pred_leaf=False)
  
  explainer = LimeTabularExplainer(X_train, 
                                  training_labels=train_data, 
                                  feature_names=constants.AC_FEATURES, 
                                  class_names=classes, 
                                  mode='classification')
  explanation = explainer.explain_instance(X_test[idx], predict_fn, num_features=len(constants.AC_FEATURES), top_labels=3)

  # Save the explanations
  explanations_path = deepLearningPath + '/xai/' + modelId
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  # Store the explanations in a dictionary and then save as JSON
  for label in classes:
    label_idx = classes.index(label)
    label_explanations = explanation.as_list(label=label_idx)
    values_to_display = [{"feature": item[0], "value": item[1]} for item in label_explanations]
    #print(values_to_display)
    exps_file = os.path.join(explanations_path, f'{label}_lime_explanations.json')
    with open(exps_file, "w") as outfile:
      json.dump(values_to_display, outfile)
      print(f"LIME explanations for {label} dumped to " + exps_file)

if __name__ == "__main__":
  if len(sys.argv) < 4 or len(sys.argv) > 5:
    print('Invalid inputs')
    print('Usage: python ac_xai_lime.py modelId sampleId numberFeatures [modelType]')
  else:
    modelId = sys.argv[1]
    sampleId = sys.argv[2]
    numberFeatures = sys.argv[3]

    modelType = None
    if len(sys.argv) == 5:
      modelType = sys.argv[4]

    output_path = deepLearningPath + '/trainings/' + modelId
    output_datasets_path = output_path + '/datasets/'
    train_data_path = os.path.join(output_datasets_path,'Train_samples.csv')
    test_data_path = os.path.join(output_datasets_path,'Test_samples.csv')    
    train_data = pd.read_csv(train_data_path, delimiter=";")
    test_data = pd.read_csv(test_data_path, delimiter=";")

    X_train = train_data.drop(columns=['output'])
    y_train_orig = train_data['output']
    X_test = test_data.drop(columns=['output'])
    y_test_orig = test_data['output']

    X_train, y_train, X_test, y_test = preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig) 

    model = get_model(modelType, X_train, y_train, y_train_orig)

    # Compute time for producing explanations and save it to file 
    generation_iters = 1
    time_taken = timeit.timeit(lambda: running_lime(model, sampleId, numberFeatures, modelType, X_train, y_train, y_train_orig), number=generation_iters)
    print("Time taken for LIME in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + modelId
    statsfile = os.path.join(xai_path, 'time_stats_lime.txt')
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()