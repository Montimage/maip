import json
import os
import shutil
from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split

acPath = str(Path.cwd()) + '/src/server/activity-classification/'
deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'

def build_model(modelId, buildConfigFilePath):
  # Read & parse buildConfig file
  if not os.path.exists(buildConfigFilePath):
    print("ERROR: Build config file does not exist: " + buildConfigFilePath)
    return ''
  else:
    f = open(buildConfigFilePath)
    buildConfig = json.load(f)
    modelType = buildConfig['modelType']
    dataset = buildConfig['dataset']
    trainingRatio = buildConfig['trainingRatio']

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

if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 3:
    print('Invalid inputs')
    print('python ac_build_models.py modelId buildConfig.json')
  else:
    build_model(sys.argv[1], sys.argv[2])