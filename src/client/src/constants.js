const SERVER_HOST = "localhost";
const SERVER_PORT = 31057;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

const MENU_OPTIONS = [
  { key: '0', link: '/build' },
  { key: '1', link: '/models' },
  { key: '2', link: '/models/all' },
  { key: '3', link: '/models/comparison' },
  { key: '4', link: '/predict' },
  { key: '5', link: '/predict/online' },
  { key: '6', link: '/predict/offline' },
  { key: '7', link: '/attacks' },
  { key: '8', link: '/xai' },
  { key: '9', link: '/xai/shap' },
  { key: '10', link: '/xai/lime' },
  { key: '11', link: '/metrics' },
  { key: '12', link: '/metrics/accountability' },
  { key: '13', link: '/metrics/resilience' },
  { key: '14', link: '/reports' },
  { key: '15', link: '/models/retrain' },
  { key: '16', link: '/about' },
];

const AD_FEATURES_DESCRIPTIONS = {
  'ip.session_id': { 
    description: 'Session ID', 
    type: 'numerical', 
  }, // don't use
  'meta.direction': { 
    description: 'Flow direction (0 means uplink and 1 means downlink)', 
    type: 'categorical', 
  }, // don't use
  'ip.pkts_per_flow': { 
    description: 'Total number of IP packets',
    type: 'numerical', 
  },
  'duration': { 
    description: 'Flow duration',
    type: 'numerical', 
  },
  'ip.header_len': { 
    description: 'Total length of IP header',
    type: 'numerical', 
  },
  'ip.payload_len': { 
    description: 'Total length of IP payload', 
    type: 'numerical', 
  },
  'ip.avg_bytes_tot_len': { 
    description: 'Average of total length of IP header', 
    type: 'numerical', 
  },
  'time_between_pkts_sum': { 
    description: 'Sum time between two flows',
    type: 'numerical', 
  },
  'time_between_pkts_avg': { 
    description: 'Average time between two flows', 
    type: 'numerical', 
  },
  'time_between_pkts_max': { 
    description: 'Maximum time between two flows',
    type: 'numerical', 
  },
  'time_between_pkts_min': { 
    description: 'Minimum time between two flows', 
    type: 'numerical', 
  },
  'time_between_pkts_std': { 
    description: 'Standard deviation time two flows', 
    type: 'numerical', 
  },
  '(-0.001, 50.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 1',
    type: 'categorical', 
  },
  '(50.0, 100.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 2', 
    type: 'categorical', 
  },
  '(100.0, 150.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 3', 
    type: 'categorical', 
  },
  '(150.0, 200.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 4', 
    type: 'categorical', 
  },
  '(200.0, 250.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 5',
    type: 'categorical', 
  },
  '(250.0, 300.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 6', 
    type: 'categorical', 
  },
  '(300.0, 350.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 7', 
    type: 'categorical', 
  },
  '(350.0, 400.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 8', 
    type: 'categorical', 
  },
  '(400.0, 450.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 9',
    type: 'categorical', 
  },
  '(450.0, 500.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 10', 
    type: 'categorical', 
  },
  '(500.0, 550.0]': { 
    description: 'Sequence of Packet Time (STP) of bin 11', 
    type: 'categorical', 
  },
  'tcp_pkts_per_flow': { 
    description: 'Total number of TCP packets', 
    type: 'numerical', 
  },
  'pkts_rate': { 
    description: 'Number of packets per second',
    type: 'numerical', 
  },
  'tcp_bytes_per_flow': { 
    description: 'Total number of bytes of TCP packets', 
    type: 'numerical', 
  },
  'byte_rate': { 
    description: 'Number of bytes per second', 
    type: 'numerical', 
  },
  'tcp.tcp_session_payload_up_len': { 
    description: 'Upload ratio',
    type: 'categorical', 
  },
  'tcp.tcp_session_payload_down_len': { 
    description: 'Download ratio', 
    type: 'categorical', 
  },
  '(-0.001, 150.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 1',
    type: 'categorical', 
  },
  '(150.0, 300.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 2', 
    type: 'categorical', 
  },
  '(300.0, 450.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 3', 
    type: 'categorical', 
  },
  '(450.0, 600.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 4', 
    type: 'categorical', 
  },
  '(600.0, 750.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 5',
    type: 'categorical', 
  },
  '(750.0, 900.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 6', 
    type: 'categorical', 
  },
  '(900.0, 1050.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 7', 
    type: 'categorical', 
  },
  '(1050.0, 1200.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 8',
    type: 'categorical', 
  },
  '(1200.0, 1350.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 9', 
    type: 'categorical', 
  },
  '(1350.0, 1500.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 10', 
    type: 'categorical', 
  },
  '(1500.0, 10000.0]': { 
    description: 'Sequence of Packet Length (STL) of bin 11', 
    type: 'categorical', 
  },
  'tcp.fin': { 
    description: 'Number of packets with flag FIN',
    type: 'categorical', 
  },
  'tcp.syn': { 
    description: 'Number of packets with flag SYN', 
    type: 'categorical', 
  },
  'tcp.rst': { 
    description: 'Number of packets with flag RST', 
    type: 'categorical', 
  },
  'tcp.psh': { 
    description: 'Number of packets with flag PSH', 
    type: 'categorical', 
  },
  'tcp.ack': { 
    description: 'Number of packets with flag ACK', 
    type: 'categorical', 
  },
  'tcp.urg': { 
    description: 'Number of packets with flag URG', 
    type: 'categorical', 
  },
  'sport_g': { 
    description: 'Sum of ephemeral source ports (port number > 1024)', 
    type: 'categorical', 
  },
  'sport_le': { 
    description: 'Sum of non-ephemeral source ports (port number <= 1024)', 
    type: 'categorical', 
  },
  'dport_g': { 
    description: 'Sum of ephemeral destination ports (port number > 1024)',
    type: 'categorical', 
  },
  'dport_le': { 
    description: 'Sum of non-ephemeral destination ports (port number with <= 1024)', 
    type: 'categorical', 
  },
  'mean_tcp_pkts': { 
    description: 'Average number of TCP packets', 
    type: 'numerical', 
  },
  'std_tcp_pkts': { 
    description: 'Standard deviation of number of TCP packets', 
    type: 'numerical', 
  },
  'min_tcp_pkts': { 
    description: 'Minimum number of TCP packets',
    type: 'numerical', 
  },
  'max_tcp_pkts': { 
    description: 'Maximum number of TCP packets', 
    type: 'numerical', 
  },
  'entropy_tcp_pkts': { 
    description: 'Entropy of number of TCP packets', 
    type: 'numerical', 
  },
  'mean_tcp_len': { 
    description: 'Average length of TCP packets', 
    type: 'numerical', 
  },
  'std_tcp_len': { 
    description: 'Standard deviation of length of TCP packets',
    type: 'numerical', 
  },
  'min_tcp_len': { 
    description: 'Minimum length of TCP packets', 
    type: 'numerical', 
  },
  'max_tcp_len': { 
    description: 'Maximum length of TCP packets', 
    type: 'numerical', 
  },
  'entropy_tcp_len': { 
    description: 'Entropy of length of TCP packets', 
    type: 'numerical', 
  },
  'ssl.tls_version': { 
    description: 'TLS version',
    type: 'categorical', 
  },
  'malware': { 
    description: 'Label (0 means normal traffic and 1 means malware traffic)', // output's label
    type: 'categorical', 
  },
};

