import os.path
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
try:
    from python_logger import get_logger, print_error
    logger = get_logger('trafficToFeature')
except ImportError:
    # Fallback if logger not available
    logger = None
    def print_error(msg):
        print(f"ERROR: {msg}")

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
        # Extract features directly without debug prints
        _, p1_features = eventsToFeatures(in_csv)
        if is_malware:
            p1_features['malware'] = 1
        else:
            p1_features['malware'] = 0

        # Save to pickle file (removed debug prints)
        p1_features.to_pickle(out_pkl)
        if logger:
            logger.info(f"Extracted {p1_features.shape[0]} features from {in_csv}")
        else:
            print(f"Extracted {p1_features.shape[0]} features from {in_csv}")
    # Removed unnecessary print statement for existing file

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print_error('Invalid inputs')
        print_error('python trafficToFeature.py <in_csv> <out_pkl> <is_malware>')
        sys.exit(1)
    else:
        input_csv_file = sys.argv[1]
        pickle_file = sys.argv[2]
        is_malware = False
        if sys.argv[3] == 'true' or sys.argv[3] == 'True':
            is_malware = True
        # Removed verbose debug prints
        trafficToFeatures(input_csv_file, pickle_file, is_malware)
