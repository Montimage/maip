const LOG_PATH = `${__dirname}/logs/`;
const DEFAULT_LOG_PATH = `${__dirname}/logs/all-logs.log`;
const MMT_PATH = `${__dirname}/mmt/`;
const REPORT_PATH = `${MMT_PATH}/outputs/`;
const PCAP_PATH = `${MMT_PATH}/pcaps/`;
const MMT_PROBE_CONFIG_PATH = `${MMT_PATH}/mmt-probe.conf`;
const allowExtensions = ['.pcap', '.pcapng', '.cap'];
// Deep learning constants paths
//const DEEP_LEARNING_PATH = `${__dirname}/deep-learning/`;
const MAIP_PATH = `/home/strongcourage/maip-app/src/server`;
const DEEP_LEARNING_PATH = `${MAIP_PATH}/deep-learning/`;
const MODEL_PATH = `${DEEP_LEARNING_PATH}/models/`;
const PREDICTION_PATH = `${DEEP_LEARNING_PATH}/predictions/`;
const TRAINING_PATH = `${DEEP_LEARNING_PATH}/trainings/`;
const XAI_PATH = `${DEEP_LEARNING_PATH}/xai/`;
const ATTACKS_PATH = `${DEEP_LEARNING_PATH}/attacks/`;
const DATASETS_PATH = `${DEEP_LEARNING_PATH}/datasets/`;
const PYTHON_CMD = `python3`;

module.exports = {
  PYTHON_CMD,
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
  allowExtensions,
};
