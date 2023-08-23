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
from trafficToFeature import trafficToFeatures
from createDatasetMMT import createTrainTestSet
from tensorflow.keras.models import load_model
from pydoc import classname
from datetime import datetime
from tools import dataScale_cnn

from sklearn.inspection import permutation_importance
import constants

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
features = constants.AD_FEATURES[3:-1]

def running_shap(numberBackgroundSamples, numberExplainedSamples, maxDisplay):

  """
    Produce explanations of feature importance
    
    :param numberBackgroundSamples: number of background samples used for explanations
    :param numberExplainedSamples: number of samples to be explained
    :param maxDisplay: maximum number of features in explanations
    :return:
  """

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path) 

  x_train_df = pd.DataFrame(x_train, columns=features)
  x_test_df = pd.DataFrame(x_test, columns=features)
  x_train_df = x_train_df.reset_index(drop=True)

  print(features)

  background = x_train[np.random.choice(x_train.shape[0], int(numberBackgroundSamples), replace=False)]
  explainer = shap.KernelExplainer(model.predict, background)
  with warnings.catch_warnings():
    warnings.filterwarnings("ignore")
    x_samples = shap.sample(x_test_df, int(numberExplainedSamples))
    shap_values = explainer.shap_values(x_samples)

    print(shap_values[0])

    # Compute the permutation importance of each feature
    #perm_importance = shap.permutation_importance(explainer, x_test)
    #print(perm_importance.importances_mean)
    shap_df = pd.DataFrame(shap_values[0], columns=features)
    #shap_df = shap_df.reset_index(drop=True)
    #shap.plots.heatmap(shap_df, max_display=int(maxDisplay))
    #shap.plots.heatmap(shap_values, max_display=int(maxDisplay))

    #plt.figure(figsize=(15,10))
    #shap.dependence_plot(1, shap_values[0], x_samples)
    #plt.savefig(os.path.join(explanations_path, 'dependence_plot.png')) 

    # Compute the interaction values between features
    #interaction_values = explainer.shap_interaction_values(x_samples)
    #print(interaction_values)

  #shap_dict = dict(zip(features, shap_values[0][0]))
  #shap.plots.bar(shap_dict, max_display=10)
  #plt.savefig(os.path.join(explanations_path, 'shap_instance.png'))

  columns = ['feature','importance_value'] 
  vals= np.abs(shap_values).mean(0)
  #feature_importance = pd.DataFrame(list(zip(features,sum(vals))),columns=['feature','importance_value'])
  #feature_importance.sort_values(by=['importance_value'],ascending=False,inplace=True)  
  #feature_importance.head()

  sorted_feature_vals = sorted(list(zip(features,sum(vals))), key = lambda x: x[1], reverse=True)
  #features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals][:int(maxDisplay)]
  # dump full values and process maxDisplay later ?
  features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals]
  print(json.dumps(features_to_display, indent=2, ensure_ascii=False))

  
  jsonfile = os.path.join(explanations_path, 'importance_values.json')
  print(jsonfile)
  with open(jsonfile, "w") as outfile:
    json.dump(features_to_display, outfile)

  classes = ['Botnet']
  #plt.figure(figsize=(15,10))
  #plt.grid(b=None)
  #shap.summary_plot(shap_values, x_test, color_bar_label='Feature value for all', 
  #  feature_names=features, max_display=int(maxDisplay), class_names=classes, plot_size=None)
  #plt.savefig(os.path.join(explanations_path, 'shap.png'))


if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 5:
    print('Invalid inputs')
    print('python xai-shap.py modelId numberBackgroundSamples numberExplainedSamples maxDisplay')
  else:
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

    d = datetime.now()
    x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler = dataScale_cnn(output_path,
      train_data, test_data, datetime=d)

    # cnn = trainSAE_CNN(result_path=result_path, x_train_norm=x_train_norm, x_train_mal=x_train_mal,
    #                    x_train=x_train, y_train=y_train,
    #                    nb_epoch_cnn=nb_epoch_cnn, nb_epoch_sae=nb_epoch_sae,
    #                    batch_size_cnn=batch_size_cnn, batch_size_sae=batch_size_sae, datenow=d)

    #running_shap(numberBackgroundSamples, maxDisplay)

    # Compute time for producing explanations and save it to file 
    generation_iters = 1
    time_taken = timeit.timeit(lambda: running_shap(numberBackgroundSamples, numberExplainedSamples, maxDisplay), number=generation_iters)
    print("Time taken for SHAP in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + model_name
    statsfile = os.path.join(xai_path, 'time_stats_shap.txt')
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()