const BASE_PATH = process.env.DOCKER_ENV ? '/maip-app/src/server' : __dirname;
const LOG_PATH = `${BASE_PATH}/logs/`;
const DEFAULT_LOG_PATH = `${BASE_PATH}/logs/all-logs.log`;
const MMT_PATH = `${BASE_PATH}/mmt/`;
const REPORT_PATH = `${MMT_PATH}outputs/`;
const PCAP_PATH = `${MMT_PATH}pcaps/`;
const MMT_PROBE_CONFIG_PATH = `${MMT_PATH}mmt-probe.conf`;
const PCAP_EXTENSIONS = ['.pcap', '.pcapng', '.cap'];
// Deep learning constants paths
const DEEP_LEARNING_PATH = `${BASE_PATH}/deep-learning/`;
const MODEL_PATH = `${DEEP_LEARNING_PATH}models/`;
const PREDICTION_PATH = `${DEEP_LEARNING_PATH}predictions/`;
const TRAINING_PATH = `${DEEP_LEARNING_PATH}trainings/`;
const XAI_PATH = `${DEEP_LEARNING_PATH}xai/`;
const ATTACKS_PATH = `${DEEP_LEARNING_PATH}attacks/`;
const DATASETS_PATH = `${DEEP_LEARNING_PATH}datasets/`;
const PYTHON_CMD = `python3`;

const AC_PATH = `${BASE_PATH}/activity-classification/`;
const AC_TRAINING_PATH = `${AC_PATH}trainings/`;

const OUTPUT_DIRS = [TRAINING_PATH, PREDICTION_PATH, XAI_PATH, ATTACKS_PATH];

module.exports = {
  PYTHON_CMD,
  AC_PATH, AC_TRAINING_PATH,
  MMT_PATH,
  REPORT_PATH,
  MMT_PROBE_CONFIG_PATH,
  LOG_PATH,
  DEFAULT_LOG_PATH,
  PCAP_PATH,
  MODEL_PATH,
  DEEP_LEARNING_PATH,
  PREDICTION_PATH,
  TRAINING_PATH,
  XAI_PATH,
  ATTACKS_PATH,
  DATASETS_PATH,
  PCAP_EXTENSIONS,
  OUTPUT_DIRS,
};
