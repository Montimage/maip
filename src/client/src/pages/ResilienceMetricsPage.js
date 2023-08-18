import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Menu, Select, Col, Row, Button, Tooltip, Form } from 'antd';
import { QuestionOutlined } from "@ant-design/icons";
import { Heatmap } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
  requestMetricCurrentness,
  requestRetrainModel,
  requestRetrainStatus,
  requestRetrainStatusAC,
  requestRetrainModelAC,
} from "../actions";
import {
  BOX_STYLE, FORM_LAYOUT,
  SERVER_URL,
  ATTACK_OPTIONS, RES_METRICS_MENU_ITEMS, HEADER_ACCURACY_STATS,
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  isACModel,
  computeAccuracy,
  calculateMetrics,
} from "../utils";

let isModelIdPresent = getLastPath() !== "resilience";

class ResilienceMetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modelId: null,
      stats: [],
      predictions: [],
      confusionMatrix: [],
      classificationData: [],
      cutoffProb: 0.5,
      cutoffPercentile: 0.5,
      fprs: [], 
      tprs: [], 
      auc: 0,
      dataPrecision: null,
      selectedAttack: null,
      buildConfig: null,
      modelDatasets: [],
      attacksDatasets: [],
      attacksPredictions: [],
      attacksConfusionMatrix: null,
      isRunning: props.retrainStatus.isRunning,
      isRunningAC: props.retrainACStatus.isRunning,
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
      this.props.fetchModel(modelId);
      this.loadPredictions();
      this.props.fetchMetricCurrentness(modelId);
      this.fetchModelBuildConfig();
    }
    this.props.fetchAllModels();
    
  }
  
  calculateImpact() {
    const { confusionMatrix, attacksConfusionMatrix } = this.state;
    let impact = 0;
    if (confusionMatrix && attacksConfusionMatrix) {
      let errors = 0;
      let errorsAttack = 0;
      
      if (this.props.app === 'ad') {
        errors = confusionMatrix[0][1] + confusionMatrix[1][0];
        errorsAttack = attacksConfusionMatrix[0][1] + attacksConfusionMatrix[1][0];
      } else if (this.props.app === 'ac') {
        errors = confusionMatrix[0][1] + confusionMatrix[0][2] +
                 confusionMatrix[1][0] + confusionMatrix[1][2] +
                 confusionMatrix[2][0] + confusionMatrix[2][1];
        
        errorsAttack = attacksConfusionMatrix[0][1] + attacksConfusionMatrix[0][2] +
                       attacksConfusionMatrix[1][0] + attacksConfusionMatrix[1][2] +
                       attacksConfusionMatrix[2][0] + attacksConfusionMatrix[2][1];
      }
  
      //console.log(errors);
      //console.log(errorsAttack);
      impact = errors !== 0 ? (errorsAttack - errors) / errors : 0;  // Handle divide by zero
    }
    return impact;
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;  
    // TODO: optimize code to remove redundant states
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({ 
        modelId: null,
        stats: [],
        predictions: [],
        confusionMatrix: [],
        classificationData: [],
        cutoffProb: 0.5,
        cutoffPercentile: 0.5,
        fprs: [], 
        tprs: [], 
        auc: 0,
        dataPrecision: null,
        selectedAttack: null,
        buildConfig: null,
        modelDatasets: [],
        attacksDatasets: [],
        attacksPredictions: [],
        attacksConfusionMatrix: null,
      });
    }

    if (modelId && modelId !== prevState.modelId) {
      this.props.fetchModel(modelId);
      this.loadPredictions();
      this.props.fetchMetricCurrentness(modelId);
      this.fetchModelBuildConfig();
    }

    // TODO: check whether the adversarial datasets are already generated 
    if (prevProps.retrainACStatus.isRunning && prevProps.retrainStatus.isRunning !== this.props.retrainStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.retrainStatus.isRunning });
      if (!this.props.retrainStatus.isRunning) {
        clearInterval(this.intervalId);
        console.log('isRunning changed from True to False');
        const retrainId = this.props.retrainStatus.lastRetrainId;
        await this.loadAttacksPredictions(retrainId);  
      }
    }

    if (prevProps.retrainACStatus.isRunning && prevProps.retrainACStatus.isRunning !== this.props.retrainACStatus.isRunning) {
      console.log('isRunningAC has been changed');
      this.setState({ isRunningAC: this.props.retrainACStatus.isRunning });
      if (!this.props.retrainACStatus.isRunning) {
        clearInterval(this.intervalId);
        console.log('isRunningAC changed from True to False');
        const retrainId = this.props.retrainACStatus.lastRetrainId;
        await this.loadAttacksPredictions(retrainId);  
      }
    }

    if (prevState.selectedAttack !== this.state.selectedAttack) {
      this.handleSelectedAttack(this.state.selectedAttack);
    }
  }

  componentWillUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async loadAttacksPredictions(modelId) {
    const predictionsResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/predictions`, {
      method: 'GET',
    });
    const predictionsData = await predictionsResponse.json();
    const predictionsValues = predictionsData.predictions;
    //console.log(predictionsData);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));
    //console.log(predictions);
    this.setState({ attacksPredictions: predictions });
    this.updateAttacksConfusionMatrix();
  }

  updateAttacksConfusionMatrix() {
    const { modelId, predictions, cutoffProb, attacksPredictions} = this.state;
    // TODO: add another cutoff Slider
    let highCutoff = cutoffProb;
    let lowCutoff = 0.33; 

    // Initialize confusion matrix
    const classificationLabels = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
    const numClasses = classificationLabels.length; 
    let confusionMatrix = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));
    let stats = [];

    //console.log(attacksPredictions);

    attacksPredictions.forEach((d) => {
      if (isNaN(d.prediction) || isNaN(d.trueLabel)) return; // Skip NaN values
      let predictedClass;
      if (isACModel(modelId)) {
        predictedClass = Math.round(d.prediction) - 1;
      } else {
        predictedClass = d.prediction >= cutoffProb ? 1 : 0;
      }
      confusionMatrix[d.trueLabel - 1][predictedClass]++;
    });

    for (let i = 0; i < numClasses; i++) {
      const TP = confusionMatrix[i][i];
      const FP = confusionMatrix.map(row => row[i]).reduce((a, b) => a + b) - TP;
      const FN = confusionMatrix[i].reduce((a, b) => a + b) - TP;
      stats.push(calculateMetrics(TP, FP, FN));
    }

    this.setState({ attacksConfusionMatrix: confusionMatrix });
  }

  updateConfusionMatrix() {
    const { modelId, predictions, cutoffProb } = this.state;

    // TODO: add another cutoff Slider
    let highCutoff = cutoffProb;
    let lowCutoff = 0.33; 

    // Initialize confusion matrix
    const classificationLabels = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
    const numClasses = classificationLabels.length; 
    let confusionMatrix = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));
    let stats = [];

    predictions.forEach((d) => {
      if (isNaN(d.prediction) || isNaN(d.trueLabel)) return; // Skip NaN values
      let predictedClass;
      if (isACModel(modelId)) {
        predictedClass = Math.round(d.prediction) - 1;
      } else {
        predictedClass = d.prediction >= cutoffProb ? 1 : 0;
      }
      confusionMatrix[d.trueLabel - 1][predictedClass]++;
    });

    for (let i = 0; i < numClasses; i++) {
      const TP = confusionMatrix[i][i];
      const FP = confusionMatrix.map(row => row[i]).reduce((a, b) => a + b) - TP;
      const FN = confusionMatrix[i].reduce((a, b) => a + b) - TP;
      stats.push(calculateMetrics(TP, FP, FN));
    }

    this.setState({ stats, confusionMatrix });

    const classificationData = classificationLabels.map((label, index) => {
      return {
        "cutoffProb": "Below cutoff",
        "class": label,
        "value": confusionMatrix[index][index] // Diagonal of confusion matrix gives correct predictions
      }
    }).concat(classificationLabels.map((label, index) => {
      return {
        "cutoffProb": "Above cutoff",
        "class": label,
        "value": confusionMatrix.reduce((acc, row) => acc + row[index], 0) - confusionMatrix[index][index]  // Sum of column minus correct prediction
      }
    }));

    this.setState({ stats, classificationData });
  }

  async loadPredictions() {
    const { modelId } = this.state;

    const predictionsResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/predictions`, {
      method: 'GET',
    });
    const predictionsData = await predictionsResponse.json();
    const predictionsValues = predictionsData.predictions;
    //console.log(predictionsData);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));
    //console.log(predictions);
    this.setState({ predictions }, this.updateConfusionMatrix);
  }

  async fetchModelBuildConfig() {
    const { modelId } = this.state;
    if (modelId) {
      try {
        const response = await fetch(`${SERVER_URL}/api/models/${modelId}/build-config`);
        const data = await response.json();
        const buildConfig = JSON.parse(data.buildConfig);
        this.setState({ buildConfig: buildConfig });
        //console.log(buildConfig.training_parameters);
      } catch (error) {
        console.error('Error fetching build-config:', error);
      }
    }
  }

  // TODO: check testingDataset exists, better only show existing poisoned testingDataset
  handleSelectedAttack(selectedAttack) {
    const { modelId } = this.state;
    this.setState({ 
      selectedAttack: selectedAttack,
      attacksConfusionMatrix: null,
    });
    
    const { isRunning, isRunningAC, buildConfig, modelDatasets, attacksDatasets } = this.state;
    const testingDataset = "Test_samples.csv";
    const trainingDataset = `${selectedAttack}_poisoned_dataset.csv`;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (this.props.app === 'ad' && !this.props.retrainStatus.isRunning) {
      const trainingParameters = buildConfig.training_parameters;
      console.log("update isRunning state!");
      this.setState({ isRunning: true });
      this.props.fetchRetrainModel(
        modelId, trainingDataset, testingDataset, trainingParameters,
      );
      
      this.intervalId = setInterval(() => {
        this.props.fetchRetrainStatus();
      }, 5000);
    }

    if (this.props.app === 'ac' && !this.props.retrainACStatus.isRunning) {
      console.log("update isRunningAC state!");
      this.setState({ isRunningAC: true });
      this.props.fetchRetrainModelAC(
        modelId, trainingDataset, testingDataset,
      );
      
      this.intervalId = setInterval(() => {
        this.props.fetchRetrainStatusAC();
      }, 3000);
    }
  }

  render() {
    const { app, models, model, metrics, retrainStatus } = this.props;
    //console.log(retrainStatus);

    const {
      modelId,
      confusionMatrix,
      stats,
      attacksConfusionMatrix,
    } = this.state;

    const modelsOptions = getFilteredModelsOptions(app, models);
    //console.log(stats);
    const statsStr = stats.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const rowsStats = statsStr.split('\n').map(row => row.split(','));
    let dataStats = [];

    // Determine the number of classes based on model type
    const classificationLabels = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
    const numClasses = modelId && classificationLabels.length;
    const accuracy = computeAccuracy(confusionMatrix);

    // Loop over the rows in rowsStats excluding the accuracy row
    for (let rowIndex = 0; rowIndex < numClasses; rowIndex++) {
      const row = rowsStats[rowIndex];
      HEADER_ACCURACY_STATS.forEach((metric, metricIndex) => {
        if (!dataStats[metricIndex]) {
          dataStats[metricIndex] = {
            key: metricIndex.toString(),
            metric,
          };
        }
        if (row && row[metricIndex + 1]) {
          dataStats[metricIndex]['class' + rowIndex] = +row[metricIndex + 1];
        }
      });
    }

    // Append the accuracy metric to the stats
    const accuracyRow = {
      key: dataStats.length.toString(),
      metric: 'accuracy',
    };
    for (let i = 0; i < numClasses; i++) {
      accuracyRow['class' + i] = accuracy;
    }
    dataStats.push(accuracyRow);

    //console.log(dataStats);

    const cmStr = confusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const rows = cmStr.trim().split('\n');
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      return cols.slice(1).map((val, j) => ({
        actual: classificationLabels[i],
        predicted: classificationLabels[j],
        count: Number(val),
        percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
      }));
    });

    const configCM = {
      data: data,
      forceFit: true,
      xField: 'predicted',
      yField: 'actual',
      colorField: 'count',
      shape: 'square',
      tooltip: false,
      xAxis: { title: { style: { fontSize: 20 }, text: 'Predicted', } },
      yAxis: { title: { style: { fontSize: 20 }, text: 'Observed', } },
      label: {
        visible: true,
        position: 'middle',
        style: {
          fontSize: '18',
        },
        formatter: (datum) => {
          return `${datum.count}\n(${datum.percentage})`;
        },
      },
      heatmapStyle: {
        padding: 0,  
        stroke: '#fff',
        lineWidth: 1,
      },
    };

    let configAttacksCM = null;
    //console.log(attacksConfusionMatrix);
    if (attacksConfusionMatrix) {
      const cmStrAtt = attacksConfusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
      const rowsAtt = cmStrAtt.trim().split('\n');
      const dataAtt = rowsAtt.flatMap((row, i) => {
        const colsAtt = row.split(',');
        const rowTotalAtt = colsAtt.slice(1).reduce((acc, val) => acc + Number(val), 0);
        return colsAtt.slice(1).map((val, j) => ({
          actual: classificationLabels[i],
          predicted: classificationLabels[j],
          count: Number(val),
          percentage: `${((Number(val) / rowTotalAtt) * 100).toFixed(2)}%`,
        }));
      });
      //console.log(dataAtt);
      configAttacksCM = {
        data: dataAtt,
        forceFit: true,
        xField: 'predicted',
        yField: 'actual',
        colorField: 'count',
        shape: 'square',
        tooltip: false,
        xAxis: { title: { style: { fontSize: 20 }, text: 'Predicted', } },
        yAxis: { title: { style: { fontSize: 20 }, text: 'Observed', } },
        label: {
          visible: true,
          position: 'middle',
          style: {
            fontSize: '18',
          },
          formatter: (datum) => {
            return `${datum.count}\n(${datum.percentage})`;
          },
        },
        heatmapStyle: {
          padding: 0,  
          stroke: '#fff',
          lineWidth: 1,
        },
      };
    }

    const impact = this.calculateImpact();
    console.log(impact);

    const subTitle = isModelIdPresent ? 
      `Resilience metrics of the model ${modelId}` : 
      'Relisience metrics of models';

    return (
      <LayoutPage pageTitle="Resilience Metrics" pageSubTitle={subTitle}>
        <Menu mode="horizontal" style={{ backgroundColor: 'transparent', fontSize: '18px' }}>
          {RES_METRICS_MENU_ITEMS.map(item => (
            <Menu.Item key={item.key}>
              <a href={item.link}>{item.label}</a>
            </Menu.Item>
          ))}
        </Menu>
        <Row type="flex" justify="center">
          <Col>
            <Form name="control-hooks" style={{ maxWidth: 700 }}>
              <Form.Item name="model" label="Model" 
                style={{ flex: 'none', marginTop: 20, marginBottom: 10 }}
                rules={[
                  {
                    required: true,
                    message: 'Please select a model!',
                  },
                ]}
              > 
                <Tooltip title="Select a model to perform attacks.">
                  <Select
                    placeholder="Select a model ..."
                    style={{ width: '350px' }}
                    allowClear showSearch
                    value={this.state.modelId}
                    disabled={isModelIdPresent}
                    onChange={(value) => {
                      this.setState({ modelId: value });
                    }}
                    //optionLabelProp="label"
                    options={modelsOptions}
                  />
                </Tooltip>
              </Form.Item>
            </Form>
          </Col>
        </Row>
        <Row gutter={24} style={{ marginTop: '10px' }}>
          <Col className="gutter-row" span={24} id="impact">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Impact Metric</h2>
              &nbsp;&nbsp;&nbsp;
              <Form name="control-hooks" style={{ maxWidth: 700 }}>
                <Form.Item name="attack" label="Attack" 
                  rules={[
                    {
                      required: true,
                      message: 'Please select an adversarial attack!',
                    },
                  ]}
                > 
                  <Tooltip title="Select an adversarial attack to measure resilience metrics.">
                    <Select
                      style={{
                        width: '100%',
                      }}
                      allowClear
                      placeholder="Select an attack ..."
                      onChange={value => {
                        if (!value) {
                          this.setState({ attacksConfusionMatrix: null });
                        } else {
                          this.handleSelectedAttack(value);
                        }
                      }}
                      onClear={ this.setState() }
                      optionLabelProp="label"
                      options={ATTACK_OPTIONS}
                      style={{ width: 250 }}
                    />
                  </Tooltip>
                </Form.Item>
              </Form>
              { attacksConfusionMatrix &&
                <h3>&nbsp;&nbsp;&nbsp;Score: {impact}</h3>
              }
              <Row gutter={24} style={{height: '400px'}}>
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <Tooltip title="Impact metric shows difference between the original accuracy of a benign model compared to the accuracy of the compromised model after a successful poisoning attack.">
                    <Button type="link" icon={<QuestionOutlined />} />
                  </Tooltip>
                </div>
                <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                    <div style={{ position: 'relative', height: '300px', width: '100%', maxWidth: '340px' }}>
                    <h3> Model before attack </h3>
                    { attacksConfusionMatrix &&
                      <Heatmap {...configCM} />
                    }
                    </div>
                  </div>
                </Col>
                <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                    <div style={{ position: 'relative', height: '300px', width: '100%', maxWidth: '340px' }}>
                      <h3> Model after attack </h3>
                      { attacksConfusionMatrix &&
                        <Heatmap {...configAttacksCM} />
                      }
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, model, metrics, retrainStatus, retrainACStatus }) => ({
  app, models, model, metrics, retrainStatus, retrainACStatus
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchRetrainStatus: () => dispatch(requestRetrainStatus()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchMetricCurrentness: (modelId) => dispatch(requestMetricCurrentness(modelId)),
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
  fetchRetrainStatusAC: () => dispatch(requestRetrainStatusAC()),
  fetchRetrainModelAC: (modelId, trainingDataset, testingDataset) =>
    dispatch(requestRetrainModelAC({ modelId, trainingDataset, testingDataset })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ResilienceMetricsPage);