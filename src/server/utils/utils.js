const fs = require('fs');
const os = require('os');
const util = require('util');
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
  console.log('Command to be executed:', `${cmd} ${params.join(' ')}`);

  // Create log file stream
  const logFile = fs.createWriteStream(logFilePath, {
    flags: 'a',
  });

  // Execute command
  const proc = spawn(cmd, params);

  // Handle stdout
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Python output:', output);  // Show in console
    logFile.write(output);  // Write to log file
  });

  // Handle stderr
  proc.stderr.on('data', (data) => {
    const error = data.toString();
    console.error('Python error:', error);  // Show in console
    logFile.write(error);  // Write to log file
  });

  // Handle process completion
  proc.on('close', (code) => {
    console.log(`Process completed with code: ${code}`);
    logFile.end();

    if (onCloseCallback) {
      return onCloseCallback(code !== 0 ? new Error(`Exit code: ${code}`) : null);
    }
    return null;
  });

  // Handle spawn errors
  proc.on('error', (err) => {
    console.error('Failed to spawn process:', err);
    logFile.write(`Error: ${err.toString()}\n`);
    logFile.end();
    if (onCloseCallback) {
      return onCloseCallback(err);
    }
    return null;
  });
};

const spawnCommandAsync = (cmd, params, logFilePath) => {
  return new Promise((resolve, reject) => {
    //console.log('Command to be copied');
    //console.log(`${cmd} ${params.join(' ')}`);
    //const logFile = fs.createWriteStream(logFilePath, {
    //  flags: 'a',
    //});
    const proc = spawn(cmd, params);
    //proc.stdout.pipe(logFile);
    //proc.stderr.pipe(logFile);
    proc.on('close', (code) => {
      //console.log('Process has completed: ', cmd, params);
      //console.log('The log can be found at: ', logFilePath);
      if (code === 0) {
        resolve();
      } else {
        resolve(401);
        //reject(new Error(`Command failed with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      resolve(401);
      //reject(new Error(`Command execution error: ${err.message}`));
    });
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

function replaceCommas(str) {
  let inQuotes = false;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    let char = str.charAt(i);
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if (char === ',' && !inQuotes) {
      char = ';';
    }
    result += char;
  }
  return result;
}

/**
 * Replace , with ; of a csv file to better display
 * Handles quoted fields properly to avoid breaking commas inside quotes
 */
function replaceDelimiterInCsv(inputFilePath, outputFilePath) {
  const inputCsv = fs.readFileSync(inputFilePath, 'utf-8');
  const rows = inputCsv.split('\n');
  // Use replaceCommas for ALL rows to handle quoted fields properly
  const updatedRows = rows.map(row => replaceCommas(row));
  const outputCsv = updatedRows.join('\n');
  fs.writeFileSync(outputFilePath, outputCsv, 'utf-8');
}

function listNetworkInterfaces() {
  return os.networkInterfaces();
}


module.exports = {
  spawnCommand,
  spawnCommandAsync,
  getInterfaceByName,
  getAllInterfacesName,
  interfaceExist,
  getUniqueId,
  replaceDelimiterInCsv,
  listNetworkInterfaces,
};
