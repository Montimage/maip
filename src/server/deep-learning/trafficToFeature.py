import os.path
import sys

from eventToFeature import eventsToFeatures

def trafficToFeatures(in_csv, out_pkl, is_malware=False):
    """
    Reads .csv, extracts set of mmt-probe attributes for each of the event and based on them calculates ML feaures
    (to one dataframe), adds additional column with label at the end of feature dataframe, and returns it in pkl form

    :param in_csv: mmt-probe report path
    :param out_pkl: path of pickle with dataframe consisting of calculated ML features
    :param is_malware: label to be added as last column to final dataframe determining if the traffic was normal (value 0)
    or malicious (value 1)
    :return: pickle with dataframe consisting of calculated ML features
    """
    if not os.path.isfile(out_pkl):
        # ip_traffic, tcp_traffic, tls_traffic = readAndExtractEvents(in_csv)
        # print("trafficToFeatures")
        # print(ip_traffic)
        # _, p1_features = calculateFeatures(ip_traffic, tcp_traffic, tls_traffic)
        # p1_features = p1_features.fillna(0)
        _, p1_features = eventsToFeatures(in_csv)
        if is_malware:
            p1_features['malware'] = 1
        else:
            p1_features['malware'] = 0

        print(p1_features.columns)
        p1_features.to_pickle(out_pkl)
        print("Extracted {} features".format(p1_features.shape[0]))
        p1_features = p1_features[0:0]
    else:
        print("Pkl {} already exists".format(out_pkl))

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print('Invalid inputs')
        print('python trafficToFeature.py <in_csv> <out_pkl> <is_malware>')
    else:
        input_csv_file = sys.argv[1]
        pickle_file = sys.argv[2]
        is_malware = False
        if sys.argv[3] == 'true' or sys.argv[3] == 'True':
            is_malware = True
        print('Input CSV file: ')
        print(input_csv_file)
        print('Pickle file: ')
        print(pickle_file)
        trafficToFeatures(input_csv_file, pickle_file, is_malware)


