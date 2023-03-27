const fs = require('fs');
const {
  spawn,
} = require('child_process');
const {
  networkInterfaces,
} = require('os');
const {
  v4: uuidv4,
} = require('uuid');

let allInterfaces = null;

const spawnCommand = (cmd, params, logFilePath, onCloseCallback = null) => {
  console.log('Command to be coppied');
  console.log(`${cmd} ${params.join(' ')}`);
  // console.log('Start executing command', cmd, params, logFilePath);
  const logFile = fs.createWriteStream(logFilePath, {
    flags: 'a',
  });
  // console.log('Created log file: ', logFilePath);
  // console.log('Start executing the command');
  const proc = spawn(cmd, params);
  // console.log('Pipe out output');
  proc.stdout.pipe(logFile);
  // console.log('Pipe out error');
  proc.stderr.pipe(logFile);
  proc.on('close', () => {
    console.log('Process has completed: ', cmd, params);
    console.log('The log can be found at: ', logFilePath);
    if (onCloseCallback) {
      console.log('Going to callback on closed');
      return onCloseCallback();
    }
    return null;
  });
};

// const spawnCommand2 = (cmd, params, onCloseCallback, logOutputFilePath, logErrorFilePath) => {
//   const command = spawn(cmd, params);
//   command.stdout.on('data', (output) => {
//     const outputStr = output.toString();
//     console.log(`[${cmd}: OUTPUT]\n`, outputStr);
//     if (onDataCallback) onDataCallback(outputStr);
//   });
//   command.stderr.on('data', (error) => {
//     const errorStr = error.toString();
//     console.log(`[${cmd}: ERROR]\n`, errorStr);
//     if (onErrorCallback) onErrorCallback(errorStr);
//   });
// };

const getAllNetworkInterfaces = () => {
  if (!allInterfaces) {
    allInterfaces = networkInterfaces();
  }
  return allInterfaces;
};

const getInterfaceByName = (interfaceName) => {
  if (!allInterfaces) {
    getAllNetworkInterfaces();
  }
  return allInterfaces[interfaceName];
};

const getAllInterfacesName = () => {
  if (!allInterfaces) {
    getAllNetworkInterfaces();
  }

  return Object.keys(allInterfaces);
};

const interfaceExist = (interfaceName) => {
  if (!allInterfaces) {
    getAllNetworkInterfaces();
  }

  return allInterfaces[interfaceName] !== undefined;
};

const getUniqueId = () => uuidv4();

module.exports = {
  spawnCommand,
  getInterfaceByName,
  getAllInterfacesName,
  interfaceExist,
  getUniqueId,
};
