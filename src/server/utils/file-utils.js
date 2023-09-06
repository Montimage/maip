/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// TODO: error handling this function when files is empty
const listFiles = (path, filters, callback) => {
  if (fs.existsSync(path)) {
    fs.readdir(path, (err, files) => {
      if (filters === '*') return callback(files);
      const finalFiles = [];
      // eslint-disable-next-line no-plusplus
      for (let index = 0; index < files.length; index++) {
        const f = files[index];
        if (typeof filters === 'string') {
          if (f.indexOf(filters) > -1) {
            finalFiles.push(f);
          }
        } else if (filters.length > 0) {
          // eslint-disable-next-line no-plusplus
          for (let index2 = 0; index2 < filters.length; index2++) {
            const filter = filters[index2];
            if (f.indexOf(filter) > -1) {
              finalFiles.push(f);
              break;
            }
          }
        }
      }
      return callback(finalFiles);
    });
  } else {
    console.error(`Directory does not exist: ${path}`);
    return callback([]);
  }
};

const listFilesByTypeAsync = (path, ext) => {
  const allFiles = fs.readdirSync(path);
  return allFiles.filter((f) => f.endsWith(ext));
};

const listFilesAsync = (path, filters) => {
  const allFiles = fs.readdirSync(path);
  if (filters === '*') return allFiles;
  const finalFiles = [];
  // eslint-disable-next-line no-plusplus
  for (let index = 0; index < allFiles.length; index++) {
    const f = allFiles[index];
    if (typeof filters === 'string') {
      if (f.indexOf(filters) > -1) {
        finalFiles.push(f);
      }
    } else if (filters.length > 0) {
      // eslint-disable-next-line no-plusplus
      for (let index2 = 0; index2 < filters.length; index2++) {
        const filter = filters[index2];
        if (f.indexOf(filter) > -1) {
          finalFiles.push(f);
          break;
        }
      }
    }
  }
  return finalFiles;
};

const isFileExistSync = (filePath) => {
  try {
    if (fs.statSync(filePath) !== null) return true;
    return false;
  } catch (error) {
    return false;
  }
};

// eslint-disable-next-line no-unused-vars
const isFileExist = (filePath, callback) => fs.stat(filePath, (err, stats) => {
  if (err) {
    console.error(err);
    callback(false);
  } else {
    callback(true);
  }
});

const deleteFile = (filePath, callback) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Failed to delete file ', filePath);
      console.error(err);
      callback(false);
    } else {
      callback(true);
    }
  });
};

const createFolderSync = (folderPath) => {
  if (isFileExistSync(folderPath)) {
    console.log('Folder has been created already');
    return true;
  }
  try {
    fs.mkdirSync(folderPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

/**
 * callback(true): if the path has been created successfully
 *
 * callback(false) otherwise
 * @param {String} folderPath absolute path to be created
 * @param {Function} callback the callback function after creating the path
 */
const createFolder = (folderPath, callback) => {
  isFileExist(folderPath, (ret) => {
    if (ret) {
      console.log('Folder has been created already: ', folderPath);
      callback(true);
    } else {
      console.log('Going to create folder: ', folderPath);
      fs.mkdir(folderPath, (err) => {
        if (err) {
          console.error('Failed to create folder', folderPath);
          console.error(err);
          callback(false);
        } else {
          callback(true);
        }
      });
    }
  });
};

const readTextFile = (filePath, callback) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(err);
      callback(err, null);
    } else {
      callback(null, data.toString());
    }
  });
};

const writeTextFile = (dataPath, content, callback) => {
  try {
    fs.writeFile(dataPath, content, () => callback(null));
  } catch (error) {
    console.error('Failed a create new data to write');
    console.error(error);
    callback(error);
  }
};

const listDirectories = (directoryPath, callback) => {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return console.error('Unable to scan directory: ' + err);
    }

    let directories = [];
    files.forEach((file) => {
      if (fs.statSync(path.join(directoryPath, file)).isDirectory()) {
        directories.push(file);
      }
    });

    callback(directories);
  });
};

module.exports = {
  listFiles,
  listFilesAsync,
  listFilesByTypeAsync,
  isFileExist,
  isFileExistSync,
  deleteFile,
  createFolder,
  createFolderSync,
  readTextFile,
  writeTextFile,
  listDirectories,
};
