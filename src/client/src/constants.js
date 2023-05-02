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

module.exports = {
  SERVER_HOST,
  SERVER_PORT,
  SERVER_URL,
  FEATURES_DESCRIPTIONS,
};
