from datetime import datetime
import numpy
from sklearn.metrics import classification_report
import numpy as np
import pandas as pd
import sys
from tools import saveConfMatrix, saveScores, dataScale_cnn
from sae_cnn import trainSAE_CNN
import timeit
import os
from sklearn.inspection import permutation_importance

def train_model(train_data_path, test_data_path, result_path, nb_epoch_cnn, nb_epoch_sae,batch_size_cnn, batch_size_sae):
    train_data = pd.read_csv(train_data_path, delimiter=",")

    train_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

    test_data = pd.read_csv(test_data_path, delimiter=",")
    test_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

    d = datetime.now()
    x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler = dataScale_cnn(result_path,
        train_data,
        test_data, datetime=d)

    # input_dim = x_train.shape[1]

    cnn = trainSAE_CNN(result_path=result_path, x_train_norm=x_train_norm, x_train_mal=x_train_mal,
                       x_train=x_train, y_train=y_train,
                       nb_epoch_cnn=nb_epoch_cnn, nb_epoch_sae=nb_epoch_sae,
                       batch_size_cnn=batch_size_cnn, batch_size_sae=batch_size_sae, datenow=d)
    # cnn.save(f'{result_path}/model.h5')
    print("Prediction - test")
    y_pred = cnn.predict(x_test)
    print(y_pred)
    y_pred = y_pred.flatten()
    true_labels = test_data['malware']
    df = pd.DataFrame({'prediction': y_pred, 'true_label': true_labels})
    df.to_csv(f'{result_path}/predictions.csv', index=False, header=False)

    # apply sigmoid to convert output to probability for both classes
    y_prob = 1 / (1 + np.exp(-y_pred))
    df = pd.DataFrame(
        {'Malware_prob': y_prob, 'Normal_prob': 1 - y_prob},
        columns=['Normal_prob', 'Malware_prob'])
    df.to_csv(f'{result_path}/predicted_probabilities.csv', index=False)
    y_pred = numpy.transpose(np.round(y_pred)).reshape(y_pred.shape[0], )

    #result = permutation_importance(cnn, x_test, y_test, n_repeats=1, random_state=0)
    #print(result.importances_mean)

    print("Metrics")
    # print(y_pred)
    # print(y_test)


    print(classification_report(y_test, y_pred))
    saveConfMatrix(y_true=y_test, y_pred=y_pred,
                   filepath_csv=f'{result_path}/confusion_matrix.csv',
                   filepath_png=f'{result_path}/confusion_matrix.jpg')
    saveScores(y_true=y_test, y_pred=y_pred,
               filepath=f'{result_path}/stats.csv')

    """
    preds = np.array([y_pred]).T
    res = np.append(x_test, preds, axis=1)
    pd.DataFrame(res).to_csv(f'{result_path}/predictions.csv',
                             index=False,
                             header=test_data.columns)
    """
    print('Going to save model')
    cnn.save(f'{result_path}/model.h5')

    # Compute time for predictions and save it to file
    generation_iters = 1
    time_taken = timeit.timeit(lambda: cnn.predict(x_test), number=generation_iters)
    print("Time taken for predictions in seconds: ", time_taken)
    statsfile = os.path.join(result_path, 'time_stats.txt') 
    print(statsfile)
    with open(statsfile, "w") as f:
      f.write(str(time_taken))
      f.close()

"""
    # Get the predicted classes
    #y_pred_classes = np.argmax(y_pred, axis=1)
    y_pred_classes = np.argmax(y_pred.reshape(-1, 2), axis=1)

    # Get the true classes
    #y_true = np.argmax(y_test, axis=1)
    y_true = np.argmax(y_test.reshape(-1, 2), axis=1)

    # Create a list of predicted and true values for each sample
    y_values = []
    for i in range(len(y_pred_classes)):
        y_values.append([y_pred_classes[i], y_true[i]])

    # Convert the list into a numpy array
    y_values = np.array(y_values)

    # Print the first 10 samples
    print(y_values[:10])
"""

    # sending the results
    # producer = KafkaProducer(bootstrap_servers=['localhost:9092'])
    # j_cnn = cnn.to_json().encode('utf-8')

    # print(f'Producing message @ {datetime.now()}')
    # psend = producer.send('models', j_cnn)
    # producer.flush()

# train_data_path = './data/BotTrain_31704_samples.csv'
# test_data_path = './data/BotTest_13586_samples.csv'
nb_epoch_sae = 5  # 30#10000
batch_size_sae = 16  # 128
nb_epoch_cnn = 2
batch_size_cnn = 32

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print('Invalid inputs')
        print('python trainer.py <train_data_path> <test_data_path> <result_path>')
    else:
        train_data_path = sys.argv[1]
        test_data_path = sys.argv[2]
        result_path = sys.argv[3]
        # nb_epoch_cnn = sys.argv[3]?
        # nb_epoch_sae = sys.argv[4]
        # batch_size_cnn = sys.argv[5]
        # batch_size_sae = sys.argv[6]
        train_model(train_data_path, test_data_path, result_path, nb_epoch_cnn, nb_epoch_sae,batch_size_cnn, batch_size_sae)