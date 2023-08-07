import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Menu, Select, Col, Row, Button, Tooltip, Form } from 'antd';
import { QuestionOutlined } from "@ant-design/icons";
import { Heatmap } from '@ant-design/plots';
import {
  requestAllModels,
  requestModel,
  requestMetricCurrentness,
  requestRetrainModel,
  requestRetrainStatus,
} from "../actions";
import {
  BOX_STYLE, FORM_LAYOUT,
  SERVER_URL,
  ATTACK_OPTIONS, RES_METRICS_MENU_ITEMS, HEADER_ACCURACY_STATS
} from "../constants";

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
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchAllModels();
    
  }

  // TODO: fix why classification plot and CM are rendered even values are not changed
  /*shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.classificationData !== nextState.classificationData ||
      this.props.retrainStatus.isRunning !== nextProps.retrainStatus.isRunning ||
      this.state.confusionMatrix !== nextState.confusionMatrix
    );
  }*/

  calculateImpact() {
    const { confusionMatrix, attacksConfusionMatrix } = this.state;
    let impact = 0;
    if (confusionMatrix && attacksConfusionMatrix) {
      const errors = confusionMatrix[0][1] + confusionMatrix[1][0];
      const errorsAttack = attacksConfusionMatrix[0][1] + attacksConfusionMatrix[1][0];
      console.log(errors);
      console.log(errorsAttack);
      impact = (errorsAttack - errors) / errors;
    }
    return impact;
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;  

    if (modelId && modelId !== prevState.modelId) {
      this.props.fetchModel(modelId);
      this.loadPredictions();
      this.props.fetchMetricCurrentness(modelId);
      this.fetchModelBuildConfig();
    
      // TODO: check whether the adversarial datasets are already generated 
      if (prevProps.retrainStatus.isRunning !== this.props.retrainStatus.isRunning) {
        console.log('isRunning has been changed');
        this.setState({ isRunning: this.props.retrainStatus.isRunning });
        if (!this.props.retrainStatus.isRunning) {
          console.log('isRunning changed from True to False');
          const retrainId = this.props.retrainStatus.lastRetrainId;
          await this.loadAttacksPredictions(retrainId);  
        }
      }

      // Check if attacksPredictions state is updated and clear the interval if it is
      if (prevState.attacksConfusionMatrix !== this.state.attacksConfusionMatrix) {
        clearInterval(this.intervalId);
      }
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
    const { attacksPredictions } = this.state;
    const cutoffProb = 0.5;
    const TP = attacksPredictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoffProb).length;
    const FP = attacksPredictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoffProb).length;
    const TN = attacksPredictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoffProb).length;
    const FN = attacksPredictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoffProb).length;
    const confusionMatrix = [
      [TP, FP],
      [FN, TN],
    ];

    this.setState({ attacksConfusionMatrix: confusionMatrix });
  }

  updateConfusionMatrix() {
    const { predictions, cutoffProb } = this.state;
    const TP = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoffProb).length;
    const FP = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoffProb).length;
    const TN = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoffProb).length;
    const FN = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoffProb).length;
    const confusionMatrix = [
      [TP, FP],
      [FN, TN],
    ];

    this.setState({ confusionMatrix });

    const accuracy = (TP + TN) / (TP + TN + FP + FN);
    const precision = TP / (TP + FP);
    const recall = TP / (TP + FN);
    const f1Score = (2 * precision * recall) / (precision + recall);

    const precisionPositive = TP / (TP + FP);
    const recallPositive = TP / (TP + FN);
    const f1ScorePositive = (2 * precisionPositive * recallPositive) / (precisionPositive + recallPositive);
    const supportPositive = TP + FN;

    const precisionNegative = TN / (TN + FN);
    const recallNegative = TN / (TN + FP);
    const f1ScoreNegative = (2 * precisionNegative * recallNegative) / (precisionNegative + recallNegative);
    const supportNegative = TN + FP;

    //console.log({accuracy, precision, recall, f1Score});
    //console.log({precisionPositive, recallPositive, f1ScorePositive, supportPositive});
    //console.log({precisionNegative, recallNegative, f1ScoreNegative, supportNegative});

    const stats = [
      [precisionPositive, recallPositive, f1ScorePositive, supportPositive],
      [precisionNegative, recallNegative, f1ScoreNegative, supportNegative],
      [accuracy],
    ];

    this.setState({ stats: stats });

    const classificationData = [
      {
        "cutoffProb": "Below cutoff",
        "class": "Normal traffic",
        "value": TN
      },
      {
        "cutoffProb": "Below cutoff",
        "class": "Malware traffic",
        "value": FP
      },
      {
        "cutoffProb": "Above cutoff",
        "class": "Normal traffic",
        "value": FN
      },
      {
        "cutoffProb": "Above cutoff",
        "class": "Malware traffic",
        "value": TP
      },
      {
        "cutoffProb": "Total",
        "class": "Normal traffic",
        "value": (TN + FN)
      },
      {
        "cutoffProb": "Total",
        "class": "Malware traffic",
        "value": (TP + FP)
      },
    ];    

    this.setState({ classificationData: classificationData });
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
        console.log(buildConfig.training_parameters);
      } catch (error) {
        console.error('Error fetching build-config:', error);
      }
    }
  }

  handleSelectedAttack(selectedAttack) {
    const { modelId } = this.state;
    this.setState({ selectedAttack: selectedAttack });
    
    const { isRunning, buildConfig, modelDatasets, attacksDatasets } = this.state;
    const trainingParameters = buildConfig.training_parameters;
    const testingDataset = "Test_samples.csv";
    const trainingDataset = `${selectedAttack}_poisoned_dataset.csv`;

    if (!isRunning) {
      console.log("update isRunning state!");
      this.setState({ isRunning: true });
      this.props.fetchRetrainModel(
        modelId, trainingDataset, testingDataset, trainingParameters,
      );
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchRetrainStatus();
      }, 5000);
    }
  }

  render() {
    const { models, model, metrics, retrainStatus } = this.props;
    console.log(retrainStatus);

    const {
      modelId,
      confusionMatrix,
      stats,
      attacksConfusionMatrix,
    } = this.state;

    const modelsOptions = models ? models.map(model => ({
      value: model.modelId,
      label: model.modelId,
    })) : [];

    const statsStr = stats.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const rowsStats = statsStr.split('\n').map(row => row.split(','));
    let dataStats = [];
    if(rowsStats.length === 3) {
      const accuracy = parseFloat(rowsStats[2][1]);
      dataStats = HEADER_ACCURACY_STATS.map((metric, i) => ({
        key: (i).toString(),
        metric,
        class0: +rowsStats[0][i+1],
        class1: +rowsStats[1][i+1],
      }));
      dataStats.push({
        key: '5',
        metric: 'accuracy',
        class0: accuracy,
        class1: accuracy,
      });
    }

    const cmStr = confusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const headers = ["Normal traffic", "Malware traffic"];
    const rows = cmStr.trim().split('\n');
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      return cols.slice(1).map((val, j) => ({
        actual: headers[i],
        predicted: headers[j],
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
    if (attacksConfusionMatrix) {
      const cmStrAtt = attacksConfusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
      const rowsAtt = cmStrAtt.trim().split('\n');
      const dataAtt = rowsAtt.flatMap((row, i) => {
        const colsAtt = row.split(',');
        const rowTotalAtt = colsAtt.slice(1).reduce((acc, val) => acc + Number(val), 0);
        return colsAtt.slice(1).map((val, j) => ({
          actual: headers[i],
          predicted: headers[j],
          count: Number(val),
          percentage: `${((Number(val) / rowTotalAtt) * 100).toFixed(2)}%`,
        }));
      });
      console.log(dataAtt);
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
                      console.log(`Select model ${value}`);
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
                        if (value) { // TODO: this function is auto executed even users have not selected an attack yet
                          this.handleSelectedAttack(value);
                        }
                      }}
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
                    <div style={{ position: 'relative', height: '320px', width: '100%', maxWidth: '390px' }}>
                    <h3> Model before attack </h3>
                    { attacksConfusionMatrix &&
                      <Heatmap {...configCM} />
                    }
                    </div>
                  </div>
                </Col>
                <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                    <div style={{ position: 'relative', height: '320px', width: '100%', maxWidth: '390px' }}>
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

const mapPropsToStates = ({ models, model, metrics, retrainStatus }) => ({
  models, model, metrics, retrainStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchRetrainStatus: () => dispatch(requestRetrainStatus()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchMetricCurrentness: (modelId) => dispatch(requestMetricCurrentness(modelId)),
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ResilienceMetricsPage);