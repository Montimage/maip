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

deepLearningPath = str(os.path.join(Path.cwd(),'deep-learning'))

xai_features = ['ip', 'ip.pkts_per_flow', 'duration', 'ip.header_len',
                    'ip.payload_len', 'ip.avg_bytes_tot_len', 'time_between_pkts_sum',
                    'time_between_pkts_avg', 'time_between_pkts_max',
                    'time_between_pkts_min', 'time_between_pkts_std', '(-0.001, 50.0]',
                    '(50.0, 100.0]', '(100.0, 150.0]', '(150.0, 200.0]', '(200.0, 250.0]',
                    '(250.0, 300.0]', '(300.0, 350.0]', '(350.0, 400.0]', '(400.0, 450.0]',
                    '(450.0, 500.0]', '(500.0, 550.0]', 'tcp_pkts_per_flow', 'pkts_rate',
                    'tcp_bytes_per_flow', 'byte_rate', 'tcp.tcp_session_payload_up_len',
                    'tcp.tcp_session_payload_down_len', '(-0.001, 150.0]',
                    '(150.0, 300.0]', '(300.0, 450.0]', '(450.0, 600.0]', '(600.0, 750.0]',
                    '(750.0, 900.0]', '(900.0, 1050.0]', '(1050.0, 1200.0]',
                    '(1200.0, 1350.0]', '(1350.0, 1500.0]', '(1500.0, 10000.0]', 'tcp.fin',
                    'tcp.syn', 'tcp.rst', 'tcp.psh', 'tcp.ack', 'tcp.urg', 'sport_g', 'sport_le', 'dport_g',
                    'dport_le', 'mean_tcp_pkts', 'std_tcp_pkts', 'min_tcp_pkts',
                    'max_tcp_pkts', 'entropy_tcp_pkts', 'mean_tcp_len', 'std_tcp_len',
                    'min_tcp_len', 'max_tcp_len', 'entropy_tcp_len', 'ssl.tls_version']

def running_shap(numberBackgroundSamples, maxDisplay):

  """
    Produce explanations of feature importance

    :param numberBackgroundSamples: number of background samples used for explanations
    :param maxDisplay: maximum number of features in explanations
    :return:
  """

  background = x_train[np.random.choice(x_train.shape[0], int(numberBackgroundSamples), replace=False)]
  explainer = shap.KernelExplainer(model.predict, background)
  with warnings.catch_warnings():
    warnings.filterwarnings("ignore")
    shap_values = explainer.shap_values(shap.sample(x_test, int(numberBackgroundSamples)))
    #print(shap_values[0])

  columns = ['feature','importance_value'] 
  vals= np.abs(shap_values).mean(0)
  #feature_importance = pd.DataFrame(list(zip(xai_features,sum(vals))),columns=['feature','importance_value'])
  #feature_importance.sort_values(by=['importance_value'],ascending=False,inplace=True)  
  #feature_importance.head()

  sorted_feature_vals = sorted(list(zip(xai_features,sum(vals))), key = lambda x: x[1], reverse=True)
  #features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals][:int(maxDisplay)]
  # dump full values and process maxDisplay later ?
  features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals]
  print(json.dumps(features_to_display, indent=2, ensure_ascii=False))

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path) 

  jsonfile = os.path.join(explanations_path, 'importance_values.json')
  print(jsonfile)
  with open(jsonfile, "w") as outfile:
    json.dump(features_to_display, outfile)

  classes = ['Botnet']
  plt.figure(figsize=(15,10))
  #plt.grid(b=None)
  shap.summary_plot(shap_values, x_test, color_bar_label='Feature value for all', 
    feature_names=xai_features, max_display=int(maxDisplay), class_names=classes, plot_size=None)
  plt.savefig(os.path.join(explanations_path, 'shap.png'))


if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python xai.py modelId numberBackgroundSamples maxDisplay')
  else:
    modelId = sys.argv[1]
    numberBackgroundSamples = sys.argv[2]
    maxDisplay = sys.argv[3]
    
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

    #running_shap(numberBackgroundSamples, maxDisplay)

    # Compute time for producing explanations and save it to file 
    generation_iters = 1
    time_taken = timeit.timeit(lambda: running_shap(numberBackgroundSamples, maxDisplay), number=generation_iters)
    print("Time taken for SHAP in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + model_name
    statsfile = os.path.join(xai_path, 'time_stats_shap.txt')
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()