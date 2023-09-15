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


def retrain_model(train_data_path, test_data_path, result_path, nb_epoch_cnn, nb_epoch_sae, batch_size_cnn, batch_size_sae):
    train_data = pd.read_csv(train_data_path, delimiter=",")
    train_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

    test_data = pd.read_csv(test_data_path, delimiter=",")
    test_data.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)

    d = datetime.now()
    x_train_norm, x_train_mal, x_test_norm, x_test_mal, x_train, y_train, x_test, y_test, scaler = dataScale_cnn(result_path,
        train_data,
        test_data, datetime=d)

    cnn = trainSAE_CNN(result_path=result_path, x_train_norm=x_train_norm, x_train_mal=x_train_mal,
                       x_train=x_train, y_train=y_train,
                       nb_epoch_cnn=nb_epoch_cnn, nb_epoch_sae=nb_epoch_sae,
                       batch_size_cnn=batch_size_cnn, batch_size_sae=batch_size_sae, datenow=d)
    print("Prediction - test")
    y_pred = cnn.predict(x_test)
    print(y_pred)
    y_pred = y_pred.flatten()
    true_labels = test_data['malware']
    df = pd.DataFrame({'prediction': y_pred, 'true_label': true_labels})
    df.to_csv(f'{result_path}/predictions.csv', index=False, header=False)
    y_pred = numpy.transpose(np.round(y_pred)).reshape(y_pred.shape[0], )

    print("Metrics")
    print(classification_report(y_test, y_pred))
    saveConfMatrix(y_true=y_test, y_pred=y_pred,
                   filepath_csv=f'{result_path}/confusion_matrix.csv',
                   filepath_png=f'{result_path}/confusion_matrix.jpg')
    saveScores(y_true=y_test, y_pred=y_pred,
               filepath=f'{result_path}/stats.csv')

    preds = np.array([y_pred]).T
    res = np.append(x_test, preds, axis=1)
    #pd.DataFrame(res).to_csv(f'{result_path}/predictions.csv',
    #                         index=False,
    #                         header=test_data.columns)
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

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 8:
        print('Invalid inputs')
        print('python retrain.py train_data_path test_data_path result_path nb_epoch_cnn nb_epoch_sae batch_size_cnn batch_size_sae')
    else:
        train_data_path = sys.argv[1]
        test_data_path = sys.argv[2]
        result_path = sys.argv[3]
        nb_epoch_cnn = int(sys.argv[4])
        nb_epoch_sae = int(sys.argv[5])
        batch_size_cnn = int(sys.argv[6])
        batch_size_sae = int(sys.argv[7])
        retrain_model(train_data_path, test_data_path, result_path, nb_epoch_cnn, nb_epoch_sae, batch_size_cnn, batch_size_sae)