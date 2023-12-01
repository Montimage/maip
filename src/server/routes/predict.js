const express = require('express');
const {
  getPredictingStatus,
  startPredicting,
  stopOnlinePrediction,
} = require('../deep-learning/deep-learning-connector');
const { listNetworkInterfaces } = require('../utils/utils');

const router = express.Router();

router.get('/stop', (req, res) => {
  stopOnlinePrediction((predictingStatus) => {
    res.send({
      predictingStatus,
    });
  });

});
/**
 * Use a selectedModel (modelId) to classify an input traffic
 * The input traffic can be from a pcap file, a dataset or a network interface
 * Example of the predictConfig
 * - Analyze a pcap file
 * {
 *  selectedModel: 'model-001',
 *  inputTraffic: {
 *    type: 'pcapFile',
 *    value: 'my-pcap-file.pcap'
 *  }
 * }
 * - Analyze a dataset
 * {
 *  selectedModel: 'model-001',
 *  inputTraffic: {
 *    type: 'dataset',
 *    value: 'my-dataset-01'
 *  }
 * }
 * - Analyze a live traffic
 * {
 *  selectedModel: 'model-001',
 *  inputTraffic: {
 *    type: 'net',
 *    value: 'eth0'
 *  }
 * }
 */
router.post('/', (req, res) => {
  const {
    predictConfig,
  } = req.body;
  if (!predictConfig) {
    res.status(401).send({
      error: 'Missing predicting configuration. Please read the docs',
    });
  } else {
    /*const predictionStatus = getPredictingStatus();
    if (predictionStatus.isRunning) {
      res.status(401).send({
        error: 'A predicting process is running. Please try again later',
      });
    } else {
    */
    startPredicting(predictConfig, (predictingStatus) => {
        if (predictingStatus.error) {
          res.status(401).send({
            error: predictingStatus.error,
          });
        } else {
          console.log(predictingStatus);
          res.send(predictingStatus);
        }
      });
    //}
  }
});

router.get('/', (req, res) => {
  res.send({
    predictingStatus: getPredictingStatus(),
  });
});

router.get('/interfaces', (req, res) => {
  const networkInterfaces = listNetworkInterfaces();
  const ipv4Addresses = Object.keys(networkInterfaces).reduce((addresses, interfaceName) => {
    const ipv4Interface = networkInterfaces[interfaceName].find((interface) => interface.family === 'IPv4');

    if (ipv4Interface) {
      addresses.push(`${interfaceName} - ${ipv4Interface.address}`);
    }

    return addresses;
  }, []);

  console.log(ipv4Addresses);

  res.send({
    interfaces: ipv4Addresses,
  });
});

module.exports = router;
