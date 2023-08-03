const SERVER_HOST = "localhost";
const SERVER_PORT = 31057;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

const FEATURES_DESCRIPTIONS = {
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

const COLUMNS_PERF_STATS = [
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

// XAILimePage.js 
const LIME_URL = `${SERVER_URL}/api/xai/lime`;

module.exports = {
  FORM_LAYOUT, BOX_STYLE,
  SERVER_HOST, SERVER_PORT, SERVER_URL,
  FEATURES_DESCRIPTIONS, FEATURES_OPTIONS,
  CRITERIA_LIST, TABLE_BUILD_CONFIGS, COLUMNS_PERF_STATS, 
  ATTACK_OPTIONS,
  BIN_CHOICES, DATASET_TABLE_STATS, DATASET_MENU_ITEMS,
  COLUMNS_CURRENTNESS_METRICS, ACC_METRICS_MENU_ITEMS,
  RES_METRICS_MENU_ITEMS, HEADER_ACCURACY_STATS,
  SHAP_URL, COLUMNS_TOP_FEATURES, LIME_URL
};
