import datetime
from matplotlib import pyplot as plt
import numpy as np
import pandas as pd

"""
Help funcitons for visualization of accuracy/error etc.

"""

def drawLossAccuracy(history, accuracy_file, loss_file):
    """
    Draws accuracy for training/testing

    :param history: from fitted model
    :param accuracy_file: filename
    :param loss_file: filename
    :return:
    """
    d = datetime.datetime.now()
    plt.plot(history.history['accuracy'])
    plt.plot(history.history['val_accuracy'])
    plt.title('model accuracy')
    plt.ylabel('accuracy')
    plt.legend(['train', 'test'], loc='upper left')
    plt.savefig(accuracy_file)
    # plt.show()
    plt.cla()

    # summarize history for loss
    plt.plot(history.history['loss'])
    plt.plot(history.history['val_loss'])
    plt.title('model loss')
    plt.ylabel('loss')
    plt.legend(['train', 'test'], loc='upper left')
    plt.savefig(loss_file)
    plt.cla()
    # plt.show()


def drawError(autoencoder, x_test, y_test, d=None, errorpath=None):

    """
    Draws error rate for autoencoder (used for structure with only one stacked autoencoder to get threshold)

    :param autoencoder: autoencoder model (trained)
    :param x_test: test dataset (x)
    :param y_test:  test dataset (y)
    :param d: datetime (optional)
    :param errorpath: path for saving the plot  (optional)
    :return:
    """
    if d is None:
        d = datetime.datetime.now()
    test_x_predictions = autoencoder.predict(x_test)
    mse = np.mean(np.power(x_test - test_x_predictions, 2), axis=1)
    error_df = pd.DataFrame({'Reconstruction_error': mse,
                             'True_class': y_test})

    threshold_fixed = np.quantile(mse, 0.5)
    groups = error_df.groupby('True_class')
    fig, ax = plt.subplots()
    print(error_df)
    for name, group in groups:
        ax.plot(group.index, group.Reconstruction_error, marker='o', ms=3.5, linestyle='',
                label="Fraud" if name == 1 else "Normal")
    ax.hlines(threshold_fixed, ax.get_xlim()[0], ax.get_xlim()[1], colors="r", zorder=100, label='Threshold')
    ax.legend()
    plt.ylim([ax.get_ylim()[0], ax.get_ylim()[1]])
    # plt.ylim([0, threshold_fixed])
    plt.title("Reconstruction error for normal and fraud data")
    plt.ylabel("Reconstruction error")
    plt.xlabel("Data point index")
    if errorpath is None:
        plt.savefig('./results/error-rate {}.jpg'.format(d.strftime("%Y-%m-%d_%H-%M-%S")))
    else:
        plt.savefig(errorpath)
    # plt.show()


def drawErrorFromPredictions(test_x_predictions, x_test_scaled, y_test):
    d = datetime.datetime.now()
    mse = np.mean(np.power(x_test_scaled - test_x_predictions, 2), axis=1)
    error_df = pd.DataFrame({'Reconstruction_error': mse,
                             'True_class': y_test})

    threshold_fixed = np.quantile(mse, 0.98)
    groups = error_df.groupby('True_class')
    fig, ax = plt.subplots()
    print(error_df)
    for name, group in groups:
        ax.plot(group.index, group.Reconstruction_error, marker='o', ms=3.5, linestyle='',
                label="Fraud" if name == 1 else "Normal")
    ax.hlines(threshold_fixed, ax.get_xlim()[0], ax.get_xlim()[1], colors="r", zorder=100, label='Threshold')
    ax.legend()
    # plt.ylim([ax.get_ylim()[0], ax.get_ylim()[1]])
    # plt.ylim([0, 2 * threshold_fixed])
    plt.title("Reconstruction error for normal and fraud data")
    plt.ylabel("Reconstruction error")
    plt.xlabel("Data point index")
    plt.savefig('./results/error-rate {}.jpg'.format(d.strftime("%Y-%m-%d_%H-%M-%S")))
    plt.show()
