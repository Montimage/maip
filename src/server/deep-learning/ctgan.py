from ctgan import CTGAN
from ctgan import load_demo
import matplotlib.pyplot as plt
import numpy as np
import os
import random
import pandas as pd
from sklearn.preprocessing import StandardScaler
import csv
from pathlib import Path
import constants

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'

def running_ctgan(modelId, numberEpochs, numberSyntheticSamples):
  model_name = os.path.splitext(modelId)[0]

  output_path = deepLearningPath + '/trainings/' + model_name
  output_datasets_path = output_path + '/datasets/'
  train_data_path = os.path.join(output_datasets_path,'Train_samples.csv')
  test_data_path = os.path.join(output_datasets_path,'Test_samples.csv')
  
  train_data = pd.read_csv(train_data_path, delimiter=",")
  #train_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)
  test_data = pd.read_csv(test_data_path, delimiter=",")
  #test_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

  target_dataset = train_data[1:].copy()
  ctgan = CTGAN(epochs=int(numberEpochs), verbose=True)
  ctgan.fit(target_dataset, discrete_columns=constants.DISCRETE_FEATURES)

  # Create synthetic data
  synthetic_data = ctgan.sample(int(numberSyntheticSamples))
  print(synthetic_data.values[0])

  attacks_path = deepLearningPath + '/attacks/' + model_name
  if not os.path.exists(attacks_path):
    os.makedirs(attacks_path)
  ctgan_file = os.path.join(attacks_path, 'ctgan_samples.csv') 
  print(ctgan_file)
  with open(ctgan_file, "w") as f:
    f.write(constants.STR_FEATURES)
    writer = csv.writer(f)
    writer.writerows(synthetic_data.values)

if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python attacks.py modelId numberEpochs numberSyntheticSamples')
  else:
    modelId = sys.argv[1]
    numberEpochs = sys.argv[2]
    numberSyntheticSamples = sys.argv[3]
    
    running_ctgan(modelId, numberEpochs, numberSyntheticSamples)
