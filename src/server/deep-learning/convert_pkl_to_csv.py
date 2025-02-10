import pandas as pd
import sys
import os

def convert_pkl_to_csv(input_pkl, output_csv):
    """
    Converts a pickle (.pkl) file to a CSV file.

    :param input_pkl: Path to the input .pkl file.
    :param output_csv: Path to save the output .csv file.
    """
    try:
        # Load the pickle file
        print(f"Loading pickle file: {input_pkl}")
        df = pd.read_pickle(input_pkl)

        # Clean the data (optional: remove infinite values)
        print(f"Checking data integrity ({len(df)} rows before cleaning)")
        df = df[df.notnull().all(axis=1)]  # Remove rows with NaN values
        df = df.replace([float('inf'), float('-inf')], 0)  # Replace infinities
        print(f"Data cleaned ({len(df)} rows after cleaning)")

        # Save to CSV
        df.to_csv(output_csv, index=False)
        print(f"Successfully saved CSV: {output_csv}")

    except Exception as e:
        print(f"Error processing file {input_pkl}: {e}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Invalid arguments")
        print("Usage: python convert_pkl_to_csv.py <input_pkl_file> <output_csv_file>")
    else:
        input_pkl = sys.argv[1]
        output_csv = sys.argv[2]
        convert_pkl_to_csv(input_pkl, output_csv)

