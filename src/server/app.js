var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const logger = require('morgan');
const fileUpload = require('express-fileupload');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger/swagger.json');
var bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
// read and pass the environment variables into reactjs application
const env = dotenv.config().parsed;

const acRouter = require('./routes/ac');
const mmtRouter = require('./routes/mmt');
const pcapRouter = require('./routes/pcap');
const reportRouter = require('./routes/report');
const logRouter = require('./routes/log');
const modelRouter = require('./routes/model');
const buildRouter = require('./routes/build');
const retrainRouter = require('./routes/retrain');
const predictionRouter = require('./routes/prediction');
const predictRouter = require('./routes/predict');
const xaiRouter = require('./routes/xai');
const attacksRouter = require('./routes/attacks');
const metricsRouter = require('./routes/metrics');
const uploadRouter = require('./routes/upload');

const app = express();
var compression = require('compression');
var helmet = require('helmet');

app.use(compression()); //Compress all routes
app.use(helmet());
app.set("port", env.SERVER_PORT);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
  extended: false,
}));
app.use(cookieParser());
app.use(fileUpload());
app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}))
app.use(cookieParser());
// Set up CORS
//app.use(cors());
app.use(cors({
  origin: 'http://localhost:3000', // replace with your client origin
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
}));
// Add headers
/*app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, authorization');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Log the request
  // logInfo(`${req.method} ${req.protocol}://${req.hostname}${req.path} ${res.statusCode}`);
  // Pass to next layer of middleware
  next();
});*/

app.use('/api/ac', acRouter);
app.use('/api/mmt', mmtRouter);
app.use('/api/pcaps', pcapRouter);
app.use('/api/reports', reportRouter);
app.use('/api/logs', logRouter);
app.use('/api/models', modelRouter);
app.use('/api/build', buildRouter);
app.use('/api/retrain', retrainRouter);
app.use('/api/predictions', predictionRouter);
app.use('/api/predict', predictRouter);
app.use('/api/xai', xaiRouter);
app.use('/api/attacks', attacksRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/upload', uploadRouter);

if (process.env.MODE === 'SERVER') {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });
} else if (process.env.MODE === 'API') {
  // start Swagger API server 
  app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use(express.static(path.join(__dirname, 'swagger')));
  module.exports = app;
}

module.exports = app;

var server = app.listen(app.get('port'), env.SERVER_HOST, function () {
  console.log(`[SERVER] MAIP Server started on: http://${env.SERVER_HOST}:${env.SERVER_PORT}`);
});