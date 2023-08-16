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

acPath = str(Path.cwd()) + '/src/server/activity-classification/'
deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
#acPath = "/home/strongcourage/maip/src/server/activity-classification/"
#deepLearningPath = "/home/strongcourage/maip/src/server/deep-learning/"

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

def split_datasets(modelId, buildConfigFilePath):
  # Load dataset
  datasetFilePath = os.path.join(acPath,'datasets/', dataset)
  fullDataset = pd.read_csv(datasetFilePath, header=0, usecols=[*range(1,23)], sep=";") 
  fullDataset.dropna(axis=0, inplace=True)

  y_df = fullDataset['output'].to_frame()
  X_df = fullDataset[fullDataset.columns.difference(['output'])]

  # Split dataset into training and testing
  X_train, X_test, y_train_orig, y_test_orig = train_test_split(X_df, y_df, train_size=trainingRatio, random_state=1)

  # Concatenate the results back into dataframes while maintaining column order
  train_dataset = pd.concat([X_train, y_train_orig], axis=1)[fullDataset.columns]
  test_dataset = pd.concat([X_test, y_test_orig], axis=1)[fullDataset.columns]

  # Save training/testing datasets to .csv
  trainingPath = os.path.join(deepLearningPath, 'trainings/', modelId + '/datasets')
  if os.path.exists(trainingPath):
    shutil.rmtree(trainingPath)
  os.makedirs(trainingPath)

  trainDatasetPath = os.path.join(trainingPath, 'Train_samples.csv') 
  testDatasetPath = os.path.join(trainingPath, 'Test_samples.csv')
  train_dataset.to_csv(trainDatasetPath, index=False, sep=";")
  test_dataset.to_csv(testDatasetPath, index=False, sep=";")

  print("Created the training dataset: " + trainDatasetPath)
  print("Created the testing dataset: " + testDatasetPath)

  return X_train, X_test, y_train_orig, y_test_orig

def preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig):
  # Convert the expected output into arrays, e.g., 1 -> [1,0,0], 2 -> [0,1,0], 3 -> [0,0,1]
  output_train = []
  output_test = []
  prep_outputs = [[1,0,0], [0,1,0], [0,0,1]]

  for i, row in y_train_orig.iterrows():
      output_train.append(prep_outputs[row["output"] - 1])

  for i, row in y_test_orig.iterrows():
      output_test.append(prep_outputs[row["output"] - 1])

  #print(output_train)
  #print(output_test)

  # Preprocessing the data
  scaler = StandardScaler()
  scaler.fit(X_train)

  # Apply transform to both the training/testing dataset.
  X_train = scaler.transform(X_train)
  y_train = np.array(output_train)

  X_test = scaler.transform(X_test)
  y_test = np.array(output_test)

  return X_train, y_train, X_test, y_test

def build_neural_network(X_train, y_train, X_test, y_test, resultPath):
  # Define the Keras model
  keras_model = Sequential()
  keras_model.add(Dense(12, input_shape=(21,), activation='relu'))
  keras_model.add(Dense(8, activation='relu'))
  keras_model.add(Dense(3, activation='sigmoid'))

  # Compile the Keras model
  keras_model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])

  # Fit the Keras model on the dataset
  keras_model.fit(X_train, y_train, epochs=150, batch_size=10)

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

  
def build_xgboost(X_train, y_train, X_test, y_test, resultPath):
  xgbc_model = xgb.XGBClassifier()
  xgbc_model.fit(X_train, y_train)

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

def build_lightgbm(X_train, y_train, X_test, y_test, resultPath):
  lgbm_model = ltb.LGBMClassifier()
  lgbm_model.fit(X_train, y_train_orig)

  y_pred = lgbm_model.predict(X_test)
  y_pred_proba = lgbm_model.predict_proba(X_test)  # Get predicted probabilities
  #y_pred = (y_pred > 0.5) 

  r_2_score = metrics.r2_score(y_test_orig, y_pred)
  mean_squared_log_error_score = metrics.mean_squared_log_error(y_test_orig, y_pred)
  print("r_2 score: %f" % (r_2_score))
  print("mean_squared_log_error score: %f" % (mean_squared_log_error_score))

  cm = confusion_matrix(y_test_orig, y_pred)
  print("Confusion matrix: \n" + str(cm))
  print(classification_report(y_test_orig, y_pred))
  print('\nAccuracy: {:.2f}\n'.format(accuracy_score(y_test_orig, y_pred)))

  # Create DataFrame for predictions and save to CSV
  df_pred = pd.DataFrame({
    'prediction': y_pred.flatten(),
    'true_label': y_test_orig['output'].values.flatten()
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

if __name__ == "__main__":
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python ac_build_models.py modelId buildConfig.json resultPath')
  else:
    modelId = sys.argv[1]
    buildConfigFilePath = sys.argv[2]
    resultPath = sys.argv[3]
    # Read & parse buildConfig file
    if not os.path.exists(buildConfigFilePath):
      print("ERROR: Build config file does not exist: " + buildConfigFilePath)
    else:
      f = open(buildConfigFilePath)
      buildConfig = json.load(f)
      modelType = buildConfig['modelType']
      dataset = buildConfig['dataset']
      trainingRatio = buildConfig['trainingRatio']
      X_train, X_test, y_train_orig, y_test_orig = split_datasets(modelId, buildConfigFilePath)
      X_train, y_train, X_test, y_test = preprocess_datasets(X_train, X_test, y_train_orig, y_test_orig)
      if modelType == "Neural Network":
        build_neural_network(X_train, y_train, X_test, y_test, resultPath)
      elif modelType == "XGBoost":
        build_xgboost(X_train, y_train, X_test, y_test, resultPath)
      elif modelType == "LightGBM":
        build_lightgbm(X_train, y_train, X_test, y_test, resultPath)
      else:
        print("ERROR: Model type is not valid")  