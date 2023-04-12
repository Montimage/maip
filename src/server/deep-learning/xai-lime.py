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
from pathlib import Path
from trafficToFeature import trafficToFeatures
from createDatasetMMT import createTrainTestSet
from tensorflow.keras.models import load_model
from pydoc import classname
from datetime import datetime
from tools import dataScale_cnn

#deepLearningPath = str(os.path.join(Path.cwd(),'deep-learning/'))
deepLearningPath = "/home/strongcourage/maip-app/src/server/deep-learning"

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

def running_lime(sampleId, numberFeatures):

  """
    Produce explanations of a particular sample

    :param sampleId: a sample of testing dataset being explained
    :param numberFeatures: maximum number of features in explanation
    :return:
  """

  idx = int(sampleId)
  #print("Local interpretation of sample " + str(idx))
  #print("Prediction : ", model.predict(x_test[idx].reshape(1,-1)))
  #print("Actual :     ", y_test[idx])

  classes=['Botnet']
  predict_fn_nn= lambda x: model.predict(x.reshape(1,-1))
  explainer = lime_tabular.LimeTabularExplainer(x_test, mode="classification", feature_selection= 'auto', class_names=classes,
                                                  feature_names=xai_features, kernel_width=None, discretize_continuous=True)
  explanation = explainer.explain_instance(x_test[idx], model.predict, labels=(0,), num_features=int(numberFeatures))
  full_explanation = explainer.explain_instance(x_test[idx], model.predict, labels=(0,), num_features=len(xai_features))
  full_lime_exps = full_explanation.as_list(label=0)
  print(full_lime_exps)
  full_lime_values = full_explanation.as_map()
  print(full_lime_values[0])

  #plt.tight_layout()
  #plt.figure(figsize=(15,10))
  #explanation.show_in_notebook()

  columns = ['feature','value'] 
  #feature_importance = pd.DataFrame(list(zip(xai_features,sum(vals))),columns=['feature','importance_value'])
  #feature_importance.sort_values(by=['importance_value'],ascending=False,inplace=True)  
  #feature_importance.head()

  #sorted_feature_vals = sorted(list(zip(xai_features,sum(vals))), key = lambda x: x[1], reverse=True)
  #features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals][:int(maxDisplay)]
  # dump full values and process maxDisplay later ?
  exps_to_display = [dict(zip(columns, row)) for row in full_lime_exps]
  print(json.dumps(exps_to_display, indent=2, ensure_ascii=False))
  values_to_display = [{"feature": xai_features[x], "value": y} for x, y in full_lime_values[0]]
  print(json.dumps(values_to_display, indent=2, ensure_ascii=False))

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path) 

  exps_file = os.path.join(explanations_path, 'lime_explanations.json')
  print(exps_file)
  with open(exps_file, "w") as outfile:
    json.dump(exps_to_display, outfile)
  
  values_file = os.path.join(explanations_path, 'lime_values.json')
  print(values_file)
  with open(values_file, "w") as outfile:
    json.dump(values_to_display, outfile)

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path)

  fig = explanation.as_pyplot_figure(label=0)
  fig.savefig(os.path.join(explanations_path, 'lime.png'), dpi=300, bbox_inches='tight')
  explanation.save_to_file(os.path.join(explanations_path, 'lime_report.html'))


if __name__ == "__main__":
  import sys
  print(sys.argv)
  if len(sys.argv) != 4:
    print('Invalid inputs')
    print('python xai-lime.py modelId sampleId numberFeatures')
  else:
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

    d = datetime.now()
    x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler = dataScale_cnn(output_path,
      train_data, test_data, datetime=d)

    #running_lime(sampleId, numberFeatures)

    # Compute time for producing explanations and save it to file
    generation_iters = 1
    time_taken =  timeit.timeit(lambda: running_lime(sampleId, numberFeatures), number=generation_iters)
    print("Time taken for LIME in seconds: ", time_taken)
    xai_path = deepLearningPath + '/xai/' + model_name
    statsfile = os.path.join(xai_path, 'time_stats_lime.txt') 
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()