const AC_FEATURES_DESCRIPTIONS = {
  'session_time': { 
    description: 'Total time wherein a user interacts with apps', 
    type: 'numerical', 
  },
  '%tcp_protocol': { 
    description: 'Percentage of TCP traffic', 
    type: 'numerical', 
  },
  '%udp_protocol': { 
    description: 'Percentage of UDP traffic', 
    type: 'numerical', 
  },
  'ul_data_volume': { 
    description: 'Uplink data volume in bytes', 
    type: 'numerical', 
  },
  'max_ul_volume': { 
    description: 'Maximum of uplink data volume', 
    type: 'numerical', 
  },
  'min_ul_volume': { 
    description: 'Minimum of uplink data volume', 
    type: 'numerical', 
  },
  'avg_ul_volume': { 
    description: 'Average of uplink data volume', 
    type: 'numerical', 
  },
  'std_ul_volume': { 
    description: 'Standard deviation of uplink data volume', 
    type: 'numerical', 
  },
  '%ul_volume': { 
    description: 'Percentage of uplink data volume', 
    type: 'numerical', 
  },
  'dl_data_volume': { 
    description: 'Downlink data volume in bytes', 
    type: 'numerical', 
  },
  'max_dl_volume': { 
    description: 'Maximum of downlink data volume', 
    type: 'numerical', 
  },
  'min_dl_volume': { 
    description: 'Minimum of downlink data volume', 
    type: 'numerical',
  },
  'avg_dl_volume': { 
    description: 'Average of downlink data volume', 
    type: 'numerical', 
  },
  'std_dl_volume': { 
    description: 'Standard deviation of downlink data volume', 
    type: 'numerical', 
  },
  '%dl_volume': { 
    description: 'Percentage of downlink data volume', 
    type: 'numerical', 
  },
  'nb_uplink_packet': { 
    description: 'Number of uplink packets', 
    type: 'numerical', 
  },
  'nb_downlink_packet': { 
    description: 'Number of downlink packets', 
    type: 'numerical', 
  },
  'ul_packet': { 
    description: 'Percentage of uplink packets', 
    type: 'numerical', 
  },
  'dl_packet': { 
    description: 'Percentage of downlink packets', 
    type: 'numerical', 
  },
  'kB/s': { 
    description: 'Number of kB per second', 
    type: 'numerical', 
  },
  'nb_packet/s': { 
    description: 'Number of packets per second', 
    type: 'numerical', 
  },
  'output': { 
    description: 'Label (0 means Web, 1 means Interaction and 2 means Video)', // output's label
    type: 'categorical', 
  },
};

