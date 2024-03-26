const { expressCspHeader, INLINE, NONE, SELF } = require('express-csp-header');
var express = require('express');
const https = require('https');
const fs = require('fs');
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
// Define an array of allowed origins
const allowedOrigins = [
  'http://maip.montimage.com',
  'http://localhost:3000',
  'http://0.0.0.0:3000', // Add more origins as needed
];

// Configure CORS with allowed origins
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
}));
/* // Add headers
app.use((req, res, next) => {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, authorization');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Log the request
  // logInfo(`${req.method} ${req.protocol}://${req.hostname}${req.path} ${res.statusCode}`);
  // Pass to next layer of middleware
  next();
}); */

app.use(expressCspHeader({
  policies: {
      'default-src': [expressCspHeader.NONE],
      'img-src': [expressCspHeader.SELF],
  }
}));

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

// HTTP or HTTPS server
let server;
if (env.PROTOCOL === 'HTTP') {
  server = app.listen(env.SERVER_PORT, env.SERVER_HOST, () => {
    console.log(`[HTTP SERVER] MAIP Server started on http://${env.SERVER_HOST}:${env.SERVER_PORT}`);
  });
} else if (env.PROTOCOL === 'HTTPS') {
  const httpsOptions = {
    key: fs.readFileSync('private.key'),
    cert: fs.readFileSync('certificate.crt'),
    // If you have a chain certificate, add it here:
    // ca: fs.readFileSync('/path/to/ca_bundle.crt')
  };
  server = https.createServer(httpsOptions, app);
  server.listen(env.SERVER_PORT, env.SERVER_HOST, () => {
    console.log(`[HTTPS SERVER] MAIP Server started on https://${env.SERVER_HOST}:${env.SERVER_PORT}`);
  });
} else {
  console.error('Invalid protocol specified in environment variables.');
  process.exit(1);
}

module.exports = server;