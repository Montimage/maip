# from matplotlib import pyplot as plt
import pickle
from sklearn.metrics import confusion_matrix, classification_report
from sklearn.utils import shuffle
from sklearn.preprocessing import MinMaxScaler
import numpy as np
import pandas as pd
import seaborn as sn
import os

"""
Help functions including functions for saving the confusion matrix/scores, data scaling etc.
"""
CIC_col_names = ['Flow Duration', 'Tot Fwd Pkts', 'Tot Bwd Pkts', 'TotLen Fwd Pkts',
             'TotLen Bwd Pkts', 'Fwd Pkt Len Max', 'Fwd Pkt Len Min', 'Fwd Pkt Len Mean', 'Fwd Pkt Len Std',
             'Bwd Pkt Len Max',
             'Bwd Pkt Len Min', 'Bwd Pkt Len Mean', 'Bwd Pkt Len Std', 'Flow Byts/s', 'Flow Pkts/s', 'Flow IAT Mean',
             'Flow IAT Std',
             'Flow IAT Max', 'Flow IAT Min', 'Fwd IAT Tot', 'Fwd IAT Mean', 'Fwd IAT Std', 'Fwd IAT Max', 'Fwd IAT Min',
             'Bwd IAT Tot',
             'Bwd IAT Mean', 'Bwd IAT Std', 'Bwd IAT Max', 'Bwd IAT Min', 'Fwd PSH Flags', 'Bwd PSH Flags',
             'Fwd URG Flags',
             'Bwd URG Flags', 'Fwd Header Len', 'Bwd Header Len', 'Fwd Pkts/s', 'Bwd Pkts/s', 'Pkt Len Min',
             'Pkt Len Max',
             'Pkt Len Mean', 'Pkt Len Std', 'Pkt Len Var', 'FIN Flag Cnt', 'SYN Flag Cnt', 'RST Flag Cnt',
             'PSH Flag Cnt',
             'ACK Flag Cnt', 'URG Flag Cnt', 'CWE Flag Count', 'ECE Flag Cnt', 'Down/Up Ratio', 'Pkt Size Avg',
             'Fwd Seg Size Avg',
             'Bwd Seg Size Avg', 'Fwd Byts/b Avg', 'Fwd Pkts/b Avg', 'Fwd Blk Rate Avg', 'Bwd Byts/b Avg',
             'Bwd Pkts/b Avg',
             'Bwd Blk Rate Avg', 'Subflow Fwd Pkts', 'Subflow Fwd Byts', 'Subflow Bwd Pkts', 'Subflow Bwd Byts',
             'Init Fwd Win Byts',
             'Init Bwd Win Byts', 'Fwd Act Data Pkts', 'Fwd Seg Size Min', 'Active Mean', 'Active Std', 'Active Max',
             'Active Min',
             'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min', 'Label']

CIC_types_dict = {'Flow Duration': int, 'Tot Fwd Pkts': int, 'Tot Bwd Pkts': int, 'TotLen Fwd Pkts': int,
              'TotLen Bwd Pkts': int, 'Label': 'string'}

CIC_types_dict.update({col: float for col in CIC_col_names if col not in CIC_types_dict})


def saveConfMatrix(y_true, y_pred, filepath_csv, filepath_png):
    cm = confusion_matrix(y_true, y_pred)
    pd.DataFrame(cm).to_csv(filepath_csv)
    # cm_display = ConfusionMatrixDisplay(cm).plot()
    df_cfm = pd.DataFrame(cm, index=['0', '1'], columns=['0', '1'])
    # plt.figure(figsize=(15, 12))
    cfm_plot = sn.heatmap(df_cfm, annot=True, fmt='.1f')
    cfm_plot.figure.savefig(filepath_png)


def saveScores(y_true, y_pred, filepath):
    # print("Metrics")
    report = classification_report(y_true, y_pred, output_dict=True)
    stats = pd.DataFrame(report).transpose()
    stats.to_csv(filepath, header=True)


def dataScale(train_data, validation_data, test_data, datetime):
    train_data = shuffle(train_data)
    x_train = train_data.iloc[:, :-1]
    y_train = train_data.iloc[:, -1]
    x_train = np.asarray(x_train, np.float32)
    y_train = np.asarray(y_train, np.float32)
    scaler = MinMaxScaler()
    scaler.fit(x_train)
    x_train = scaler.transform(x_train)
    pickle.dump(scaler, open('./saved_scalers/scaler_{}'.format(datetime.strftime("%Y-%m-%d_%H-%M-%S")), 'wb'))

    x_val = validation_data.iloc[:, :-1]
    y_val = validation_data.iloc[:, -1]
    x_val = np.asarray(x_val, np.float32)
    y_val = np.asarray(y_val, np.float32)
    x_val = scaler.transform(x_val)

    x_test = test_data.iloc[:, :-1]
    y_test = test_data.iloc[:, -1]
    x_test = np.asarray(x_test, np.float32)
    y_test = np.asarray(y_test, np.float32)
    x_test = scaler.transform(x_test)

    return x_train, y_train, x_test, y_test, x_val, y_val


def dataScale_cnn(result_path, train_data, test_data, datetime, validation_data = None):
    """
    Scales the training and test data (validation is optional) and divides it into x (inputs) and y (labels)
    for SAE+CNN model - returns separate set of normal and malicious data for training SAE and joined one for CNN.

    :param train_data: dataframe with training set (inputs, labels)
    :param test_data: dataframe with test set (inputs, labels)
    :param validation_data: dataframe with validation (inputs, labels)
    :return: x_train_norm, x_train_mal - scaled divided training set for SAE normal/malicious; x_test_norm, x_test_mal
    - scaled divided test set for SAE normal/malicious;  x_train, y_train, x_test, y_test - scaled train and test set
    for CNN; scaler - MinMax scaler used for scaling the data

    """
    train_data = shuffle(train_data)
    x_train = train_data.iloc[:, :-1]
    y_train = train_data.iloc[:, -1]
    x_train = np.asarray(x_train, np.float32)
    y_train = np.asarray(y_train, np.float32)
    scaler = MinMaxScaler()
    scaler.fit(x_train)
    x_train = scaler.transform(x_train)

    # create the result path if it does not exists
    if not os.path.exists(result_path):
        os.makedirs(result_path)
    scaler_file = os.path.join(result_path, "scaler_" + str(format(datetime.strftime("%Y-%m-%d_%H-%M-%S"))) + ".pkl")
    if not os.path.isfile(scaler_file):
        open(scaler_file, 'w').close()
    pickle.dump(scaler, open(scaler_file, 'wb'))

    x_train_norm = x_train[y_train[:] == 0, :]
    x_train_mal = x_train[y_train[:] == 1, :]

    x_test = test_data.iloc[:, :-1]
    y_test = test_data.iloc[:, -1]
    x_test = np.asarray(x_test, np.float32)
    y_test = np.asarray(y_test, np.float32)
    x_test = scaler.transform(x_test)
    x_test_norm = x_test[y_test[:] == 0, :]
    x_test_mal = x_test[y_test[:] == 1, :]

    if validation_data is not None:
        x_val = validation_data.iloc[:, :-1]
        y_val = validation_data.iloc[:, -1]
        x_val = np.asarray(x_val, np.float32)
        y_val = np.asarray(y_val, np.float32)
        x_val = scaler.transform(x_val)

        return x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, x_val, y_val, scaler

    return x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler