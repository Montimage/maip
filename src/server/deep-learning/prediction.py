import os
import sys
import numpy as np
import pandas as pd
import constants
from tensorflow.keras.models import load_model
from eventToFeature import eventsToFeatures

sys.path.append(sys.path[0] + '/..')

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
    model = load_model(model_path)
    print("Model has been loaded from")
    
    # Check if feature dimensions match the model's expected input
    expected_features = model.input_shape[1]
    current_features = features.shape[1]
    
    if current_features != expected_features:
        print(f"Warning: Feature mismatch - Model expects {expected_features} features, but got {current_features}")
        
        if current_features > expected_features:
            # Too many features - select the first N features
            print(f"Selecting first {expected_features} features to match model input")
            features = features.iloc[:, :expected_features]
        else:
            # Too few features - pad with zeros
            print(f"Padding with {expected_features - current_features} zero columns")
            padding = pd.DataFrame(np.zeros((features.shape[0], expected_features - current_features)))
            features = pd.concat([features, padding], axis=1)
    
    y_pred = model.predict(features)
    y_pred = np.transpose(np.round(y_pred)).reshape(y_pred.shape[0], )
    preds = np.array([y_pred]).T
    nb_attacks = np.count_nonzero(preds != 0)
    res = np.append(features, preds, axis=1)
    res = np.append(ips, res, axis=1)

    if not os.path.exists(result_path):
        os.makedirs(result_path)
    dataFrame = pd.DataFrame(res)
    print("Total flows: "+ str(len(dataFrame.index)))
    
    # Use only the header values that match the actual DataFrame columns
    num_cols = len(dataFrame.columns)
    header = constants.AD_FEATURES_OUTPUT[:num_cols] if num_cols <= len(constants.AD_FEATURES_OUTPUT) else None
    last_column_index = num_cols - 1
    
    dataFrame.to_csv(f"{result_path}/predictions.csv", index=False, header=header)

    attackDF = dataFrame[dataFrame[last_column_index] > 0]
    print("Number of attacks: " + str(len(attackDF.index)))
    attackDF.to_csv(f"{result_path}/attacks.csv", index=False, header=header)

    normalDF = dataFrame[dataFrame[last_column_index] == 0]
    print("Number of normals: " + str(len(normalDF.index)))
    normalDF.to_csv(f"{result_path}/normals.csv", index=False, header=header)

    statsArray =np.array([[len(normalDF.index), len(attackDF.index), len(dataFrame.index)]])
    pd.DataFrame(statsArray).to_csv(f"{result_path}/stats.csv", index=False)

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print('Invalid inputs')
    else:
        csv_path = sys.argv[1]
        model_path = sys.argv[2]
        result_path = sys.argv[3]
        predict(csv_path, model_path, result_path)