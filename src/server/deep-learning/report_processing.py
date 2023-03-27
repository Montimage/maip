import os

import numpy as np
import pandas as pd

def reportProcessing(report_path):
    if not os.path.exists(report_path):
        print("Error: The report does not exist: " + str(report_path))
        return {}
    # Open the CSV file using the open() function
    securityEvents = []
    tcpEvents = []
    tlsEvents = []
    ipEvents = []
    with open(report_path, 'r') as report:
        for line in report:
            if line.startswith("10,"):
                # This is a security report
                securityEvents.append(line)
            elif line.startswith("1000,"):
                # This is an event report
                line_array = line.strip().split(',')
                eventType = str(line_array[4])
                if eventType == '"tcp-event"':
                    # This is a tcp-event report
                    tcpEvents.append(line_array)
                elif eventType == '"tls-event"':
                    # This is a tls-event report
                    tlsEvents.append(line_array)
                elif eventType == '"ipv4-event"' or eventType == '"ipv6-event"':
                    ipEvents.append(line_array)
                else:
                    print("warning: dropped a line - unhandled event type: " + eventType)
                    print(line_array)
            else:
                print("warning: dropped a line - unhandled report type: " + str(line))
    tcpNPArray = np.array(tcpEvents)
    tcpDataFrame = pd.DataFrame(tcpNPArray)

    ipNPArray = np.array(ipEvents)
    ipDataFrame = pd.DataFrame(ipNPArray)

    tlsNPArray = np.array(tlsEvents)
    tlsDataFrame = pd.DataFrame(tlsNPArray)
    return securityEvents, tcpDataFrame, ipDataFrame, tlsDataFrame

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print('Invalid inputs')
        print('python report_processing.py <report_csv_path>')
    else:
        report_csv_path = sys.argv[1]
        securityEvents, tcpDataFrame, ipDataFrame, tlsDataFrame = reportProcessing(report_csv_path)
        # print("securityEvents:")
        # print(securityEvents)
        print("tcpDataFrame:")
        print(tcpDataFrame)
        print("ipDataFrame:")
        print(ipDataFrame)
        print("tlsDataFrame:")
        print(tlsDataFrame)