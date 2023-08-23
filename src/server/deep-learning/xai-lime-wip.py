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
from lime.lime_tabular import LimeTabularExplainer
from pathlib import Path
from trafficToFeature import trafficToFeatures
from createDatasetMMT import createTrainTestSet
from tensorflow.keras.models import load_model
from pydoc import classname
from datetime import datetime
from tools import dataScale_cnn
import constants

deepLearningPath = str(Path.cwd()) + '/src/server/deep-learning/'
features = constants.AD_FEATURES[3:-1]

def predict_fn_for_both_classes(x):
  prob_for_malware = model.predict(x.reshape(1, -1))
  prob_for_normal = 1 - prob_for_malware
  return np.hstack([prob_for_normal, prob_for_malware])

def running_lime(sampleId, numberFeatures):

  """
    Produce explanations of a particular sample

    :param sampleId: a sample of testing dataset being explained
    :param numberFeatures: maximum number of features in explanation
    :return:
  """
  classes=['Normal', 'Malware']
  idx = int(sampleId)
  #print("Local interpretation of sample " + str(idx))
  #print("Prediction : ", model.predict(x_test[idx].reshape(1,-1)))
  #print("Actual :     ", y_test[idx])

  
  #predict_fn_nn= lambda x: model.predict(x.reshape(1,-1))
  predict_fn_nn = predict_fn_for_both_classes
  print(predict_fn_nn(x_test[idx]))
  explainer = LimeTabularExplainer(x_train, 
                                  training_labels=y_train, 
                                  mode="classification", 
                                  feature_selection= 'auto', 
                                  class_names=classes,
                                  feature_names=features, 
                                  kernel_width=None, 
                                  discretize_continuous=True)
  #explanation = explainer.explain_instance(x_test[idx], model.predict, labels=(0,), num_features=int(numberFeatures))
  #full_explanation = explainer.explain_instance(x_test[idx], model.predict, labels=(0,), num_features=len(features))
  
  # full_lime_exps = full_explanation.as_list(label=0)
  # print(full_lime_exps)
  # full_lime_values = full_explanation.as_map()
  # print(full_lime_values[0])

  #plt.tight_layout()
  #plt.figure(figsize=(15,10))
  #explanation.show_in_notebook()

  columns = ['feature','value'] 
  #feature_importance = pd.DataFrame(list(zip(features,sum(vals))),columns=['feature','importance_value'])
  #feature_importance.sort_values(by=['importance_value'],ascending=False,inplace=True)  
  #feature_importance.head()

  #sorted_feature_vals = sorted(list(zip(features,sum(vals))), key = lambda x: x[1], reverse=True)
  #features_to_display = [dict(zip(columns, row)) for row in sorted_feature_vals][:int(maxDisplay)]
  # dump full values and process maxDisplay later ?
  
  
  # exps_to_display = [dict(zip(columns, row)) for row in full_lime_exps]
  # print(json.dumps(exps_to_display, indent=2, ensure_ascii=False))
  # values_to_display = [{"feature": features[x], "value": y} for x, y in full_lime_values[0]]
  # print(json.dumps(values_to_display, indent=2, ensure_ascii=False))

  explanations_path = deepLearningPath + '/xai/' + model_name
  if not os.path.exists(explanations_path):
    os.makedirs(explanations_path) 

  full_explanation = explainer.explain_instance(x_test[idx], model.predict, num_features=len(features), top_labels=2)
  print(full_explanation.as_map())
  for label in classes:
    label_idx = classes.index(label)
    print(label)
    print(label_idx)
    label_explanations = full_explanation.as_list(label=label_idx)
    values_to_display = [{"feature": item[0], "value": item[1]} for item in label_explanations]
    #print(values_to_display)
    jsonfile = os.path.join(explanations_path, f'{label}_lime_explanations.json')
    with open(jsonfile, "w") as outfile:
      json.dump(values_to_display, outfile)
      print(f"LIME explanations for {label} dumped to " + jsonfile)

  # exps_file = os.path.join(explanations_path, 'lime_explanations.json')
  # print(exps_file)
  # with open(exps_file, "w") as outfile:
  #   json.dump(exps_to_display, outfile)
  
  # values_file = os.path.join(explanations_path, 'lime_values.json')
  # print(values_file)
  # with open(values_file, "w") as outfile:
  #   json.dump(values_to_display, outfile)

  # explanations_path = deepLearningPath + '/xai/' + model_name
  # if not os.path.exists(explanations_path):
  #   os.makedirs(explanations_path)

  #fig = explanation.as_pyplot_figure(label=0)
  #fig.savefig(os.path.join(explanations_path, 'lime.png'), dpi=300, bbox_inches='tight')
  #explanation.save_to_file(os.path.join(explanations_path, 'lime_report.html'))


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