AD_STR_FEATURES = "ip.session_id,meta.direction,ip.pkts_per_flow,duration,ip.header_len,ip.payload_len,ip.avg_bytes_tot_len,time_between_pkts_sum,time_between_pkts_avg,time_between_pkts_max,time_between_pkts_min,time_between_pkts_std,\"(-0.001, 50.0]\",\"(50.0, 100.0]\",\"(100.0, 150.0]\",\"(150.0, 200.0]\",\"(200.0, 250.0]\",\"(250.0, 300.0]\",\"(300.0, 350.0]\",\"(350.0, 400.0]\",\"(400.0, 450.0]\",\"(450.0, 500.0]\",\"(500.0, 550.0]\",tcp_pkts_per_flow,pkts_rate,tcp_bytes_per_flow,byte_rate,tcp.tcp_session_payload_up_len,tcp.tcp_session_payload_down_len,\"(-0.001, 150.0]\",\"(150.0, 300.0]\",\"(300.0, 450.0]\",\"(450.0, 600.0]\",\"(600.0, 750.0]\",\"(750.0, 900.0]\",\"(900.0, 1050.0]\",\"(1050.0, 1200.0]\",\"(1200.0, 1350.0]\",\"(1350.0, 1500.0]\",\"(1500.0, 10000.0]\",tcp.fin,tcp.syn,tcp.rst,tcp.psh,tcp.ack,tcp.urg,sport_g,sport_le,dport_g,dport_le,mean_tcp_pkts,std_tcp_pkts,min_tcp_pkts,max_tcp_pkts,entropy_tcp_pkts,mean_tcp_len,std_tcp_len,min_tcp_len,max_tcp_len,entropy_tcp_len,ssl.tls_version,malware\n"

AC_STR_FEATURES = "session_time,%tcp_protocol,%udp_protocol,ul_data_volume,max_ul_volume,min_ul_volume,avg_ul_volume,std_ul_volume,%ul_volume,dl_data_volume,max_dl_volume,min_dl_volume,avg_dl_volume,std_dl_volume,%dl_volume,nb_uplink_packet,nb_downlink_packet,ul_packet,dl_packet,kB/s,nb_packet/s,output\n"

AD_FEATURES = ['ip.session_id', 'meta.direction', 'ip', 'ip.pkts_per_flow', 'duration', 'ip.header_len',
            'ip.payload_len', 'ip.avg_bytes_tot_len', 'time_between_pkts_sum',
            'time_between_pkts_avg', 'time_between_pkts_max',
            'time_between_pkts_min', 'time_between_pkts_std', '(-0.001, 50.0]',
            '(50.0, 100.0]', '(100.0, 150.0]', '(150.0, 200.0]', '(200.0, 250.0]',
            '(250.0, 300.0]', '(300.0, 350.0]', '(350.0, 400.0]', '(400.0, 450.0]',
            '(450.0, 500.0]', '(500.0, 550.0]', 'tcp_pkts_per_flow', 'pkts_rate',
            'tcp_bytes_per_flow', 'byte_rate', 'tcp.tcp_session_payload_up_len',
            'tcp.tcp_session_payload_down_len', '(-0.001, 150.0]',
            '(150.0, 300.0]', '(300.0, 450.0]', '(450.0, 600.0]', '(600.0, 750.0]',
            '(750.0, 900.0]', '(900.0, 1050.0]', '(1050.0, 1200.0]',
            '(1200.0, 1350.0]', '(1350.0, 1500.0]', '(1500.0, 10000.0]', 'tcp.fin',
            'tcp.syn', 'tcp.rst', 'tcp.psh', 'tcp.ack', 'tcp.urg', 'sport_g', 'sport_le', 'dport_g',
            'dport_le', 'mean_tcp_pkts', 'std_tcp_pkts', 'min_tcp_pkts',
            'max_tcp_pkts', 'entropy_tcp_pkts', 'mean_tcp_len', 'std_tcp_len',
            'min_tcp_len', 'max_tcp_len', 'entropy_tcp_len', 'ssl.tls_version']

AD_FEATURES_OUTPUT = AD_FEATURES + ['malware']

DISCRETE_FEATURES = [
  'ip.pkts_per_flow', 'ip.header_len', 'ip.payload_len',
  '(-0.001, 50.0]', '(50.0, 100.0]', '(100.0, 150.0]', '(150.0, 200.0]',
  '(200.0, 250.0]', '(250.0, 300.0]', '(300.0, 350.0]', '(350.0, 400.0]',
  '(400.0, 450.0]', '(450.0, 500.0]', '(500.0, 550.0]',
  'tcp_pkts_per_flow', 'tcp_bytes_per_flow',
  '(-0.001, 150.0]', '(150.0, 300.0]', '(300.0, 450.0]', '(450.0, 600.0]',
  '(600.0, 750.0]', '(750.0, 900.0]', '(900.0, 1050.0]', '(1050.0, 1200.0]',
  '(1200.0, 1350.0]', '(1350.0, 1500.0]', '(1500.0, 10000.0]',
  'tcp.fin', 'tcp.syn', 'tcp.rst', 'tcp.psh', 'tcp.ack', 'tcp.urg', 'sport_g',
  'sport_le', 'dport_g', 'dport_le', 'mean_tcp_pkts', 'std_tcp_pkts',
  'min_tcp_pkts', 'max_tcp_pkts', 'entropy_tcp_pkts',
  'min_tcp_len', 'max_tcp_len', 'ssl.tls_version', 'entropy_tcp_len',
  'malware'
]

TLS_FEATURES = ["ssl.tls_version",
             "ssl.tls_content_type",
             "ssl.tls_length",
             "ssl.ssl_handshake_type",
             "ip.session_id",
             "meta.direction"]

TCP_FEATURES = ["tcp.src_port",
             "tcp.dest_port",
             "tcp.payload_len",
             "tcp.fin",
             "tcp.syn",
             "tcp.rst",
             "tcp.psh",
             "tcp.ack",
             "tcp.urg",
             "tcp.tcp_session_payload_up_len",
             "tcp.tcp_session_payload_down_len",
             "ip.session_id",
             "meta.direction"]  # if = 0 then its client -> server (Checked with syn=1 ack=0)

IPV4_FEATURES = ["time",
              "ip.version",
              "ip.session_id",
              "meta.direction",
              "ip.first_packet_time",
              "ip.last_packet_time",
              "ip.header_len",
              "ip.tot_len",
              "ip.src",
              "ip.dst"
              ]

IPV6_FEATURES = ["time",
              "ip.version",
              "ip.session_id",
              "meta.direction",
              "ip.first_packet_time",
              "ip.last_packet_time",
              "ip.src",
              "ip.dst"
              ]