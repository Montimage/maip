/* eslint-disable no-console */
const fs = require('fs');
const {
  PCAP_PATH,
  REPORT_PATH,
  LOG_PATH,
  MMT_PROBE_CONFIG_PATH,
  PCAP_EXTENSIONS,
} = require('../constants');
const {
  createFolder,
  listFiles,
} = require('../utils/file-utils');
const {
  spawnCommand,
  getUniqueId,
  interfaceExist,
} = require('../utils/utils');

/**
 * mmtStatus contains the information of the last analysing session
 * With the session id, the reports and the log of analysing session can be reached.
 */
let mmtStatus = {
  isRunning: false,
  sessionId: null,
  isOnlineMode: false,
  // logFile: null, // can be reached by session id
  startedAt: null,
};

const runOnDataset = (pcapFiles, datasetPath, outputDir, logFilePath, onFinishCallback = null) => {
  console.log(`runOnDataset : ${pcapFiles.length}`);
  if (pcapFiles.length === 0) {
    if (onFinishCallback) onFinishCallback();
  } else {
    const newPcapFiles = [...pcapFiles];
    const currentPcapFile = newPcapFiles.pop();
    const inputPcapFilePath = `${datasetPath}/${currentPcapFile}`;
    spawnCommand('mmt-probe', ['-c', MMT_PROBE_CONFIG_PATH, '-t', inputPcapFilePath, '-X', `file-output.output-dir=${outputDir}`, '-X', `file-output.output-file=${currentPcapFile}.csv`], logFilePath, () => {
      console.log('Finished analysing file: ', currentPcapFile);
      return runOnDataset(newPcapFiles, datasetPath, outputDir, logFilePath, onFinishCallback);
    });
  }
};

/**
 * Start analysing a traffic in given pcap file
 * @param {String} pcapFileName absoluted path of the pcap file
 */
const startMMTOffline = (pcapFileName, callback) => {
  console.log(mmtStatus);
  if (mmtStatus.isRunning) {
    console.warn('An analysing process is on going. Only one process can be run at a time');
    return callback({
      error: 'An analysis process is on going',
    });
  }
  const inputPcapFilePath = PCAP_PATH + pcapFileName;
  if (!fs.existsSync(inputPcapFilePath)) {
    return callback({
      error: `The given pcap file ${pcapFileName} does not exist`,
    });
  }

  const sessionId = `${pcapFileName}-${getUniqueId()}`;
  const outputDir = `${REPORT_PATH}report-${sessionId}/`;
  const logFilePath = `${LOG_PATH + sessionId}.log`;

  return createFolder(outputDir, (ret) => {
    if (ret) {
      mmtStatus = {
        isRunning: true,
        sessionId,
        startedAt: Date.now(),
        isOnlineMode: false,
      };
      spawnCommand('mmt-probe', ['-c', MMT_PROBE_CONFIG_PATH, '-t', inputPcapFilePath, '-X', `file-output.output-dir=${outputDir}`, '-X', `file-output.output-file=${pcapFileName}.csv`], logFilePath, () => {
        mmtStatus.isRunning = false;
      });
    }
    return callback(mmtStatus);
  });
};

/**
 * Start analysing a traffic in given pcap file
 * @param {String} pcapFileName absoluted path of the pcap file
 */
const startMMTForDataset = (datasetName, callback) => {
  console.log(mmtStatus);
  if (mmtStatus.isRunning) {
    console.warn('An analysing process is on going. Only one process can be run at a time');
    return callback({
      error: 'An analysis process is on going',
    });
  }
  const datasetPath = PCAP_PATH + datasetName;
  if (!fs.existsSync(datasetPath)) {
    return callback({
      error: `The given dataset ${datasetName} does not exist`,
    });
  }

  const sessionId = `${datasetName}-${getUniqueId()}`;
  const outputDir = `${REPORT_PATH}report-${sessionId}/`;
  const logFilePath = `${LOG_PATH}${sessionId}.log`;

  return listFiles(datasetPath, PCAP_EXTENSIONS, (pcapFiles) => {
    if (pcapFiles.length === 0) {
      return callback({
        error: `The dataset ${datasetName} is empty`,
      });
    }
    return createFolder(outputDir, (ret) => {
      if (ret) {
        mmtStatus = {
          isRunning: true,
          sessionId,
          isOnlineMode: false,
          startedAt: Date.now(),
        };
        runOnDataset(pcapFiles, datasetPath, outputDir, logFilePath, () => {
          console.log('All pcap files have been analyzed');
          mmtStatus.isRunning = false;
        });
      }
      return callback(mmtStatus);
    });
  });
};

/**
 * Start analysing the traffic from selected network interface
 * @param {String} interface the network interface name on which the mmt will listen
 */
const startMMTOnline = (netInf, callback) => {
  console.log(mmtStatus);
  if (mmtStatus.isRunning) {
    console.warn('An analysing process is on going. Only one process can be run at a time');
    return callback({
      error: 'An analysis process is on going',
    });
  }

  if (!interfaceExist(netInf)) {
    return callback({
      error: `The given interface ${netInf} does not exist`,
    });
  }

  const sessionId = getUniqueId();
  const outputDir = `${REPORT_PATH}report-${sessionId}/`;
  const logFilePath = `${LOG_PATH + sessionId}.log`;
  fs.mkdirSync(outputDir);

  mmtStatus = {
    isRunning: true,
    sessionId,
    isOnlineMode: true,
    startedAt: Date.now(),
  };
  spawnCommand('sudo', ['mmt-probe', '-c', MMT_PROBE_CONFIG_PATH, '-i', netInf, '-X', 'input.mode=ONLINE', '-X', `file-output.output-dir=${outputDir}`, '-X', 'file-output.sample-file=true'], logFilePath, () => {
    mmtStatus.isRunning = false;
  });
  return callback(mmtStatus);
};

/**
 * Stop a running MMT instance
 */
const stopMMT = (callback) => {
  console.log(mmtStatus);
  if (mmtStatus.isRunning) {
    const logFilePath = `${LOG_PATH + mmtStatus.sessionId}.log`;
    return spawnCommand('sudo', ['killall', 'mmt-probe'], logFilePath, () => {
      mmtStatus.isRunning = false;
      return callback(mmtStatus);
    });
  }
  console.warn('MMT is not running');
  return callback(null);
};

const getMMTStatus = () => mmtStatus;

module.exports = {
  startMMTOffline,
  startMMTOnline,
  startMMTForDataset,
  stopMMT,
  getMMTStatus,
};
