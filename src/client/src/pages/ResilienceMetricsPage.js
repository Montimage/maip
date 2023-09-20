import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Spin, Menu, Select, Col, Row, Button, Tooltip, Form } from 'antd';
import { QuestionOutlined } from "@ant-design/icons";
import { Heatmap } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
  requestRetrainModel,
  requestRetrainStatus,
  requestRetrainStatusAC,
  requestRetrainModelAC,
} from "../actions";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
  requestAttacksDatasets,
} from "../api";
import {
  BOX_STYLE,
  RES_METRICS_MENU_ITEMS,
  ATTACK_DATASETS_MAPPING,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  getConfigConfusionMatrix,
  calculateImpactMetric,
  isACApp,
  isRunningApp,
  updateConfusionMatrix,
  removeCsvPath,
} from "../utils";
import './styles.css';

let isModelIdPresent = getLastPath() !== "resilience";

class ResilienceMetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modelId: null,
      stats: [],
      predictions: [],
      confusionMatrix: null,
      classificationData: [],
      cutoffProb: 0.5,
      selectedAttack: null,
      buildConfig: null,
      attacksDatasets: [],
      attacksPredictions: [],
      attacksConfusionMatrix: null,
      isRunning: false,
    }
  }

  async componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
      this.props.fetchModel(modelId);
      this.loadPredictions();
      const buildConfig = requestBuildConfigModel(modelId);
      console.log(buildConfig);
      const attacksDatasets = await requestAttacksDatasets(modelId);
      console.log(attacksDatasets);
      this.setState({ buildConfig, attacksDatasets });
    }
    this.props.fetchAllModels();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;
    const { app, retrainStatus, retrainACStatus  } = this.props;
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({
        modelId: null,
        stats: [],
        predictions: [],
        confusionMatrix: [],
        classificationData: [],
        cutoffProb: 0.5,
        selectedAttack: null,
        buildConfig: null,
        attacksPredictions: [],
        attacksConfusionMatrix: null,
      });
    }

    if (modelId && modelId !== prevState.modelId) {
      this.props.fetchModel(modelId);
      this.loadPredictions();
      const buildConfig = await requestBuildConfigModel(modelId);
      this.setState({ buildConfig });
      console.log(buildConfig);
    }

    // Check the retrainStatus or retrainACStatus based on the app type
    const currentIsRunning = isRunningApp(app, retrainACStatus, retrainStatus);
    const prevIsRunning = isRunningApp(prevProps.app, prevProps.retrainACStatus, prevProps.retrainStatus);

    if (prevIsRunning === true && currentIsRunning === false) {
      console.log('isRunning has been changed from true to false');
      this.setState({ isRunning: currentIsRunning });
      clearInterval(this.intervalId);
      const retrainId = isACApp(app) ?
                          retrainACStatus.lastRetrainId : retrainStatus.lastRetrainId;
      await this.loadAttacksPredictions(retrainId);
    }
  }

  componentWillUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async loadAttacksPredictions(modelId) {
    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));
    //console.log(predictions);
    this.setState({ attacksPredictions: predictions });
    const attCM = updateConfusionMatrix(this.props.app, predictions, this.state.cutoffProb);
    this.setState({
      stats: attCM.stats,
      attacksConfusionMatrix: attCM.confusionMatrix,
      classificationData: attCM.classificationData
    });
  }

  async loadPredictions() {
    const { modelId, cutoffProb } = this.state;

    if (modelId) {
      const predictionsValues = await requestPredictionsModel(modelId);
      //console.log(predictionsValues);
      const predictions = predictionsValues.split('\n').map((d) => ({
        prediction: parseFloat(d.split(',')[0]),
        trueLabel: parseInt(d.split(',')[1]),
      }));
      //console.log(predictions);

      this.setState({ predictions }, () => {
        const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
        this.setState({
          stats: cm.stats,
          confusionMatrix: cm.confusionMatrix,
          classificationData: cm.classificationData
        });
      });
    }
  }

  async handleButtonComputeMetric(selectedAttack) {
    const { modelId, buildConfig, isRunning } = this.state;
    const { app } = this.props;
    const testingDataset = "Test_samples.csv";
    const trainingDataset = `${selectedAttack}`;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (!isRunning) {
      this.setState({ isRunning: true });
      console.log("update isRunning state!");

      if (isACApp(app)) {
        this.props.fetchRetrainModelAC(
          modelId, trainingDataset, testingDataset,
        );
      } else {
        const transformedBuildConfig = removeCsvPath(JSON.parse(buildConfig));
        const { training_parameters } = transformedBuildConfig;
        console.log(training_parameters);
        this.props.fetchRetrainModel(
          modelId, trainingDataset, testingDataset, training_parameters,
        );
      }

      this.intervalId = setInterval(() => {
        isACApp(app) ? this.props.fetchRetrainStatusAC() : this.props.fetchRetrainStatus();
      }, 3000);
    }
  }

  render() {
    const { app, models } = this.props;
    const {
      isRunning,
      modelId,
      confusionMatrix,
      attacksDatasets,
      attacksConfusionMatrix,
    } = this.state;

    let configAttacksCM = null, impact = null;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const attacksDatasetsOptions = attacksDatasets ? attacksDatasets.map(dataset => ({
      value: dataset,
      label: ATTACK_DATASETS_MAPPING[dataset] || dataset,
    })) : [];
    const configCM = confusionMatrix && getConfigConfusionMatrix(modelId, confusionMatrix);
    const cmStyle = isACApp(this.props.app) ? "cmAC" : "cmAD";

    if (attacksConfusionMatrix) {
      configAttacksCM = getConfigConfusionMatrix(modelId, attacksConfusionMatrix);
      impact = calculateImpactMetric(this.props.app, confusionMatrix, attacksConfusionMatrix);
      console.log(impact);
    }

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
                      this.setState({ modelId: value }, async () => {
                        try {
                          if (value) {
                            const attacksDatasets = await requestAttacksDatasets(value);
                            this.setState({ attacksDatasets });
                          }
                        } catch (error) {
                          console.error("Error loading attacks datasets:", error);
                        }
                      });
                    }}
                    onClear={() => this.setState({
                                    selectedAttack: null,
                                    attacksConfusionMatrix: null,
                                    attacksDatasets: null
                                  })}
                    options={modelsOptions}
                  />
                </Tooltip>
              </Form.Item>
            </Form>
          </Col>
        </Row>
        <Row gutter={24} style={{ marginTop: '10px' }}>
          <Col className="gutter-row" span={24} id="impact">
            <div style={{ position: 'absolute', top: 110, right: 10 }}>
              <Tooltip title="Impact metric shows difference between the original accuracy of a benign model compared to the accuracy of the compromised model after a successful poisoning attack.">
                <Button type="link" icon={<QuestionOutlined />} />
              </Tooltip>
            </div>
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
                  <Row gutter={8}>
                    <Col>
                      <Tooltip title="Select an adversarial attack to measure resilience metrics.">
                        <Select style={{ width: '250px' }}
                          value={this.state.selectedAttack}
                          allowClear showSearch
                          placeholder="Select an attack ..."
                          onChange={value => {
                            if (value) {
                              this.setState({ selectedAttack: value });
                            }
                            this.setState({ attacksConfusionMatrix: null });
                          }}
                          onClear={() => this.setState({ selectedAttack: null, attacksConfusionMatrix: null })}
                          options={attacksDatasetsOptions}
                        />
                      </Tooltip>
                    </Col>

                    <Col>
                      <Button
                        type="primary"
                        disabled={ isRunning || !this.state.modelId || !this.state.selectedAttack }
                        onClick={() => this.handleButtonComputeMetric(this.state.selectedAttack)}
                      >
                        Compute Impact Metric
                        {isRunning &&
                          <Spin size="large" style={{ marginBottom: '8px' }}>
                            <div className="content" />
                          </Spin>
                        }
                      </Button>
                    </Col>
                  </Row>
                </Form.Item>
              </Form>

              { attacksConfusionMatrix &&
                <h3>&nbsp;&nbsp;&nbsp;Score: {impact}</h3>
              }
              <Row gutter={24} style={{height: '400px'}}>

                <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                    <div className={cmStyle}>
                      <h3> Model before attack </h3>
                      { attacksConfusionMatrix &&
                        <Heatmap {...configCM} />
                      }
                    </div>
                  </div>
                </Col>
                <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                    <div className={cmStyle}>
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
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
  fetchRetrainStatusAC: () => dispatch(requestRetrainStatusAC()),
  fetchRetrainModelAC: (modelId, trainingDataset, testingDataset) =>
    dispatch(requestRetrainModelAC({ modelId, trainingDataset, testingDataset })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ResilienceMetricsPage);