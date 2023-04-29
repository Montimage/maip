const SERVER_HOST = "localhost";
const SERVER_PORT = 31057;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

const FEATURES_DESCRIPTIONS = {
  'ip.session_id': 'Session ID', // don't use
  'meta.direction': 'Flow direction (0 means uplink and 1 means downlink)', // don't use
  'ip.pkts_per_flow': 'Total number of IP packets', 
  'duration': 'Flow duration', 
  'ip.header_len': 'Total length of IP header',
  'ip.payload_len': 'Total length of IP payload', 
  'ip.avg_bytes_tot_len': 'Average of total length of IP header', 
  'time_between_pkts_sum': 'Sum time between two flows',
  'time_between_pkts_avg': 'Average time between two flows', 
  'time_between_pkts_max': 'Maximum time between two flows',
  'time_between_pkts_min': 'Minimum time between two flows', 
  'time_between_pkts_std': 'Standard deviation time two flows', 
  '(-0.001, 50.0]': 'Sequence of Packet Time (STP) of bin 1',
  '(50.0, 100.0]': 'Sequence of Packet Time (STP) of bin 2', 
  '(100.0, 150.0]': 'Sequence of Packet Time (STP) of bin 3', 
  '(150.0, 200.0]': 'Sequence of Packet Time (STP) of bin 4', 
  '(200.0, 250.0]': 'Sequence of Packet Time (STP) of bin 5',
  '(250.0, 300.0]': 'Sequence of Packet Time (STP) of bin 6', 
  '(300.0, 350.0]': 'Sequence of Packet Time (STP) of bin 7', 
  '(350.0, 400.0]': 'Sequence of Packet Time (STP) of bin 8', 
  '(400.0, 450.0]': 'Sequence of Packet Time (STP) of bin 9',
  '(450.0, 500.0]': 'Sequence of Packet Time (STP) of bin 10', 
  '(500.0, 550.0]': 'Sequence of Packet Time (STP) of bin 11', 
  'tcp_pkts_per_flow': 'Total number of TCP packets', 
  'pkts_rate': 'Number of packets per second',
  'tcp_bytes_per_flow': 'Total number of bytes of TCP packets', 
  'byte_rate': 'Number of bytes per second', 
  'tcp.tcp_session_payload_up_len': 'Upload ratio',
  'tcp.tcp_session_payload_down_len': 'Download ratio', 
  '(-0.001, 150.0]': 'Sequence of Packet Length (STL) of bin 1',
  '(150.0, 300.0]': 'Sequence of Packet Length (STL) of bin 2', 
  '(300.0, 450.0]': 'Sequence of Packet Length (STL) of bin 3', 
  '(450.0, 600.0]': 'Sequence of Packet Length (STL) of bin 4', 
  '(600.0, 750.0]': 'Sequence of Packet Length (STL) of bin 5',
  '(750.0, 900.0]': 'Sequence of Packet Length (STL) of bin 6', 
  '(900.0, 1050.0]': 'Sequence of Packet Length (STL) of bin 7', 
  '(1050.0, 1200.0]': 'Sequence of Packet Length (STL) of bin 8',
  '(1200.0, 1350.0]': 'Sequence of Packet Length (STL) of bin 9', 
  '(1350.0, 1500.0]': 'Sequence of Packet Length (STL) of bin 10', 
  '(1500.0, 10000.0]': 'Sequence of Packet Length (STL) of bin 11', 
  'tcp.fin': 'Number of packets with flag FIN',
  'tcp.syn': 'Number of packets with flag SYN', 
  'tcp.rst': 'Number of packets with flag RST', 
  'tcp.psh': 'Number of packets with flag PSH', 
  'tcp.ack': 'Number of packets with flag ACK', 
  'tcp.urg': 'Number of packets with flag URG', 
  'sport_g': 'Sum of ephemeral source ports (port number > 1024)', 
  'sport_le': 'Sum of non-ephemeral source ports (port number <= 1024)', 
  'dport_g': 'Sum of ephemeral destination ports (port number > 1024)',
  'dport_le': 'Sum of non-ephemeral destination ports (port number with <= 1024)', 
  'mean_tcp_pkts': 'Average number of TCP packets', 
  'std_tcp_pkts': 'Standard deviation of number of TCP packets', 
  'min_tcp_pkts': 'Minimum number of TCP packets',
  'max_tcp_pkts': 'Maximum number of TCP packets', 
  'entropy_tcp_pkts': 'Entropy of number of TCP packets', 
  'mean_tcp_len': 'Average length of TCP packets', 
  'std_tcp_len': 'Standard deviation of length of TCP packets',
  'min_tcp_len': 'Minimum length of TCP packets', 
  'max_tcp_len': 'Maximum length of TCP packets', 
  'entropy_tcp_len': 'Entropy of length of TCP packets', 
  'ssl.tls_version': 'TLS version',
  'malware': 'Label (0 means normal traffic and 1 means malware traffic)', // output's label
};

/* const featureNames = FEATURES_DESCRIPTIONS.map(feature => feature.name);
const description = FEATURES_DESCRIPTIONS['ip.pkts_per_flow']; */

module.exports = {
  SERVER_HOST,
  SERVER_PORT,
  SERVER_URL,
  FEATURES_DESCRIPTIONS,
};
