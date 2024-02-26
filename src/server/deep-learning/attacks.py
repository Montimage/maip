import numpy as np
import os
import random
import pandas as pd
from sklearn.preprocessing import StandardScaler
import csv
from pathlib import Path
import random
from datetime import datetime
from tools import dataScale_cnn
import constants
from collections import Counter

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
#deepLearningPath = "/home/strongcourage/maip/src/server/deep-learning/"

def running_poisoning_attacks(modelId, typePoisoningAttacks, poisoningRate, targetClass):

  """
    Perform poisoning attacks

    :param modelId:
    :param typePoisoningAttacks:
    :param poisoningRate:
    :param targetClass:
    :return:
  """
  model_name = os.path.splitext(modelId)[0]

  output_path = deepLearningPath + '/trainings/' + model_name
  output_datasets_path = output_path + '/datasets/'
  train_data_path = os.path.join(output_datasets_path, 'Train_samples.csv')
  test_data_path = os.path.join(output_datasets_path, 'Test_samples.csv')

  if 'ac-' in modelId:
    train_data = pd.read_csv(train_data_path, delimiter=";")
    test_data = pd.read_csv(test_data_path, delimiter=";")
  else:
    train_data = pd.read_csv(train_data_path, delimiter=",")
    test_data = pd.read_csv(test_data_path, delimiter=",")

  X_poisoned_train = train_data.iloc[:, :-1].copy().values.tolist()
  y_poisoned_train = train_data.iloc[:, -1].copy().values.tolist()
  #print(y_poisoned_train)
  poison_count = -1
  original_count = -1

  attacks_path = deepLearningPath + '/attacks/' + model_name
  if not os.path.exists(attacks_path):
    os.makedirs(attacks_path)

  # TODO: improve prefix of poisoned training dataset's name
  prefix = typePoisoningAttacks
  if typePoisoningAttacks == 'ctgan':
    print("attack ctgan")
    ctgan_file = os.path.join(attacks_path, 'ctgan_samples.csv')
    if not os.path.exists(ctgan_file):
      raise ValueError(f"The CTGAN dataset does not exist. Please create it first")

    ctgan_train = pd.read_csv(ctgan_file, delimiter=",")
    #poisoned_train_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)
    X_ctgan_train = ctgan_train.iloc[:, :-1].copy().values.tolist()
    y_ctgan_train = ctgan_train.iloc[:, -1].copy().values.tolist()
    print(y_ctgan_train[1:10])

    required_samples = int(len(X_poisoned_train) * int(poisoningRate) * 0.01)
    original_count = len(train_data)
    poison_count = required_samples
    to_copy_id = [i for i in range(len(X_ctgan_train))]
    random.shuffle(to_copy_id)
    for i in range(required_samples):
      X_poisoned_train.append(X_ctgan_train[to_copy_id[i]])
      y_poisoned_train.append(y_ctgan_train[to_copy_id[i]])

  elif typePoisoningAttacks == 'rsl':
    print("attack rsl")
    #prefix = prefix + "_" + str(poisoningRate)
    flip_amount = int(len(X_poisoned_train) * int(poisoningRate) * 0.01)
    original_count = len(train_data) - flip_amount
    poison_count = flip_amount
    print(len(X_poisoned_train) >= flip_amount)

    different_label_count = 0

    if len(X_poisoned_train) >= flip_amount:
      for i in range(flip_amount):
        flip_id_1 = random.randint(0, len(y_poisoned_train) - 1)
        flip_id_2 = random.randint(0, len(y_poisoned_train) - 1)
        #print("print(flip_id_1): " + str(flip_id_1) + "-" + str(y_poisoned_train[flip_id_1]))
        #print("print(flip_id_2): " + str(flip_id_2) + "-" + str(y_poisoned_train[flip_id_2]))

        # Check if labels of flip_id_1 and flip_id_2 are different
        if y_poisoned_train[flip_id_1] != y_poisoned_train[flip_id_2]:
          different_label_count += 1
          y_poisoned_train[flip_id_1], y_poisoned_train[flip_id_2] = y_poisoned_train[flip_id_2], y_poisoned_train[flip_id_1]
    #print(f"Out of {poison_count} swaps, {different_label_count} times the two instances had different labels.")

  elif typePoisoningAttacks == 'tlf':
    print(str(targetClass))
    #prefix = prefix + "_" + str(poisoningRate) + "_" + str(targetClass)
    flip_amount = int(len(X_poisoned_train) * int(poisoningRate) * 0.01)
    original_count = len(train_data) - flip_amount
    poison_count = flip_amount
    if len(X_poisoned_train) >= flip_amount:
      for i in range(flip_amount):
        flip_id_1 = random.randint(0, len(y_poisoned_train) - 1)
        y_poisoned_train[flip_id_1] = targetClass

    else:
      raise Exception('Poison percentage should not exceed 100%')
  else:
    raise Exception('typePoisoningAttacks should be in [ctgan, rsl, tlf]')

  # Count occurrences of each label
  original_label_counts = Counter(train_data.iloc[:, -1].copy().values.tolist())
  poisoned_label_counts = Counter(y_poisoned_train)

  # Output the counts
  print("Original Training Data Label Counts:")
  for label, count in original_label_counts.items():
      print(f"Label {label}: {count}")

  print("\nPoisoned Training Data Label Counts:")
  for label, count in poisoned_label_counts.items():
      print(f"Label {label}: {count}")

  poisoned_dataset_file = os.path.join(attacks_path, prefix + '_poisoned_dataset.csv')
  print(poisoned_dataset_file)

  # add a new axis to y_poisoned so that it can be concatenated with X_poisoned
  y_poisoned_train = np.expand_dims(y_poisoned_train, axis=1)
  # concatenate two arrays where the columns of y_poisoned are appended to the corresponding rows of X_poisoned
  poisoned_data = np.hstack((np.asarray(X_poisoned_train), np.asarray(y_poisoned_train)))
  # extra comma at the beginning of the csv file ?
  pd.DataFrame(poisoned_data).to_csv(poisoned_dataset_file, header=None, index=False)

  # work around code to append the header to the beginning of the csv file
  str_features = None
  if 'ac-' in modelId:
    str_features = constants.AC_STR_FEATURES
  else:
    str_features = constants.AD_STR_FEATURES
  with open(poisoned_dataset_file, 'r') as file:
    data = file.read()
  with open(poisoned_dataset_file, 'w') as file:
    file.write(str_features)
    file.write(data)


if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 5:
    print('Invalid inputs')
    print('python attacks.py modelId typePoisoningAttacks poisoningRate targetClass')
  else:
    modelId = sys.argv[1]
    typePoisoningAttacks = sys.argv[2]
    poisoningRate = sys.argv[3]
    targetClass = sys.argv[4]

    running_poisoning_attacks(modelId, typePoisoningAttacks, poisoningRate, targetClass)