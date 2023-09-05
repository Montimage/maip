import sys
import json
import os
import shutil
from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, KFold
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
import xgboost as xgb
import lightgbm as ltb
from sklearn import metrics
from sklearn.metrics import ConfusionMatrixDisplay
from sklearn.metrics import confusion_matrix
from sklearn.metrics import classification_report
from sklearn.metrics import mean_squared_error, accuracy_score, precision_score, recall_score, f1_score
import seaborn as sn
import timeit
from tensorflow.keras.models import load_model

acPath = str(Path.cwd()) + '/src/server/activity-classification/'
deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
#acPath = "/home/strongcourage/maip/src/server/activity-classification/"
#deepLearningPath = "/home/strongcourage/maip/src/server/deep-learning/"

def determine_delimiter(file_path):
  with open(file_path, 'r') as file:
    first_line = file.readline()
    return ',' if first_line.count(',') > first_line.count(';') else ';'

def read_csv(file_path):
  delimiter = determine_delimiter(file_path)
  return pd.read_csv(file_path, delimiter=delimiter)

def saveStats(y_true, y_pred, filepath):
  report = classification_report(y_true, y_pred, output_dict=True)
  stats = pd.DataFrame(report).transpose()
  stats.to_csv(filepath, header=True)

def saveConfMatrix(y_true, y_pred, filepath_csv, filepath_png):
  cm = confusion_matrix(y_true, y_pred)
  pd.DataFrame(cm).to_csv(filepath_csv)
  df_cfm = pd.DataFrame(cm, index=['1', '2', '3'], columns=['1', '2', '3'])
  cfm_plot = sn.heatmap(df_cfm, annot=True, fmt='.1f')
  cfm_plot.figure.savefig(filepath_png)

def preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig):
  # Convert the expected output into arrays, e.g., 1 -> [1,0,0], 2 -> [0,1,0], 3 -> [0,0,1]
  output_train = []
  output_test = []
  prep_outputs = [[1,0,0], [0,1,0], [0,0,1]]

  # Check if y_train_orig and y_test_orig are DataFrame or Series
  if isinstance(y_train_orig, pd.DataFrame):
      y_train_values = y_train_orig["output"].values
  else:
      y_train_values = y_train_orig.values

  if isinstance(y_test_orig, pd.DataFrame):
      y_test_values = y_test_orig["output"].values
  else:
      y_test_values = y_test_orig.values

  for value in y_train_values:
    output_train.append(prep_outputs[int(value) - 1])

  for value in y_test_values:
    output_test.append(prep_outputs[int(value) - 1])

  # Preprocessing the data
  scaler = StandardScaler()
  scaler.fit(X_train)

  # Apply transform to both the training/testing dataset.
  X_train = scaler.transform(X_train)
  y_train = np.array(output_train)

  X_test = scaler.transform(X_test)
  y_test = np.array(output_test)

  return X_train, y_train, X_test, y_test


def retrain_neural_network(modelFilePath, X_train, y_train_orig, X_test, y_test_orig, resultPath):
  keras_model = load_model(modelFilePath)

  X_train, y_train, X_test, y_test = preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig) 

  # Evaluate the Keras model
  _, accuracy = keras_model.evaluate(X_train, y_train)
  print('Accuracy: %.2f' % (accuracy * 100))

  y_pred = (keras_model.predict(X_test) > 0.5).astype(int)
  cm = confusion_matrix(y_test.argmax(axis=1), y_pred.argmax(axis=1))
  print("Confusion matrix: \n" + str(cm))
  print(classification_report(y_test, y_pred))
  print('\nAccuracy: {:.2f}\n'.format(accuracy_score(y_test, y_pred)))

  y_pred_proba = keras_model.predict(X_test)
  y_pred = y_pred_proba.argmax(axis=1) + 1  # transforming one-hot encoding to class labels

  # Create DataFrame for predictions and save to CSV
  df_pred = pd.DataFrame({
    'prediction': y_pred,
    'true_label': y_test.argmax(axis=1) + 1  # transforming one-hot encoding to class labels
  })
  df_pred.to_csv(f'{resultPath}/predictions.csv', index=False, header=False)

  # Create DataFrame for predicted probabilities and save to CSV
  df_proba = pd.DataFrame(y_pred_proba, columns=['Web', 'Interactive', 'Video'])
  df_proba.to_csv(f'{resultPath}/predicted_probabilities.csv', index=False)

  # Transforming y_test from one-hot encoded to class labels
  y_test_labels = y_test.argmax(axis=1) + 1
  cm = confusion_matrix(y_test_labels, y_pred)
  saveStats(y_true=y_test_labels, y_pred=y_pred, filepath=f'{resultPath}/stats.csv')
  saveConfMatrix(y_true=y_test_labels, y_pred=y_pred,
                  filepath_csv=f'{resultPath}/confusion_matrix.csv',
                  filepath_png=f'{resultPath}/confusion_matrix.jpg')

  
