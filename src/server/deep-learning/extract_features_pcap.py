import os
import subprocess
import sys
import pandas as pd

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from python_logger import get_logger, print_status, print_error

logger = get_logger('extract_features_pcap')

def run_command(command):
    """Executes a shell command and logs its output."""
    logger.debug(f"Running: {command}")
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print_error(f"Command failed: {result.stderr}")
        sys.exit(1)
    logger.debug(result.stdout)

def process_pcap(pcap_file, is_malicious):
    """
    Runs the full workflow from pcap processing to CSV conversion.
    """
    base_name = os.path.splitext(os.path.basename(pcap_file))[0]
    output_dir = f"/tmp/{base_name}-reports"
    output_pkl = f"/tmp/{base_name}.pkl"
    output_csv = f"/tmp/{base_name}.csv"

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Step 1: Run mmt-probe to generate MMT reports
    report_csv = os.path.join(output_dir, f"{base_name}.pcap.csv")
    mmt_command = f"mmt-probe -c mmt-probe.conf -t {pcap_file} -X \"file-output.output-dir={output_dir}\" -X \"file-output.output-file={base_name}.pcap.csv\""
    run_command(mmt_command)

    # Step 2: Extract features from the generated report
    feature_extraction_command = f"python3 trafficToFeature.py {report_csv} {output_pkl} {is_malicious}"
    run_command(feature_extraction_command)

    # Step 3: Convert the pickle file to CSV
    convert_pkl_to_csv(output_pkl, output_csv)

def convert_pkl_to_csv(input_pkl, output_csv):
    """Converts a pickle (.pkl) file to a CSV file."""
    try:
        df = pd.read_pickle(input_pkl)

        # Clean data efficiently
        df = df[df.notnull().all(axis=1)]  # Remove rows with NaN values
        df = df.replace([float('inf'), float('-inf')], 0)  # Replace infinities

        df.to_csv(output_csv, index=False)
        logger.info(f"Successfully processed {len(df)} features to {output_csv}")
    except Exception as e:
        print_error(f"Error processing file {input_pkl}: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print_error("Usage: python process_pcap.py <pcap_file> <is_malicious (True/False)>")
        sys.exit(1)

    pcap_file = sys.argv[1]
    is_malicious = sys.argv[2].lower() == "true"
    process_pcap(pcap_file, is_malicious)
