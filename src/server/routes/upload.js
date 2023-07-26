const express = require('express');
const {
  getBuildingStatus,
  startBuildingModel,
} = require('../deep-learning/deep-learning-connector');

const {
  PCAP_PATH,
  allowExtensions,
} = require('../constants');
const fs = require('fs');
const router = express.Router();
const path = require('path');

//const multer = require('multer');

// Set up multer, to store files in the 'uploads' directory
//const upload = multer({ dest: 'uploads/' });

/* GET home page. */
router.get('/', (req, res) => {
    res.send({
        message: 'GET from upload' 
    });
  });

router.post('/', (req, res) => {
    if (!req.files) {
        return res.status(400).send('No files were uploaded');
    }

    const file = req.files.pcapFile;
    const extensionName = path.extname(file.name);
    if (!allowExtensions.includes(extensionName)) {
        return res.status(422).send('Invalid format');
    }

    const filePath = `${PCAP_PATH}${file.name}`;
    return file.mv(filePath, (err) => {
        if (err) {
        return res.status(500).send(err);
        }
        return res.send({
        pcapFile: file.name,
        });
    });
});

module.exports = router;