def retrain_xgboost(modelFilePath, X_train, y_train_orig, X_test, y_test_orig, resultPath):
  xgbc_model = xgb.XGBClassifier()
  xgbc_model.load_model(modelFilePath)

  X_train, y_train, X_test, y_test = preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig)

  scores = cross_val_score(xgbc_model, X_train, y_train, cv=5)
  print("Mean cross-validation score: %.2f" % scores.mean())

  kfold = KFold(n_splits=10, shuffle=True)
  kf_cv_scores = cross_val_score(xgbc_model, X_train, y_train, cv=kfold )
  print("K-fold CV average score: %.2f" % kf_cv_scores.mean())

  y_pred = xgbc_model.predict(X_test, output_margin=True)
  y_pred = (y_pred > 0.5) 
  cm = confusion_matrix(y_test.argmax(axis=1), y_pred.argmax(axis=1))
  print("Confusion matrix: \n" + str(cm))
  print(classification_report(y_test, y_pred))
  print('\nAccuracy: {:.2f}\n'.format(accuracy_score(y_test, y_pred)))

  y_pred_proba = xgbc_model.predict_proba(X_test)
  y_pred = y_pred_proba.argmax(axis=1) + 1  # transforming one-hot encoding to class labels

  # Create DataFrame for predictions and save to CSV
  df_pred = pd.DataFrame({
    'prediction': y_pred,
    'true_label': y_test.argmax(axis=1) + 1  # transforming one-hot encoding to class labels
  })
  df_pred.to_csv(f'{resultPath}/predictions.csv', index=False, header=False)

  # Create DataFrame for predicted probabilities and save to CSV
  df_proba = pd.DataFrame(y_pred_proba, columns=['Web', 'Interactive', 'Video'])
  df_proba.to_csv(f'{resultPath}/predicted_probabilities.csv', index=False)

  # Transforming y_test from one-hot encoded to class labels
  y_test_labels = y_test.argmax(axis=1) + 1
  cm = confusion_matrix(y_test_labels, y_pred)
  saveStats(y_true=y_test_labels, y_pred=y_pred, filepath=f'{resultPath}/stats.csv')
  saveConfMatrix(y_true=y_test_labels, y_pred=y_pred,
                  filepath_csv=f'{resultPath}/confusion_matrix.csv',
                  filepath_png=f'{resultPath}/confusion_matrix.jpg')


# TODO: use loaded LightGBM model ???
def retrain_lightgbm(modelFilePath, X_train, y_train_orig, X_test, y_test_orig, resultPath):
    #lgbm_model = ltb.Booster(model_file=modelFilePath)
    lgbm_model = ltb.LGBMClassifier()
    lgbm_model.fit(X_train, y_train_orig)

    y_pred = lgbm_model.predict(X_test)
    y_pred_proba = lgbm_model.predict_proba(X_test)
    #y_pred_labels = np.argmax(y_pred, axis=1) + 1
    y_pred_labels = y_pred

    r_2_score = metrics.r2_score(y_test_orig, y_pred_labels)
    mean_squared_log_error_score = metrics.mean_squared_log_error(y_test_orig, y_pred_labels)  # Use y_pred_labels here
    print("r_2 score: %f" % (r_2_score))
    print("mean_squared_log_error score: %f" % (mean_squared_log_error_score))

    cm = confusion_matrix(y_test_orig.values.flatten(), y_pred_labels)
    print("Confusion matrix: \n" + str(cm))
    print(classification_report(y_test_orig, y_pred_labels))  # Use y_pred_labels here
    print('\nAccuracy: {:.2f}\n'.format(accuracy_score(y_test_orig, y_pred_labels)))  # Use y_pred_labels here

    df_pred = pd.DataFrame({
      'prediction': y_pred_labels,
      'true_label': y_test_orig.values.flatten()
    })
    df_pred.to_csv(f'{resultPath}/predictions.csv', index=False, header=False)

    df_proba = pd.DataFrame(y_pred_proba, columns=['Web', 'Interactive', 'Video'])
    df_proba.to_csv(f'{resultPath}/predicted_probabilities.csv', index=False)

    y_test_labels = y_test_orig.values.flatten()
    cm = confusion_matrix(y_test_labels, y_pred_labels)
    saveStats(y_true=y_test_labels, y_pred=y_pred_labels, filepath=f'{resultPath}/stats.csv')
    saveConfMatrix(y_true=y_test_labels, y_pred=y_pred_labels,
                   filepath_csv=f'{resultPath}/confusion_matrix.csv',
                   filepath_png=f'{resultPath}/confusion_matrix.jpg')
  

def retrain_model(modelType, modelId, trainDataPath, testDataPath, resultPath):
  modelFilePath = os.path.join(deepLearningPath, 'models', modelId)

  # Read the CSV files using pandas
  train_df = read_csv(trainDataPath)
  test_df = read_csv(testDataPath) 
  
  X_train = train_df.drop(columns=['output'])
  y_train = train_df['output']
  X_test = test_df.drop(columns=['output'])
  y_test = test_df['output']

  if modelType == "Neural Network":
    retrain_neural_network(modelFilePath, X_train, y_train, X_test, y_test, resultPath)
  elif modelType == "XGBoost":
    retrain_xgboost(modelFilePath, X_train, y_train, X_test, y_test, resultPath)
  elif modelType == "LightGBM":
    retrain_lightgbm(modelFilePath, X_train, y_train, X_test, y_test, resultPath)
  else:
    print("ERROR: Model type is not valid")  
  

if __name__ == "__main__":
  if len(sys.argv) != 5:
    print('Invalid inputs')
    print('python ac_retrain_models.py modelId trainDataPath testDataPath resultPath')
  else:
    modelId = sys.argv[1]
    trainDataPath = sys.argv[2] 
    testDataPath = sys.argv[3] 
    resultPath = sys.argv[4]

    # Read & parse buildConfig file
    buildConfigFilePath = os.path.join(deepLearningPath, 'trainings', modelId, 'build-config.json') 
    if not os.path.exists(buildConfigFilePath):
      print("ERROR: Build config file does not exist: " + buildConfigFilePath)
    else:
      f = open(buildConfigFilePath)
      buildConfig = json.load(f)
      modelType = buildConfig['modelType']

      retrain_model(modelType, modelId, trainDataPath, testDataPath, resultPath)
