import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography, Modal, Card } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestRunShap,
  requestXAIStatus,
} from "../actions";
import { requestAssistantExplainXAI } from "../api";
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
      assistantModalVisible: false,
      assistantText: '',
      assistantLoading: false,
    };
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleShapClick = this.handleShapClick.bind(this);
  }

  handleAskAssistantShap = async () => {
    const { modelId, label, shapValues, maxDisplay } = this.state;
    if (!modelId || !shapValues || shapValues.length === 0) return;
    // Build concise explanation payload (top maxDisplay items)
    const topItems = shapValues.slice(0, maxDisplay);
    this.setState({ assistantModalVisible: true, assistantLoading: true, assistantText: '' });
    try {
      const resp = await requestAssistantExplainXAI({
        method: 'shap',
        modelId,
        label,
        explanation: topItems,
        context: {},
      });
      console.log('Assistant (SHAP) response:', resp);
      const text = resp && typeof resp.text === 'string' ? resp.text : '';
      this.setState({ assistantText: text || 'Assistant returned no content.', assistantLoading: false });
    } catch (e) {
      this.setState({ assistantText: `Error: ${e.message || String(e)}`, assistantLoading: false });
    }
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
    const { modelId, label, shapValues, positiveChecked, negativeChecked, maxDisplay, maskedFeatures, assistantModalVisible, assistantLoading, assistantText } = this.state;

    return (
      app !== nextProps.app ||
      models !== nextProps.models ||
      modelId !== nextState.modelId ||
      label !== nextState.label ||
      shapValues !== nextState.shapValues ||
      xaiStatus.isRunning !== nextProps.xaiStatus.isRunning ||
      assistantModalVisible !== nextState.assistantModalVisible ||
      assistantLoading !== nextState.assistantLoading ||
      assistantText !== nextState.assistantText ||
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
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
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
              loading={isRunning}
            >
              SHAP Explain
            </Button>
            <Button style={{ marginLeft: 8 }} htmlType="button" type="primary"
              onClick={() => this.handleAskAssistantShap()}
              disabled={!this.state.modelId || this.state.shapValues.length === 0}
            >
              Ask Assistant
            </Button>
          </div>
          </Form>
        </Card>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>SHAP Explanations</h2>
        </Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Feature Importances{isFlowBased && sampleIdParam ? ` - Flow sample ID ${sampleIdParam}` : ''}</h3>
                <div>
                  <Tooltip title="Download plot as png">
                    <Button
                      type="link"
                      icon={<CameraOutlined />}
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
            </Card>
          </Col>
          
          <Col span={12}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{`Top ${maxDisplay} most important features`}</h3>
                <Tooltip title={`Displays the top ${maxDisplay} most important features with detailed description.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table dataSource={topFeatures} columns={COLUMNS_TOP_FEATURES}
                size="small"
              />
            </Card>
          </Col>
          {/* <Col span={12} style={{ marginTop: "24px" }}>
            <div style={BOX_STYLE}>
              <h2>&nbsp;&nbsp;&nbsp;Feature Dependence</h2>
            </div>
          </Col> */}
        </Row>
        <Modal
          title="Assistant Explanation"
          open={this.state.assistantModalVisible}
          onCancel={() => this.setState({ assistantModalVisible: false })}
          footer={<Button onClick={() => this.setState({ assistantModalVisible: false })}>Close</Button>}
          width={800}
          zIndex={2000}
          getContainer={() => document.body}
        >
          {this.state.assistantLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin size="large" />
            </div>
          ) : (
            <div className="assistant-markdown" style={{ maxHeight: 500, overflowY: 'auto' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {this.state.assistantText || ''}
              </ReactMarkdown>
            </div>
          )}
        </Modal>
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