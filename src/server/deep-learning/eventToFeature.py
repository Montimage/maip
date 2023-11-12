import sys
import numpy
from pathlib import Path
import pandas as pd
from scipy.stats import entropy
import constants

sys.path.append(sys.path[0] + '/..')


def calculateFeatures(ip_traffic, tcp_traffic, tls_traffic):
    """
    Calculates ML features based on traffic extracted from mmt-probe .csv. Features are calculated per flow and direction
    where direction is identified by mmt-probe. Remark: features are calculated and returned including the direction
    and session id, both columns should be dropped before feeding them into ML model

    :param ip_traffic:
    :param tcp_traffic:
    :param tls_traffic:
    :return: Ip of flows and dataframe with ML features (per flow+direction)
    """

    # print("Extracting features " + str(len(feature_names)))

    # Bins of packet lengths and time between packets based on
    # "MalDetect: A Structure of Encrypted Malware Traffic Detection" by Jiyuan Liu et al.

    bins_len = [0, 150, 300, 450, 600, 750, 900, 1050, 1200, 1350, 1500, 10000]
    bins_time = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550]
    #print("traffic")
    #print(ip_traffic)
    #print(ip_traffic["meta.direction"])
    ## saving unique ips based on ip_traffic
    ips = ip_traffic.groupby(["ip.session_id", "meta.direction"])[["ip.src", "ip.dst"]].apply(
                                                                                        lambda x: list(numpy.unique(x)))
    ips = ips.to_frame().reset_index()
    ips.columns = ["ip.session_id", "meta.direction", "ip"]
    ips["ip.session_id"] = ips["ip.session_id"].astype(int)
    #print("Features (IPS):")
    #print(ips)
    #print(ips["meta.direction"])
    ips["meta.direction"] = ips["meta.direction"].astype(int)
    ip_traffic.drop(columns=["ip.src", "ip.dst"], inplace=True)

    ip_traffic = ip_traffic.apply(pd.to_numeric)
    tcp_traffic = tcp_traffic.apply(pd.to_numeric)
    tls_traffic = tls_traffic.apply(pd.to_numeric)
    ip_traffic['meta.direction'] = ip_traffic['meta.direction'].astype(int)
    tcp_traffic['meta.direction'] = tcp_traffic['meta.direction'].astype(int)
    tcp_traffic['tcp.src_port'] = tcp_traffic['tcp.src_port'].astype(int)
    tcp_traffic['tcp.dest_port'] = tcp_traffic['tcp.dest_port'].astype(int)
    tls_traffic['meta.direction'] = tls_traffic['meta.direction'].astype(int)

    ## deleting tcp and tls samples that have ip.session_id that was not present in ip_traffic (means that ip.session_id is wrongly assigned?)
    ids_tcp = tcp_traffic["ip.session_id"].unique().tolist()
    ids_ip = ip_traffic["ip.session_id"].unique().tolist()
    ids_tls = tls_traffic["ip.session_id"].unique().tolist()
    diff_tcp = set(ids_tcp) - set(ids_ip)
    diff_tls = set(ids_tls) - set(ids_ip)
    tcp_traffic = tcp_traffic[~tcp_traffic['ip.session_id'].isin(diff_tcp)]
    tls_traffic = tls_traffic[~tls_traffic['ip.session_id'].isin(diff_tls)]

    ip_traffic.set_index(["ip.session_id", "meta.direction"], inplace=True)
    tcp_traffic.set_index(["ip.session_id", "meta.direction"], inplace=True)

    ## Overall counters
    # total_traffic_nb = any_traffic['time'].count()  ## total number of any packets in csv
    # ip_total_nb = ip_traffic.groupby("ip.session_id")['time'].count().sum()  ## total number of ip packets in csv
    ip_pkts_per_flow = ip_traffic.groupby(["ip.session_id", "meta.direction"])['time'].count().reset_index().rename(
        columns={"time": "ip.pkts_per_flow"})  ## number of ip packets per session id

    ## Duration of flow: time between first and last received packet in one flow (i.e. in one direction per one session id)
    duration = ip_traffic.groupby(["ip.session_id", "meta.direction"])[
        ['ip.first_packet_time']].min().reset_index().merge(
        ip_traffic.groupby(["ip.session_id", "meta.direction"])[['ip.last_packet_time']].max().reset_index())
    duration['duration'] = duration['ip.last_packet_time'] - duration['ip.first_packet_time']

    features = ip_pkts_per_flow.merge(duration).drop(columns=['ip.first_packet_time', 'ip.last_packet_time'])
    duration = duration.iloc[0:0]
    ip_total_per_session = ip_pkts_per_flow.iloc[0:0]

    #####
    ip_header_len = ip_traffic.groupby(["ip.session_id", "meta.direction"])["ip.header_len"].sum().reset_index()
    features = features.merge(ip_header_len)

    ip_tot_len = ip_traffic.groupby(["ip.session_id", "meta.direction"])["ip.tot_len"].sum().reset_index().rename(
        columns={"ip.tot_len": "ip.bytes_tot_len"})  ### ?? TODO
    ip_tot_len["ip.payload_len"] = ip_tot_len["ip.bytes_tot_len"] - ip_header_len["ip.header_len"]
    ip_tot_len = ip_tot_len.drop(columns='ip.bytes_tot_len')
    features = features.merge(ip_tot_len)
    ip_header_len = ip_header_len.iloc[0:0]
    ip_tot_len = ip_tot_len.iloc[0:0]

    ip_avg_len = ip_traffic.groupby(["ip.session_id"])["ip.tot_len"].mean().reset_index().rename(
        columns={"ip.tot_len": "ip.avg_bytes_tot_len"})
    features = features.merge(ip_avg_len)
    ip_avg_len = ip_avg_len.iloc[0:0]

    # Packet Time
    ip_traffic['delta'] = (ip_traffic['time'] - ip_traffic['time'].shift()).fillna(0)
    ip_traffic['delta'] = ip_traffic['delta'] * 1000  # seconds to ms
    # df = ip_traffic.copy()
    # df = ip_traffic[['ip.session_id', 'meta.direction', 'delta']].copy()
    df = ip_traffic[['delta']].copy()
    #####

    #print("Times between packets")
    time_between_pkts_sum = df.groupby(['ip.session_id', 'meta.direction'])['delta'].sum().reset_index().rename(
        columns={"delta": "time_between_pkts_sum"})
    time_between_pkts_avg = df.groupby(['ip.session_id', 'meta.direction'])['delta'].mean().reset_index().rename(
        columns={"delta": "time_between_pkts_avg"})
    time_between_pkts_max = df.groupby(['ip.session_id', 'meta.direction'])['delta'].max().reset_index().rename(
        columns={"delta": "time_between_pkts_max"})
    time_between_pkts_min = df.groupby(['ip.session_id', 'meta.direction'])['delta'].min().reset_index().rename(
        columns={"delta": "time_between_pkts_min"})
    time_between_pkts_std = df.groupby(['ip.session_id', 'meta.direction'])['delta'].std().reset_index().rename(
        columns={"delta": "time_between_pkts_std"})

    features = features.merge(time_between_pkts_sum)
    features = features.merge(time_between_pkts_avg)
    features = features.merge(time_between_pkts_max)
    features = features.merge(time_between_pkts_min)
    features = features.merge(time_between_pkts_std)

    time_between_pkts_sum = time_between_pkts_sum[0:0]
    time_between_pkts_avg = time_between_pkts_avg[0:0]
    time_between_pkts_max = time_between_pkts_max[0:0]
    time_between_pkts_min = time_between_pkts_min[0:0]
    time_between_pkts_std = time_between_pkts_std[0:0]

    #print("SPTime Sequence")
    time = df.groupby(['ip.session_id', 'meta.direction'])['delta'].value_counts(bins=bins_time, sort=False).to_frame()
    df = df.iloc[0:0]
    time = time.rename(columns={'delta': 'county'}).reset_index()
    sptime = time.pivot_table(index=['ip.session_id', 'meta.direction'], columns='delta',
                              values='county')  # ,fill_value=0)
    sptime.columns = sptime.columns.astype(str)
    sptime = sptime.reset_index()

    features = features.merge(sptime)
    time = time.iloc[0:0]
    sptime = sptime.iloc[0:0]

    if not tcp_traffic.empty:
        #print("TCP features")

        # TCP packets number per flow
        tcp_pkts_per_flow = tcp_traffic.groupby(["ip.session_id", "meta.direction"])[
            ['tcp.src_port']].count().reset_index().rename(
            columns={
                "tcp.src_port": "tcp_pkts_per_flow"})  ## number of tcp packets per flow, and per direction (0 = client->server)

        features = pd.merge(features, tcp_pkts_per_flow, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])

        features['pkts_rate'] = features['tcp_pkts_per_flow'] / features['duration']

        tcp_pkts_per_flow = tcp_pkts_per_flow.iloc[0:0]

        # # TCP bytes sum per flow
        tcp_bytes_per_flow = tcp_traffic.groupby(["ip.session_id", "meta.direction"])[
            ['tcp.payload_len']].sum().reset_index().rename(
            columns={
                "tcp.payload_len": "tcp_bytes_per_flow"})  ## sum of tcp bytes per flow per direction (0 = client->server)

        features = pd.merge(features, tcp_bytes_per_flow, how='outer', on=["ip.session_id", "meta.direction"])

        features['byte_rate'] = features['tcp_pkts_per_flow'] / features['duration']
        tcp_bytes_per_flow = tcp_bytes_per_flow.iloc[0:0]

        features = features.merge(tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
                                      'tcp.tcp_session_payload_up_len'].count().reset_index(), how='outer', on=["ip.session_id", "meta.direction"])
        features = features.merge(tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
                                      'tcp.tcp_session_payload_down_len'].count().reset_index(), how='outer', on=["ip.session_id", "meta.direction"])

        ## Sequence: Packet length and time sequences counted in bins, each bin stored as separate column
        # Packet length

        #print("SPL Sequence")
        # print("tcp_traffic - number of columns: " + str(len(tcp_traffic.columns)))
        # print("tcp_traffic - number of rows: " + str(len(tcp_traffic.index)))
        # tcp_traffic.to_csv('tcp_traffic.csv')
        packet_len = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])['tcp.payload_len'].value_counts(bins=bins_len,
                                                                                                       sort=False).to_frame()
        packet_len = packet_len.rename(columns={'tcp.payload_len': 'county'}).reset_index()

        # pivot_table to get columns out of segregated and divided packet lengths
        spl = packet_len.pivot_table(index=['ip.session_id', 'meta.direction'], columns='tcp.payload_len',
                              values='county')  # ,fill_value=0)
        packet_len = packet_len.iloc[0:0]
        spl.columns = spl.columns.astype(str)
        spl = spl.reset_index()

        features = pd.merge(features, spl, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        spl = spl.iloc[0:0]

        #print("Flags")
        # Flags: counts the number of turned on flags for each session and direction
        flag_list = ['tcp.fin', 'tcp.syn', 'tcp.rst', 'tcp.psh', 'tcp.ack', 'tcp.urg']
        tcp_flags_cnt_flow = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[flag_list].aggregate(
            lambda g: g.eq(
                1.0).sum()).reset_index()  # .drop(columns=['tcp.src_port', 'tcp.dest_port', 'tcp.payload_len','tcp.tcp_session_payload_up_len', 'tcp.tcp_session_payload_down_len'])

        features = pd.merge(features, tcp_flags_cnt_flow, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        tcp_flags_cnt_flow = tcp_flags_cnt_flow.iloc[0:0]

        ## Source and destination ports greater/less or equal to 1024 ( > ephemeral ports)
        # src ports
        #print("Ports")
        # tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[['tcp.src_port']].apply(lambda x: len(x[x>3])/len(x) )
        sports = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[['tcp.src_port']].apply(
            lambda x: (x > 1024).sum()).reset_index().rename(columns={'tcp.src_port': 'sport_g'}).merge(
            tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[['tcp.src_port']].agg(
                lambda x: (x <= 1024).sum()).reset_index().rename(columns={'tcp.src_port': 'sport_le'})
        )

        features = pd.merge(features, sports, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])

        sports = sports.iloc[0:0]

        # dest port
        dports = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[['tcp.dest_port']].apply(
            lambda x: (x > 1024).sum()).reset_index().rename(columns={'tcp.dest_port': 'dport_g'}).merge(
            tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[['tcp.dest_port']].agg(
                lambda x: (x <= 1024).sum()).reset_index().rename(columns={'tcp.dest_port': 'dport_le'})
        )
        features = pd.merge(features, dports, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        dports = dports.iloc[0:0]

        #print("Min/max pkts")

        mean_tcp_pkts = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.src_port'].mean().reset_index().rename(
            columns={"tcp.src_port": "mean_tcp_pkts"})
        std_tcp_pkts = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.src_port'].std().reset_index().rename(
            columns={"tcp.src_port": "std_tcp_pkts"})
        min_tcp_pkts = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.src_port'].min().reset_index().rename(
            columns={"tcp.src_port": "min_tcp_pkts"})
        max_tcp_pkts = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.src_port'].max().reset_index().rename(
            columns={"tcp.src_port": "max_tcp_pkts"})

        features = features.merge(mean_tcp_pkts, how='outer', on=["ip.session_id", "meta.direction"])
        features = features.merge(std_tcp_pkts, how='outer', on=["ip.session_id", "meta.direction"])
        features = features.merge(min_tcp_pkts, how='outer', on=["ip.session_id", "meta.direction"])
        features = features.merge(max_tcp_pkts, how='outer', on=["ip.session_id", "meta.direction"])
        mean_tcp_pkts = mean_tcp_pkts[0:0]
        std_tcp_pkts = std_tcp_pkts[0:0]
        min_tcp_pkts = min_tcp_pkts[0:0]
        max_tcp_pkts = max_tcp_pkts[0:0]

        #print("Entropy pkts")
        entropy_tcp_pkts = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])['tcp.src_port'].apply(
            lambda x: entropy(
                x.value_counts(), base=2)).to_frame().reset_index().rename(columns={'tcp.src_port': 'entropy_tcp_pkts'})
        features = pd.merge(features, entropy_tcp_pkts, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])

        entropy_tcp_pkts = entropy_tcp_pkts.iloc[0:0]

        # Min, max, std and mean of packet length in each session+direction
        #print("Min/max pkts")
        mean_tcp_len = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.payload_len'].mean().reset_index().rename(
            columns={"tcp.payload_len": "mean_tcp_len"})
        std_tcp_len = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.payload_len'].std().reset_index().rename(
            columns={"tcp.payload_len": "std_tcp_len"})
        min_tcp_len = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.payload_len'].min().reset_index().rename(
            columns={"tcp.payload_len": "min_tcp_len"})
        max_tcp_len = tcp_traffic.groupby(['ip.session_id', 'meta.direction'])[
            'tcp.payload_len'].max().reset_index().rename(
            columns={"tcp.payload_len": "max_tcp_len"})
        features = features.merge(mean_tcp_len, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        features = features.merge(std_tcp_len, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        features = features.merge(min_tcp_len, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        features = features.merge(max_tcp_len, how='outer', left_on=["ip.session_id", "meta.direction"],
                            right_on=["ip.session_id", "meta.direction"])
        mean_tcp_len = mean_tcp_len[0:0]
        std_tcp_len = std_tcp_len[0:0]
        min_tcp_len = min_tcp_len[0:0]
        max_tcp_len = max_tcp_len[0:0]

        #print("Entropy len")

        #TODO: if MMT-probe will be able to provide any other attributes of TLS traffic they should be processed here
        if not tls_traffic.empty:
            #print("TLS features")
            # TLS packets number per flow
            tls_pkts_per_flow = tls_traffic.groupby(["ip.session_id", "meta.direction"])[
                ['ssl.tls_version']].count().reset_index().rename(
                columns={"time": "tls_pkts_per_flow"})

            features = pd.merge(features, tls_pkts_per_flow, how='outer', on=["ip.session_id", "meta.direction"])
            tls_pkts_per_flow = tls_pkts_per_flow.iloc[0:0]

    #Features should have always same columns (as predefined), hence in case some features were not calculated due to
    # the lack of data (e.g. no TCP packets) the columns should be added anyway filled with 0 values
    features = features.reindex(features.columns.union(constants.AD_FEATURES[3:], sort=False), axis=1, fill_value=0)

    # ips = features['ip.session_id', 'meta.direction']
    # features.drop(columns=['ip.session_id', 'meta.direction'], inplace=True)
    # features.reset_index(inplace=True)
    # features.drop(columns=['delta'], inplace=True)

    #print("Created {} feature samples".format(features.shape[0]))

    return ips, features

def readMMTReportFile(csv_path):
    """
    Reads .csv report from MMT-probe, since the columns in .csv can have variable length it takes the maximal possible
    length.

    :param csv_path: path to the .csv mmt probe report
    :return: DataFrame with all data from .csv
    """
    with open(csv_path, 'r') as temp:
        col_count = [len(l.split(",")) for l in temp.readlines()]
        # print("col_count")
        # print(col_count)
        col_names = [i for i in range(0, max(col_count))]
        types_dict = {'0': int, '1': int, '2': "string", '3': 'float', '4': 'string'}
        types_dict.update({col: str for col in col_names if col not in types_dict})
        df = pd.read_csv(csv_path, header=None, delimiter=",", names=col_names, dtype=types_dict)
        #print("Read {} lines".format(df.shape[0]))
        return df


def extractReport(df, report_name):
    """
    Function extracting a proper dataframe with mmt-probe attributes about particular report (based on report_name).

    :param df: DataFrame with all data from .csv
    :param report_name: report to extract - possible values are in accordance with events predefined at the beginning of
    the script : (currently) tls_event, tcp_event, ipv4_event, ipv6_event
    :return:
    """
    new_df = df[df[4] == report_name].copy()
    # if report_name == "any-event":
    #     if not new_df.empty:
    #         new_df.columns = any_event  ##colnames from mmt-probe conf file
    #     else:
    #         new_df = pd.DataFrame(columns=any_event)
    if report_name == "ipv4-event":
        new_df.drop(columns=[0, 1, 2, 4],
                    inplace=True)  # ignoring 3 first columns (report id, ?, filepath) and 5th (report name)
        new_df.dropna(axis=1, inplace=True)
        # print(new_df)
        if not new_df.empty:
            new_df.columns = constants.IPV4_FEATURES  ##colnames from mmt-probe conf file
        else:
            new_df = pd.DataFrame(columns=constants.IPV4_FEATURES)

    elif report_name == "ipv6-event":
        new_df.drop(columns=[0, 1, 2, 4],
                    inplace=True)  # ignoring 3 first columns (report id, ?, filepath) and 5th (report name)
        new_df.dropna(axis=1, inplace=True)
        # print(new_df)
        if not new_df.empty:
            new_df.columns = constants.IPV6_FEATURES  ##colnames from mmt-probe conf file
        else:
            new_df = pd.DataFrame(columns=constants.IPV6_FEATURES)

    else:
        new_df.drop(columns=[0, 1, 2, 3, 4],
                    inplace=True)  # ignoring 3 first columns (report id, ?, time, filepath) and 5th (report name)
        new_df.dropna(axis=1, inplace=True)
        if report_name == "tcp-event":
            if not new_df.empty:
                new_df.columns = constants.TCP_FEATURES  ##colnames from mmt-probe conf file
            else:
                new_df = pd.DataFrame(columns=constants.TCP_FEATURES)
        elif report_name == "tls-event":
            if not new_df.empty:
                new_df.columns = constants.TLS_FEATURES  ##colnames from mmt-probe conf file
            else:
                new_df = pd.DataFrame(columns=constants.TLS_FEATURES)
    return new_df


def readAndExtractEvents(path):
    """
    Reads a .csv from MMT-probe, and extracts particular report into a separate dataframe - ipv4 and ipv6 are treated
    as one ip-event and merged into one dataframe (filled with 0 in case of lack of value)

    :param path: path to .csv created by MMT-probe
    :return: ip_traffic, tcp_traffic, tls_traffic - dataframes consisting of mmt-probe attributes from each of monitored events
    """
    df = readMMTReportFile(path)

    # any_traffic = p1.extractReport("any-event")
    report_parent_path = Path(path).parent.absolute()
    ipv4_traffic = extractReport(df, "ipv4-event")
    ipv6_traffic = extractReport(df, "ipv6-event")
    ip_traffic = ipv4_traffic.append(ipv6_traffic, sort=False)
    ip_traffic = ip_traffic.replace(numpy.nan, 0)
    tcp_traffic = extractReport(df, "tcp-event")
    tls_traffic = extractReport(df, "tls-event")
    security_reports = df[df[0] == "10"].copy()
    # security_reports = security_reports.dropna(axis=1)
    if not security_reports.empty:
        security_reports.to_csv(Path.joinpath(report_parent_path,"security-reports.csv"), mode='a', index=False, header=None)
    df = df[0:0]

    return ip_traffic, tcp_traffic, tls_traffic

def eventsToFeatures(in_csv):
    """
    Based on .csv mmt-probe report extracts the report attributes, and calculates ML features.
    :param in_csv: input .csv report file
    :return: ips, p1_features - Dataframe of calculated ML features per flow and direction and IPs matching the flows
    """
    print(f"Convert from events to features {in_csv}")
    ip_traffic, tcp_traffic, tls_traffic = readAndExtractEvents(in_csv)
    if not ip_traffic.empty:
        print("eventsToFeatures")
        ips, p1_features = calculateFeatures(ip_traffic, tcp_traffic, tls_traffic)
        p1_features = p1_features.fillna(0)
        print("Extracted {} features".format(p1_features.shape[0]))
        return ips, p1_features
    else:
        print("There is no ip traffic")
        return {},{}
