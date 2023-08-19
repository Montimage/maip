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
  requestRetrainModel,
  requestRetrainStatus,
  requestRetrainStatusAC,
  requestRetrainModelAC,
} from "../actions";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
} from "../api";
import {
  BOX_STYLE,
  SERVER_URL,
  ATTACK_OPTIONS, RES_METRICS_MENU_ITEMS,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  getConfigConfusionMatrix,
  calculateImpactMetric,
  isACApp,
  isRunningApp,
  updateConfusionMatrix,
} from "../utils";

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
      attacksPredictions: [],
      attacksConfusionMatrix: null,
      isRunning: isRunningApp(this.props.app, this.props.retrainACStatus, this.props.retrainStatus),
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
      this.props.fetchModel(modelId);
      this.loadPredictions();
      const buildConfig = requestBuildConfigModel(modelId);
      this.setState({ buildConfig });
      console.log(buildConfig);
    }
    this.props.fetchAllModels();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;  
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
      const buildConfig = requestBuildConfigModel(modelId);
      this.setState({ buildConfig });
      console.log(buildConfig);
    }

    // Check the retrainStatus or retrainACStatus based on the app type
    const currentIsRunning = isRunningApp(this.props.app, this.props.retrainACStatus, this.props.retrainStatus);
    const prevIsRunning = isRunningApp(prevProps.app, prevProps.retrainACStatus, prevProps.retrainStatus);
    
    if (prevIsRunning && prevIsRunning !== currentIsRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: currentIsRunning });
      
      if (!currentIsRunning) {
        clearInterval(this.intervalId);
        console.log('isRunning changed from True to False');
        const retrainId = isACApp(this.props.app) ? 
                          this.props.retrainACStatus.lastRetrainId : this.props.retrainStatus.lastRetrainId;
        await this.loadAttacksPredictions(retrainId);  
      }
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

  handleSelectedAttack(selectedAttack) {
    this.setState({ 
      selectedAttack: selectedAttack,
      attacksConfusionMatrix: null,
    });
    
    const { modelId, buildConfig } = this.state;
    const testingDataset = "Test_samples.csv";
    // TODO: check testingDataset exists, better only show existing poisoned testingDataset
    const trainingDataset = `${selectedAttack}_poisoned_dataset.csv`;
    const currentIsRunning = isRunningApp(this.props.app, this.props.retrainACStatus, this.props.retrainStatus);

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    if (!currentIsRunning) {
      this.setState({ isRunning: true });
      console.log("update isRunning state!");

      if (isACApp(this.props.app)) {
        this.props.fetchRetrainModelAC(
          modelId, trainingDataset, testingDataset,
        );
      }

      if (!isACApp(this.props.app)) {
        const trainingParameters = buildConfig.training_parameters;
        this.props.fetchRetrainModel(
          modelId, trainingDataset, testingDataset, trainingParameters,
        );
      }

      this.intervalId = setInterval(() => {
        isACApp(this.props.app) ? this.props.fetchRetrainStatusAC() : this.props.fetchRetrainStatus();
      }, 3000);
    }
  }

  render() {
    const { app, models } = this.props;
    const {
      modelId,
      confusionMatrix,
      attacksConfusionMatrix,
    } = this.state;

    let configAttacksCM = null, impact = null;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const configCM = confusionMatrix && getConfigConfusionMatrix(modelId, confusionMatrix);
    
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
                  <Tooltip title="Select an adversarial attack to measure resilience metrics.">
                    <Select
                      style={{ width: '250px' }}
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
                      options={ATTACK_OPTIONS}
                    />
                  </Tooltip>
                </Form.Item>
              </Form>
              { attacksConfusionMatrix &&
                <h3>&nbsp;&nbsp;&nbsp;Score: {impact}</h3>
              }
              <Row gutter={24} style={{height: '400px'}}>
                
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
  fetchRetrainModel: (modelId, trainingDataset, testingDataset, params) =>
    dispatch(requestRetrainModel({ modelId, trainingDataset, testingDataset, params })),
  fetchRetrainStatusAC: () => dispatch(requestRetrainStatusAC()),
  fetchRetrainModelAC: (modelId, trainingDataset, testingDataset) =>
    dispatch(requestRetrainModelAC({ modelId, trainingDataset, testingDataset })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ResilienceMetricsPage);