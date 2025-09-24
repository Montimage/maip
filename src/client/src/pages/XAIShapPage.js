import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography } from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestRunShap,
  requestXAIStatus,
} from "../actions";
import { getFlowParams, runFlowAndPoll } from "../utils/xaiFlowHelpers";
import {
  getFilteredModelsOptions,
  getFilteredFeatures,
  getLastPath,
  getFilteredFeaturesOptions,
  getNumberFeatures,
  getLabelsList,
  getLabelsListApp,
  getLabelsListXAI,
  getLabelsListAppXAI,
  getFilteredFeaturesModel,
} from "../utils";
import {
  FORM_LAYOUT, BOX_STYLE,
  SHAP_URL, COLUMNS_TOP_FEATURES, XAI_SLIDER_MARKS,
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
} from "../constants";

const { Option } = Select;
let barShap;
let isModelIdPresent = getLastPath() !== "shap";
const downloadShapImage = () => { barShap?.downloadImage(); };

class XAIShapPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      label: getLabelsListAppXAI(this.props.app)[1],
      numberBackgroundSamples: 20,
      numberExplainedSamples: 10,
      maxDisplay: 10,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
      isRunning: props.xaiStatus.isRunning,
      shapValues: [],
      isLabelEnabled: false,
    };
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleShapClick = this.handleShapClick.bind(this);
  }

  // Flow-based SHAP trigger
  async handleShapFlow(modelId, predictionId, sessionId) {
    const { maxDisplay } = this.state;
    this.setState({ isRunning: true, shapValues: [], isLabelEnabled: false });
    const payload = { shapFlowConfig: { modelId, predictionId, sessionId: Number(sessionId), numberFeature: maxDisplay } };
    this.intervalId = await runFlowAndPoll({
      endpointUrl: `${SHAP_URL}/flow`,
      payload,
      fetchXAIStatus: this.props.fetchXAIStatus,
      pollMs: 1000,
    });
  }

  async componentDidMount() {
    const modelId = getLastPath();
    const { sampleId: sampleIdParam, predictionId: predictionIdParam } = getFlowParams();
    if (isModelIdPresent) {
      this.setState({ modelId, label: getLabelsListXAI(modelId)[1] });
      if (predictionIdParam && sampleIdParam !== null) {
        // Flow-based: auto-run SHAP for this instance
        await this.handleShapFlow(modelId, predictionIdParam, sampleIdParam);
      }
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  handleContributionsChange(checkedValues) {
    const positiveChecked = checkedValues.includes('Positive');
    const negativeChecked = checkedValues.includes('Negative');
    this.setState({ positiveChecked, negativeChecked });
  };

  async componentDidUpdate(prevProps, prevState) {
    const { modelId, label, shapValues, isRunning, maxDisplay } = this.state;
    const { app, xaiStatus } = this.props;

    if (app !== prevProps.app && !isModelIdPresent) {
      const defaultLabel = isModelIdPresent ?
                            getLabelsListXAI(modelId)[1] : getLabelsListAppXAI(app)[1];
      this.setState({
        modelId: null,
        label: defaultLabel,
        numberBackgroundSamples: 20,
        numberExplainedSamples: 10,
        maxDisplay: 10,
        positiveChecked: true,
        negativeChecked: true,
        maskedFeatures: [],
        isRunning: false,
        isLabelEnabled: false,
      });
    }

    if (prevState.label !== label && prevState.modelId === modelId) {
      await this.fetchNewValues(modelId, label);
    }

    if (prevProps.xaiStatus.isRunning === true && xaiStatus.isRunning === false) {
      console.log('isRunning has been changed from true to false');
      this.setState({ isRunning: false, isLabelEnabled: true });
      await this.fetchNewValues(modelId, label);
    }

    // Check if shapValues state is updated and clear the interval if it is
    if (prevState.shapValues !== shapValues && shapValues.length > 0) {
      this.setState({ isLabelEnabled: true });
      clearInterval(this.intervalId);
    }

    // In flow-based mode, if user changes 'Features to display', re-run SHAP for the new count
    const { predictionId: predictionIdParam, sampleId: sampleIdParam } = getFlowParams();
    if (
      predictionIdParam && sampleIdParam !== null &&
      prevState.maxDisplay !== maxDisplay &&
      !this.state.isRunning && modelId
    ) {
      await this.handleShapFlow(modelId, predictionIdParam, sampleIdParam);
    }
  }

  // Pay attention to re-render
  shouldComponentUpdate(nextProps, nextState) {
    const { app, models, xaiStatus } = this.props;
    const { modelId, label, shapValues, positiveChecked, negativeChecked, maxDisplay, maskedFeatures} = this.state;

    return (
      app !== nextProps.app ||
      models !== nextProps.models ||
      modelId !== nextState.modelId ||
      label !== nextState.label ||
      shapValues !== nextState.shapValues ||
      xaiStatus.isRunning !== nextProps.xaiStatus.isRunning ||
      (shapValues === nextState.shapValues &&
        (positiveChecked !== nextState.positiveChecked ||
          negativeChecked !== nextState.negativeChecked ||
          maxDisplay !== nextState.maxDisplay ||
          maskedFeatures !== nextState.maskedFeatures))
    );
  }

  async handleShapClick() {
    const { modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay } = this.state;
    const shapConfig = {
      "modelId": modelId,
      "numberBackgroundSamples": numberBackgroundSamples,
      "numberExplainedSamples": numberExplainedSamples,
      "maxDisplay": maxDisplay,
    };
    this.setState({
      isRunning: true,
      shapValues: [],
      isLabelEnabled: false
    });

    const response = await fetch(SHAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shapConfig }),
    });
    const data = await response.json();

    console.log(`Building SHAP values of the model ${modelId}`);
    //console.log(JSON.stringify(data));
    this.intervalId = setInterval(() => { // start interval when button is clicked
      this.props.fetchXAIStatus();
    }, 1000);
  }

  async fetchNewValues(modelId, label) {
    const labelsList = getLabelsListXAI(this.state.modelId);
    const labelIndex = labelsList.indexOf(label);

    if (labelIndex === -1) {
      console.error(`Invalid label: ${label}`);
      return;
    }

    const shapValuesUrl = `${SHAP_URL}/explanations/${modelId}/${labelIndex}`;
    const shapValues = await fetch(shapValuesUrl).then(res => res.json());
    console.log(`Get new SHAP values of the model ${modelId} for label ${label} (index ${labelIndex}) from server`);

    if (JSON.stringify(shapValues) !== JSON.stringify(this.state.shapValues)) {
      this.setState({ shapValues });
    }
  }

  render() {
    const {
      modelId,
      maxDisplay,
      positiveChecked,
      negativeChecked,
      maskedFeatures,
      isRunning,
      shapValues,
    } = this.state;
    const { app, models } = this.props;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const params = new URLSearchParams(window.location.search);
    const isFlowBased = !!params.get('predictionId');
    const sampleIdParam = params.get('sampleId');
    const features = isModelIdPresent ?
                      getFilteredFeaturesModel(modelId) : getFilteredFeatures(app);
    getFilteredFeatures(app);
    const selectFeaturesOptions = getFilteredFeaturesOptions(app);
    const numberFeatures = getNumberFeatures(app);
    const labelsList = isModelIdPresent ?
                        getLabelsListXAI(modelId) : getLabelsListAppXAI(app);
    const labelsOptions = labelsList
      .filter(label => label.trim() !== "")  // filter out empty or whitespace-only labels
      .map(label => ({
        value: label,
        label: label,
      }));

    const filteredValuesShap = shapValues.filter((d) => {
      if (d.importance_value > 0 && positiveChecked) return true;
      if (d.importance_value < 0 && negativeChecked) return true;
      return false;
    });

    const filteredMaskedShap = filteredValuesShap.filter(obj =>
      !maskedFeatures.some(feature => obj.feature.includes(feature)));
    //console.log(filteredMaskedShap);
    const toDisplayShap = filteredMaskedShap.slice(0, maxDisplay);

    const shapValuesBarConfig = {
      data: toDisplayShap,
      isStack: true,
      xField: 'importance_value',
      yField: 'feature',
      //seriesField: 'feature',
      label: false,
      color: (d) => {
        return d.importance_value > 0 ? "#0693e3" : "#EB144C";
      },
      barStyle: (d) => {
        //console.log(d)
        return {
          /* https://casesandberg.github.io/react-color/ */
          //color: d.importance_value > 0 ? "#0693e3" : "#EB144C",
          fill: d.importance_value > 0 ? "#0693e3" : "#EB144C"
        };
      },
      legend: false,
      tooltip: {
        showMarkers: false,
        customItems: (items) => {
          return items.map((it) => {
            const val = it?.data?.importance_value ?? 0;
            return {
              ...it,
              color: val > 0 ? '#0693e3' : '#EB144C',
            };
          });
        },
      },
      interactions: [],
    };

    const topFeatures = toDisplayShap.map((item, index) => ({
        key: index + 1,
        name: item.feature,
        description: features[item.feature]?.description || 'N/A',
    }));

    const subTitle = isModelIdPresent ?
      `SHAP explanations of the model ${modelId}` :
      'SHAP explanations of models';

    return (
      <LayoutPage pageTitle="Explainable AI with SHapley Additive exPlanations (SHAP)" pageSubTitle={subTitle}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>SHAP Parameters</h1>
        </Divider>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600 }}>
          <Form.Item name="model" label="Model"
              style={{ flex: 'none', marginBottom: 10 }}
              rules={[
                {
                  required: true,
                  message: 'Please select a model!',
                },
              ]}
            >
              <Tooltip title="Select a model to perform SHAP method.">
                <Select placeholder="Select a model ..."
                  style={{ width: '100%' }}
                  allowClear showSearch
                  value={this.state.modelId}
                  disabled={isModelIdPresent}
                  onChange={(value) => {
                    if (value) {
                      this.setState({ label: getLabelsListXAI(value)[1] });
                    } else {
                      this.setState({ label: getLabelsListAppXAI(this.props.app)[1] });
                    }
                    this.setState({
                      modelId: value,
                      shapValues: [],
                      isLabelEnabled: false
                    });
                    console.log(`Select model ${value}`);
                  }}
                  options={modelsOptions}
                />
              </Tooltip>
            </Form.Item>
          {!isFlowBased && (
            <>
              <Form.Item label="Background samples" style={{ marginBottom: 10 }} >
                <div style={{ display: 'inline-flex' }}>
                  <Form.Item label="bg" name="bg" noStyle>
                    <Tooltip title="Select number of samples used for producing explanations (maximum is the length of the training dataset).">
                      <InputNumber min={1} defaultValue={20}
                        value={this.state.numberBackgroundSamples}
                        onChange={v => this.setState({
                          numberBackgroundSamples: v,
                          shapValues: [],
                          isLabelEnabled: false
                        })}
                      />
                    </Tooltip>
                  </Form.Item>
                </div>
              </Form.Item>
              <Form.Item label="Explained samples" style={{ marginBottom: 10 }} >
                <div style={{ display: 'inline-flex' }}>
                  <Form.Item label="ex" name="ex" noStyle>
                    <Tooltip title="Select number of samples to be explained (maximum is the length of the testing dataset).">
                      <InputNumber min={1} defaultValue={10}
                        value={this.state.numberExplainedSamples}
                        onChange={v => this.setState({
                          numberExplainedSamples: v,
                          shapValues: [],
                          isLabelEnabled: false
                        })}
                      />
                    </Tooltip>
                  </Form.Item>
                </div>
              </Form.Item>
            </>
          )}
          <Form.Item name="slider" label="Features to display"
            style={{ marginBottom: -5 }}
          >
            <Slider
              marks={XAI_SLIDER_MARKS}
              min={1} max={30} defaultValue={maxDisplay}
              value={this.state.maxDisplay}
              onChange={v => this.setState({ maxDisplay: v })}
            />
          </Form.Item>
          <Form.Item name="checkbox" label="Contributions to display"
            valuePropName="checked"
            style={{ flex: 'none', marginBottom: 10 }}
          >
            <Checkbox.Group
              options={['Positive', 'Negative']}
              defaultValue={['Positive', 'Negative']}

              onChange={this.handleContributionsChange}
            />
          </Form.Item>
          <Form.Item name="select" label="Feature(s) to mask"
            style={{ flex: 'none', marginBottom: 10 }}
          >
            <Select
              mode="multiple"
              style={{
                width: '100%',
              }}
              allowClear
              placeholder="Select feature(s) ..."
              value={this.state.maskedFeatures}
              onChange={v => this.setState({ maskedFeatures: v })}
              optionLabelProp="label"
              options={selectFeaturesOptions}
            />
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Button type="primary"
              onClick={this.handleShapClick}
              disabled={isRunning || !this.state.modelId}
              >SHAP Explain
              {isRunning &&
                <Spin size="large" style={{ marginBottom: '8px' }}>
                  <div className="content" />
                </Spin>
              }
            </Button>
          </div>
        </Form>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>SHAP Explanations</h1>
        </Divider>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={BOX_STYLE}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2>&nbsp;&nbsp;&nbsp;Feature Importances{isFlowBased && sampleIdParam ? ` - Flow sample ID ${sampleIdParam}` : ''}</h2>
                {/* TODO: make position of buttons are flexible */}
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <Tooltip title="Download plot as png">
                    <Button
                      type="link"
                      icon={<CameraOutlined />}
                      style={{
                        marginLeft: '20rem',
                      }}
                      onClick={downloadShapImage}
                    />
                  </Tooltip>
                  <Tooltip title="Feature importances plot displays the sum of individual contributions, computed on the complete dataset.">
                    <Button type="link" icon={<QuestionOutlined />} />
                  </Tooltip>
                </div>
              </div>
              &nbsp;&nbsp;&nbsp;
              <Tooltip title="Select a label">
                <Select
                  value={this.state.label}
                  placeholder="Select a label ..."
                  onChange={v => this.setState({ label: v })}
                  disabled={!this.state.modelId || !this.state.isLabelEnabled}
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 200, marginTop: '10px', marginBottom: '10px' }}
                  options={labelsOptions}
                >
                  {labelsOptions.map((header) => (
                    <Option key={header} value={header}>
                      {header}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
              &nbsp;&nbsp;&nbsp;
              <Typography.Title level={4} style={{ textAlign: 'center', fontSize: '16px' }}>
                {`Average impact on predicted the ${this.state.label} label`} <br />
              </Typography.Title>
              <center>(Total number of features: {numberFeatures})</center>
              {shapValuesBarConfig && (
                <Bar {...shapValuesBarConfig} onReady={(bar) => (barShap = bar)}/>
              )}
              <Typography.Title level={4} style={{ textAlign: 'center', fontSize: '16px', marginTop: '10px' }}>
                Mean absolute SHAP value
              </Typography.Title>
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={BOX_STYLE}>
              <h2>&nbsp;&nbsp;&nbsp;{`Top ${maxDisplay} most important features`}</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={`Displays the top ${maxDisplay} most important features with detailed description.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table dataSource={topFeatures} columns={COLUMNS_TOP_FEATURES}
                size="small" style={{ marginTop: '20px', marginBottom: 0 }}
              />
            </div>
          </Col>
          {/* <Col span={12} style={{ marginTop: "24px" }}>
            <div style={BOX_STYLE}>
              <h2>&nbsp;&nbsp;&nbsp;Feature Dependence</h2>
            </div>
          </Col> */}
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, xaiStatus }) => ({
  app, models, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunShap: (modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIShapPage);