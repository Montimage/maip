import os
import sys
import numpy as np
import pandas as pd

sys.path.append(sys.path[0] + '/..')
from tensorflow.keras.models import load_model
from eventToFeature import eventsToFeatures



prediction_names = ['ip.session_id', 'meta.direction', 'ip', 'ip.pkts_per_flow', 'duration', 'ip.header_len',
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
                    'min_tcp_len', 'max_tcp_len', 'entropy_tcp_len', 'ssl.tls_version', 'malware']

def predict(csv_path, model_path, result_path):
    ips, features = eventsToFeatures(csv_path)
    if len(ips) == 0:
        print('There is no ip traffic to predict')
        return
    # if there are more ips then grouped samples from features (i.e. there is an ip but no features for the ip) -> we delete the ip from ip list
    print("Going to merge features if there are more ips")
    ips = pd.merge(ips, features, how='inner', on=['ip.session_id', 'meta.direction'])
    ips = ips[['ip.session_id', 'meta.direction', 'ip']]
    features.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

    print("Going to test the prediction")
    #
    model = load_model(model_path)
    print("Model has been loaded from")
    y_pred = model.predict(features)
    y_pred = np.transpose(np.round(y_pred)).reshape(y_pred.shape[0], )
    preds = np.array([y_pred]).T
    # nb_attacks = np.count_nonzero(preds!=0)
    # print("Number of attacks: " + str(nb_attacks))
    res = np.append(features, preds, axis=1)
    res = np.append(ips, res, axis=1)

    # print(res)
    if not os.path.exists(result_path):
        os.makedirs(result_path)
    dataFrame = pd.DataFrame(res)
    # print("Total flows: "+ str(len(dataFrame.index)))
    last_column_index = len(prediction_names)-1
    dataFrame.to_csv(f"{result_path}/predictions.csv", index=False, header=prediction_names)
    attackDF = dataFrame[dataFrame[last_column_index] > 0]
    # print("Number of attacks: " + str(len(attackDF.index)))
    attackDF.to_csv(f"{result_path}/attacks.csv", index=False, header=prediction_names)
    normalDF = dataFrame[dataFrame[last_column_index] == 0]
    # print("Number of normals: " + str(len(normalDF.index)))
    normalDF.to_csv(f"{result_path}/normals.csv", index=False, header=prediction_names)
    statsArray =np.array([[len(dataFrame.index),len(attackDF.index),len(normalDF.index)]])
    pd.DataFrame(statsArray).to_csv(f"{result_path}/stats.csv", index=False)

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print('Invalid inputs')
    else:
        csv_path = sys.argv[1]
        model_path = sys.argv[2]
        result_path = sys.argv[3]
        # nb_epoch_cnn = sys.argv[3]?
        # nb_epoch_sae = sys.argv[4]
        # batch_size_cnn = sys.argv[5]
        # batch_size_sae = sys.argv[6]
        predict(csv_path, model_path, result_path)