const FORM_LAYOUT = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

const BOX_STYLE = {
  padding: '10px 0',
  border: '1px solid black',
};

// BuildACPage.js
const AI_MODEL_TYPES = [
  "Neural Network",
  "XGBoost",
  "LightGBM",
];

// ModelComparisonPage.js
const CRITERIA_LIST = [
  "Build Configuration",
  "Model Performance",
  "Confusion Matrix",
];

const TABLE_BUILD_CONFIGS = [
  {
    title: 'Parameter',
    dataIndex: 'parameter',
    key: 'parameter',
  },
  {
    title: 'Value',
    dataIndex: 'value',
    key: 'value',
  },
];

const AD_COLUMNS_PERF_STATS = [
  {
    title: 'Metric',
    dataIndex: 'metric',
    key: 'metric',
  },
  {
    title: 'Normal traffic',
    dataIndex: 'class0',
    key: 'class0',
  },
  {
    title: 'Malware traffic',
    dataIndex: 'class1',
    key: 'class1',
  },
];

const AC_COLUMNS_PERF_STATS = [
  {
    title: 'Metric',
    dataIndex: 'metric',
    key: 'metric',
  },
  {
    title: 'Web',
    dataIndex: 'class0',
    key: 'class0',
  },
  {
    title: 'Interactive',
    dataIndex: 'class1',
    key: 'class1',
  },
  {
    title: 'Video',
    dataIndex: 'class2',
    key: 'class2',
  },
];

const ATTACK_OPTIONS = 
  [
    {
      value: 'gan',
      label: 'GAN-driven data poisoning',
    },
    {
      value: 'rsl',
      label: 'Random swapping labels',
    },
    {
      value: 'tlf',
      label: 'Target labels flipping',
    },
  ];

// Build.js
const FEATURES_OPTIONS = [
  "Raw Features",
  "Top 10 Important Features",
  "Top 20 Important Features"
];

// DatasetPage.js
const BIN_CHOICES = ['square-root', 'sturges', 'scott', 'freedman-diaconis']; 

const DATASET_TABLE_STATS = [
  {
    title: 'Feature',
    dataIndex: 'feature',
    key: 'feature',
  },
  {
    title: 'Unique Values',
    dataIndex: 'unique',
    key: 'unique',
  },
  {
    title: 'Missing Values',
    dataIndex: 'missing',
    key: 'missing',
  },
  {
    title: 'Mean',
    dataIndex: 'mean',
    key: 'mean',
  },
  {
    title: 'Standard Deviation',
    dataIndex: 'stdDev',
    key: 'stdDev',
  },
  {
    title: 'Median',
    dataIndex: 'median',
    key: 'median',
  },
  {
    title: 'Min',
    dataIndex: 'min',
    key: 'min',
  },
  {
    title: 'Max',
    dataIndex: 'max',
    key: 'max',
  },
];

const DATASET_MENU_ITEMS = [ 
  {
    label: 'Data',
    key: 'data',
    link: "#data",
  },
  {
    label: 'Feature Descriptions',
    key: 'feature_descriptions',
    link: "#feature_descriptions",
  },
  {
    label: 'Histogram Plot',
    key: 'histogram_plot',
    link: "#histogram_plot",
  },
  {
    label: 'Scatter Plot',
    key: 'scatter_plot',
    link: "#scatter_plot",
  },
  {
    label: 'Bar Plot',
    key: 'bar_plot',
    link: "#bar_plot",
  },
  {
    label: 'Heatmap Plot',
    key: 'heatmap_plot',
    link: "#heatmap_plot",
  },
];

// AccountabilityMetricsPage.js
const COLUMNS_CURRENTNESS_METRICS = [
  {
    title: 'XAI Method',
    dataIndex: 'method',
    key: 'method',
  },
  {
    title: 'Score',
    dataIndex: 'score',
    key: 'score',
  },
];

