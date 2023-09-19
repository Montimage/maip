import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Select, Menu, Form, Slider, Table, Col, Row, Button, Tooltip } from 'antd';
import { QuestionOutlined } from "@ant-design/icons";
import { Line, Heatmap, Column } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
  requestMetricCurrentness,
} from "../actions";
import {
  BOX_STYLE,
  ACC_METRICS_MENU_ITEMS, COLUMNS_CURRENTNESS_METRICS,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  getConfigConfusionMatrix,
  updateConfusionMatrix,
  getColumnsPerfStats,
  getTablePerformanceStats,
  getConfigClassification,
  computeCutoff,
  getDataPrecision,
  getConfigPrecisionPlot,
  isACApp,
} from "../utils";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
} from "../api";
import './styles.css';

// TODO: recheck cutOff, get errors when update Cutoff percentile of samples for AD models

let isModelIdPresent = getLastPath() !== "accountability";

class AccountabilityMetricsPage extends Component {
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
      dataPrecision: null,
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;
    // reset states once app is changed
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({
        modelId: null,
        stats: [],
        predictions: [],
        confusionMatrix: [],
        classificationData: [],
        cutoffProb: 0.5,
        cutoffPercentile: 0.5,
        dataPrecision: null,
      });
    }
    if (modelId !== prevState.modelId) {
      if (modelId) {
        this.props.fetchModel(modelId);
        this.loadPredictions(modelId);
        this.props.fetchMetricCurrentness(modelId);
        const buildConfig = await requestBuildConfigModel(modelId);
        console.log(buildConfig);
      } else {
        // reset states once modelId is cleared
        this.setState({
          modelId: null,
          stats: [],
          predictions: [],
          confusionMatrix: [],
          classificationData: [],
          cutoffProb: 0.5,
          cutoffPercentile: 0.5,
          dataPrecision: null,
        });
      }
    }
  }

  async loadPredictions(modelId) {
    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));

    this.setState({ predictions }, this.updateConfusionMatrix);
    this.updatePrecisionPlot();
  }

  updateConfusionMatrix() {
    const { predictions, cutoffProb } = this.state;
    const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
    const confusionMatrix = cm.confusionMatrix;
    const stats = cm.stats;
    this.setState({
      predictions,
      stats,
      confusionMatrix,
      classificationData: cm.classificationData
    });
  }

  // TODO: recheck the precision plot
  updatePrecisionPlot() {
    const { predictions } = this.state;
    const dataPrecision = getDataPrecision(predictions);
    console.log(dataPrecision);
    this.setState({ dataPrecision });
  }

  handleCutoffProbChange(value) {
    this.setState({ cutoffProb: value }, () => {
      this.updateConfusionMatrix();
      this.updatePrecisionPlot();
    });
  }

  handleCutoffPercentileChange(value) {
    const { predictions } = this.state;
    const cutoffProb = computeCutoff(predictions);
    this.setState({ cutoffPercentile: value, cutoffProb: cutoffProb });
    this.handleCutoffProbChange(cutoffProb);
  }

  render() {
    const { app, models, metrics } = this.props;

    const {
      modelId,
      cutoffProb,
      cutoffPercentile,
      confusionMatrix,
      stats,
      classificationData,
      dataPrecision,
    } = this.state;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const columnsPerfStats = getColumnsPerfStats(app);
    const dataStats = getTablePerformanceStats(modelId, stats, confusionMatrix);
    const configCM = getConfigConfusionMatrix(modelId, confusionMatrix);
    const configClassification = getConfigClassification(classificationData);
    const cmStyle = isACApp(this.props.app) ? "cmAC" : "cmAD";
    const configPrecision = getConfigPrecisionPlot(dataPrecision);

    const dataCurrentnessMetric = metrics.map((item) => {
      const [method, score] = item.split(': ');
      return { method: method, score: parseFloat(score).toFixed(2) };
    });

    const subTitle = isModelIdPresent ?
      `Accountability metrics of the model ${modelId}` :
      'Accountability metrics of models';

    return (
      <LayoutPage pageTitle="Accountability Metrics" pageSubTitle={subTitle}>
        <Menu mode="horizontal" style={{ backgroundColor: 'transparent', fontSize: '18px' }}>
          {ACC_METRICS_MENU_ITEMS.map(item => (
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
                    options={modelsOptions}
                  />
                </Tooltip>
              </Form.Item>
            </Form>
          </Col>
        </Row>

        <div style={{ padding: '0 0', marginTop: '20px' }}>
          <div style={{ top: 1 }}>
            <Tooltip title={"Cutoff prediction probability is a fixed probability value above which the model will classify a sample as positive. For example, if the cutoff prediction probability is set to 0.5, the model will classify any sample with a predicted probability of belonging to the positive class greater than 0.5 as positive. Cutoff percentile is defined as the point on the predicted probability distribution above which the model will classify a sample as positive. For example, if the cutoff percentile is set to 90%, the model will classify any sample with a predicted probability of belonging to the positive class greater than the 90th percentile as positive."}>
              <Button type="link" icon={<QuestionOutlined />} />
            </Tooltip>
          </div>
          <Form.Item name="slider" label="Cutoff prediction probability" style={{ marginLeft: '50px', marginRight: '50px', marginBottom: '10px' }}>
            <div style={{ width: '100%', display: 'inline-block', alignItems: 'center' }}>
              <Slider
                marks={{
                  0.01: '0.01',
                  0.25: '0.25',
                  0.50: '0.50',
                  0.75: '0.75',
                  0.99: '0.99',
                }}
                min={0.01}
                max={0.99}
                step={0.01}
                value={cutoffProb}
                defaultValue={cutoffProb}
                onChange={(value) => this.handleCutoffProbChange(value)}
              />
            </div>
          </Form.Item>
          <Form.Item name="slider" label="Cutoff percentile of samples" style={{ marginLeft: '50px', marginRight: '50px', marginBottom: '10px' }}>
            <div style={{ width: '100%', display: 'inline-block', alignItems: 'center' }}>
              <Slider
                marks={{
                  0.01: '0.01',
                  0.25: '0.25',
                  0.50: '0.50',
                  0.75: '0.75',
                  0.99: '0.99',
                }}
                min={0.01}
                max={0.99}
                step={0.01}
                value={cutoffPercentile}
                defaultValue={cutoffPercentile}
                onChange={(value) => this.handleCutoffPercentileChange(value)}
              />
            </div>
          </Form.Item>
        </div>
        <Row gutter={24}>
          <Col className="gutter-row" span={12} id="performance">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title={`Shows a list of various model performance metrics for each class.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              {dataStats && <Table columns={columnsPerfStats} dataSource={dataStats} pagination={false}
                style={{ marginTop: '20px' }} />}
            </div>
          </Col>
          <Col className="gutter-row" span={12} id="confusion_matrix">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Confusion Matrix</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title="The confusion matrix shows the number of True Negatives (predicted negative, observed negative), True Positives (predicted positive, observed positive), False Negatives (predicted negative, but observed positive) and False Positives (predicted positive, but observed negative). For different cutoff values, you will get a different number of False Positives and False Negatives. This plot allows you to find the optimal cutoff.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                <div className={cmStyle}>
                  <Heatmap {...configCM} />
                </div>
              </div>
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }} id="classification_plot">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Classification Plot</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title="This plot shows the fraction of each class above and below the cutoff.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Column {...configClassification} style={{ margin: '20px', marginTop: '40px' }}/>
            </div>
          </Col>
          {/* <Col className="gutter-row" span={12} style={{ marginTop: "24px" }} id="precision_plot">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Precision Plot</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title={"The precision plot shows the precision values binned by equal prediction probabilities. It provides an overview of how precision changes as the prediction probability increases."}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              {configPrecision && <Line {...configPrecision} style={{ margin: '20px', marginTop: '40px' }}/>}
            </div>
          </Col> */}
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }} id="currentness">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Currentness Metric</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title="Currentness metric measures the time of executing different XAI methods compared to the time of executing AI models.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table columns={COLUMNS_CURRENTNESS_METRICS} dataSource={dataCurrentnessMetric}
                pagination={false} style={{ marginTop: '20px' }}/>
            </div>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, model, metrics, }) => ({
  app, models, model, metrics,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchMetricCurrentness: (modelId) => dispatch(requestMetricCurrentness(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(AccountabilityMetricsPage);