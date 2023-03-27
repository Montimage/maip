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


str_features = "ip.session_id,meta.direction,ip.pkts_per_flow,duration,ip.header_len,ip.payload_len,ip.avg_bytes_tot_len,time_between_pkts_sum,time_between_pkts_avg,time_between_pkts_max,time_between_pkts_min,time_between_pkts_std,\"(-0.001, 50.0]\",\"(50.0, 100.0]\",\"(100.0, 150.0]\",\"(150.0, 200.0]\",\"(200.0, 250.0]\",\"(250.0, 300.0]\",\"(300.0, 350.0]\",\"(350.0, 400.0]\",\"(400.0, 450.0]\",\"(450.0, 500.0]\",\"(500.0, 550.0]\",tcp_pkts_per_flow,pkts_rate,tcp_bytes_per_flow,byte_rate,tcp.tcp_session_payload_up_len,tcp.tcp_session_payload_down_len,\"(-0.001, 150.0]\",\"(150.0, 300.0]\",\"(300.0, 450.0]\",\"(450.0, 600.0]\",\"(600.0, 750.0]\",\"(750.0, 900.0]\",\"(900.0, 1050.0]\",\"(1050.0, 1200.0]\",\"(1200.0, 1350.0]\",\"(1350.0, 1500.0]\",\"(1500.0, 10000.0]\",tcp.fin,tcp.syn,tcp.rst,tcp.psh,tcp.ack,tcp.urg,sport_g,sport_le,dport_g,dport_le,mean_tcp_pkts,std_tcp_pkts,min_tcp_pkts,max_tcp_pkts,entropy_tcp_pkts,mean_tcp_len,std_tcp_len,min_tcp_len,max_tcp_len,entropy_tcp_len,ssl.tls_version,malware\n"

# Names of the columns that are discrete
discrete_columns = [
  'ip.pkts_per_flow', 'ip.header_len', 'ip.payload_len',
  '(-0.001, 50.0]', '(50.0, 100.0]', '(100.0, 150.0]', '(150.0, 200.0]',
  '(200.0, 250.0]', '(250.0, 300.0]', '(300.0, 350.0]', '(350.0, 400.0]', 
  '(400.0, 450.0]', '(450.0, 500.0]', '(500.0, 550.0]',
  'tcp_pkts_per_flow', 'tcp_bytes_per_flow', 
  '(-0.001, 150.0]', '(150.0, 300.0]', '(300.0, 450.0]', '(450.0, 600.0]',
  '(600.0, 750.0]', '(750.0, 900.0]', '(900.0, 1050.0]', '(1050.0, 1200.0]',
  '(1200.0, 1350.0]', '(1350.0, 1500.0]', '(1500.0, 10000.0]', 
  'tcp.fin', 'tcp.syn', 'tcp.rst', 'tcp.psh', 'tcp.ack', 'tcp.urg', 'sport_g', 
  'sport_le', 'dport_g', 'dport_le', 'mean_tcp_pkts', 'std_tcp_pkts', 
  'min_tcp_pkts', 'max_tcp_pkts', 'entropy_tcp_pkts',
  'min_tcp_len', 'max_tcp_len', 'ssl.tls_version', 'entropy_tcp_len',
  'malware'
]

def running_ctgan(modelId, numberEpochs, numberSyntheticSamples):
  deepLearningPath = str(os.path.join(Path.cwd(),'deep-learning'))
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
  ctgan.fit(target_dataset, discrete_columns=discrete_columns)

  # Create synthetic data
  synthetic_data = ctgan.sample(int(numberSyntheticSamples))
  print(synthetic_data.values[0])

  attacks_path = deepLearningPath + '/attacks/' + model_name
  if not os.path.exists(attacks_path):
    os.makedirs(attacks_path)
  ctgan_file = os.path.join(attacks_path, 'ctgan_samples.csv') 
  print(ctgan_file)
  with open(ctgan_file, "w") as f:
    f.write(str_features)
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