const ACC_METRICS_MENU_ITEMS = [
  {
    label: 'Model Performance',
    key: 'performance',
    link: "#performance",
  },
  {
    label: 'Confusion Matrix',
    key: 'confusion_matrix',
    link: "#confusion_matrix",
  },
  {
    label: 'Classification Plot',
    key: 'classification_plot',
    link: "#classification_plot",
  },
  {
    label: 'Precision Plot',
    key: 'precision_plot',
    link: "#precision_plot",
  },
  {
    label: 'Currentness Metric',
    key: 'currentness',
    link: "#currentness",
  },
];

// ResilienceMetricsPage.js
const RES_METRICS_MENU_ITEMS = [ 
  {
    label: 'Impact Metric',
    key: 'impact',
    link: "#impact",
  },
];

const HEADER_ACCURACY_STATS = ["precision", "recall", "f1score", "support"];

// XAIShapPage.js 
const SHAP_URL = `${SERVER_URL}/api/xai/shap`;

const COLUMNS_TOP_FEATURES = [
  {
    title: 'ID',
    dataIndex: 'key',
    key: 'key',
    sorter: (a, b) => a.key - b.key,
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
];

const XAI_SLIDER_MARKS = {
  1: '1',
  5: '5',
  10: '10',
  15: '15',
  20: '20',
  25: '25',
  30: '30',
};

const AD_OUTPUT_LABELS = ["Normal traffic", "Malware traffic"];
const AC_OUTPUT_LABELS = ["Web", "Interactive", "Video"];

// XAILimePage.js 
const LIME_URL = `${SERVER_URL}/api/xai/lime`;

const COLUMNS_TABLE_PROBS = [
  {
    title: 'Label',
    dataIndex: 'label',
    key: 'label'
  },
  {
    title: 'Probability',
    dataIndex: 'probability',
    key: 'probability'
  }
];

// AttacksPage.js
const ATTACKS_SLIDER_MARKS = {
  0: '0',
  10: '10',
  20: '20',
  30: '30',
  40: '40',
  50: '50',
  60: '60',
  70: '70',
  80: '80',
  90: '90',
  100: '100',
};

const AD_CLASS_MAPPING = {
  0: 'Normal traffic',
  1: 'Malware traffic'
};

const AC_CLASS_MAPPING = {
  1: 'Web',
  2: 'Interactive',
  3: 'Video'
};

const COLUMNS_ALL_FEATURES = [
  {
    title: 'ID',
    dataIndex: 'key',
    key: 'key',
    sorter: (a, b) => a.key - b.key,
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
  },
];

const LABEL_COLORS_AC = {
  "Web": '#0693e3',
  "Interactive": '#EB144C',
  "Video": '#ffd700'
};

const LABEL_MAPPING_AC = {
  "1": { label: "Web" },
  "2": { label: "Interactive" },
  "3": { label: "Video" }
};

const LABEL_COLORS_AD = {
  "Normal traffic": '#0693e3',
  "Malware traffic": '#EB144C', 
}

const LABEL_MAPPING_AD = {
  "0": { label: "Normal traffic" },
  "1": { label: "Malware traffic" }
};

module.exports = {
  MENU_OPTIONS,
  FORM_LAYOUT, BOX_STYLE,
  AI_MODEL_TYPES,
  SERVER_HOST, SERVER_PORT, SERVER_URL,
  AD_FEATURES_DESCRIPTIONS, FEATURES_OPTIONS,
  AC_FEATURES_DESCRIPTIONS,
  CRITERIA_LIST, TABLE_BUILD_CONFIGS, AC_COLUMNS_PERF_STATS, AD_COLUMNS_PERF_STATS,  
  ATTACK_OPTIONS,
  BIN_CHOICES, DATASET_TABLE_STATS, DATASET_MENU_ITEMS,
  COLUMNS_CURRENTNESS_METRICS, ACC_METRICS_MENU_ITEMS,
  RES_METRICS_MENU_ITEMS, HEADER_ACCURACY_STATS,
  SHAP_URL, COLUMNS_TOP_FEATURES, XAI_SLIDER_MARKS,
  AD_OUTPUT_LABELS, AC_OUTPUT_LABELS,
  LIME_URL, COLUMNS_TABLE_PROBS,
  ATTACKS_SLIDER_MARKS, AD_CLASS_MAPPING, AC_CLASS_MAPPING,
  COLUMNS_ALL_FEATURES,
  LABEL_COLORS_AC, LABEL_COLORS_AD, LABEL_MAPPING_AC, LABEL_MAPPING_AD
};
