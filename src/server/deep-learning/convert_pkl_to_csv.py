import pandas as pd
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from python_logger import get_logger, print_error

logger = get_logger('convert_pkl_to_csv')

def convert_pkl_to_csv(input_pkl, output_csv):
    """
    Converts a pickle (.pkl) file to a CSV file.

    :param input_pkl: Path to the input .pkl file.
    :param output_csv: Path to save the output .csv file.
    """
    try:
        # Load the pickle file
        logger.debug(f"Loading pickle file: {input_pkl}")
        df = pd.read_pickle(input_pkl)

        # Clean the data (optional: remove infinite values)
        original_rows = len(df)
        logger.debug(f"Checking data integrity ({original_rows} rows before cleaning)")
        df = df[df.notnull().all(axis=1)]  # Remove rows with NaN values
        df = df.replace([float('inf'), float('-inf')], 0)  # Replace infinities
        cleaned_rows = len(df)
        logger.debug(f"Data cleaned ({cleaned_rows} rows after cleaning)")

        # Save to CSV
        df.to_csv(output_csv, index=False)
        logger.info(f"Successfully converted {original_rows} rows to {output_csv}")

    except Exception as e:
        print_error(f"Error processing file {input_pkl}: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print_error("Invalid arguments")
        print_error("Usage: python convert_pkl_to_csv.py <input_pkl_file> <output_csv_file>")
        sys.exit(1)
    else:
        input_pkl = sys.argv[1]
        output_csv = sys.argv[2]
        convert_pkl_to_csv(input_pkl, output_csv)

