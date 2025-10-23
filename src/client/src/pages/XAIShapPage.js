import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography, Modal, Card, notification } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QuestionOutlined, CameraOutlined, InfoCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import { useUserRole } from '../hooks/useUserRole';
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
      numberBackgroundSamples: 10,
      numberExplainedSamples: 10,
      maxDisplay: 10,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
      isRunning: props.xaiStatus.isRunning,
      shapValues: [],
      isLabelEnabled: false,
      assistantText: '',
      assistantLoading: false,
      assistantTokenInfo: null,
    };
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleShapClick = this.handleShapClick.bind(this);
  }

  handleAskAssistantShap = async () => {
    const { modelId, label, shapValues, maxDisplay } = this.state;
    const { userRole } = this.props;
    if (!modelId || !shapValues || shapValues.length === 0) return;
    // Build concise explanation payload (top maxDisplay items)
    const topItems = shapValues.slice(0, maxDisplay);
    this.setState({ assistantLoading: true, assistantText: '', assistantTokenInfo: null });
    try {
      const resp = await requestAssistantExplainXAI({
        method: 'shap',
        modelId,
        label,
        explanation: topItems,
        userId: userRole?.userId,
        isAdmin: userRole?.isAdmin,
      });
      this.setState({ 
        assistantText: resp.text, 
        assistantLoading: false,
        assistantTokenInfo: resp.tokenUsage 
      });
      
      // Show token usage notification
      if (resp.tokenUsage) {
        const { thisRequest, totalUsed, remaining, limit, percentUsed } = resp.tokenUsage;
        if (limit === Infinity) {
          notification.success({
            message: 'AI Explanation Generated',
            description: `Scroll down to view the explanation. Tokens used: ${thisRequest} - Unlimited (Admin)`,
            placement: 'topRight',
            duration: 5,
          });
        } else {
          const color = percentUsed >= 90 ? 'warning' : 'success';
          notification[color]({
            message: 'AI Explanation Generated',
            description: `Scroll down to view the explanation. Tokens used: ${thisRequest} - Remaining: ${remaining != null ? remaining.toLocaleString() : 0}/${limit != null ? limit.toLocaleString() : 0} (${percentUsed}% used)`,
            placement: 'topRight',
            duration: 5,
          });
        }
      }
    } catch (e) {
      console.error(e);
      this.setState({ assistantText: `Error: ${e.message}`, assistantLoading: false });
      notification.error({
        message: 'AI Assistant Error',
        description: e.message,
        placement: 'topRight',
      });
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
        numberBackgroundSamples: 10,
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
      console.log('[SHAP componentDidUpdate] isRunning changed from true to false');
      console.log('[SHAP componentDidUpdate] modelId:', modelId, 'label:', label);
      // Clear any old polling interval if it exists
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.setState({ isRunning: false, isLabelEnabled: true });
      console.log('[SHAP componentDidUpdate] About to call fetchNewValues');
      await this.fetchNewValues(modelId, label);
      console.log('[SHAP componentDidUpdate] fetchNewValues completed');
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
    
    this.setState({
      maskedFeatures: [],
      assistantText: '',
      assistantTokenInfo: null,
      assistantLoading: false,
      isRunning: true,
      shapValues: [],
      isLabelEnabled: false
    });
    
    console.log(`Building SHAP values of the model ${modelId}`);
    
    // Use Redux action which handles queue-based processing
    // The saga will handle polling and updating status
    this.props.fetchRunShap(modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay);
  }

  async fetchNewValues(modelId, label) {
    console.log('[SHAP fetchNewValues] Called with modelId:', modelId, 'label:', label);
    const labelsList = getLabelsListXAI(this.state.modelId);
    const labelIndex = labelsList.indexOf(label);

    if (labelIndex === -1) {
      console.error(`[SHAP fetchNewValues] Invalid label: ${label}, labelsList:`, labelsList);
      return;
    }

    const shapValuesUrl = `${SHAP_URL}/explanations/${modelId}/${labelIndex}`;
    console.log('[SHAP fetchNewValues] Fetching from:', shapValuesUrl);
    
    try {
      const shapValues = await fetch(shapValuesUrl).then(res => res.json());
      console.log(`[SHAP fetchNewValues] Got SHAP values:`, shapValues);

      if (JSON.stringify(shapValues) !== JSON.stringify(this.state.shapValues)) {
        console.log('[SHAP fetchNewValues] Setting new SHAP values in state');
        this.setState({ shapValues });
      } else {
        console.log('[SHAP fetchNewValues] SHAP values unchanged, skipping setState');
      }
    } catch (error) {
      console.error('[SHAP fetchNewValues] Error fetching SHAP values:', error);
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
    // Check if this is from prediction context (either has predictionId or fromPrediction flag)
    const isFlowBased = !!(params.get('predictionId') || params.get('fromPrediction'));
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
        
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={24}>
            <Card
              bordered={false}
              style={{ height: '100%' }}
            >
              <Row gutter={24}>
                <Col xs={24} lg={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 560, width: '100%', margin: '0 auto' }}>
          <Form.Item name="model" label={<strong><span style={{ color: 'red' }}>* </span>Model</strong>}
              style={{ flex: 'none', marginBottom: 10 }}
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
                      isLabelEnabled: false,
                      assistantText: '',
                      assistantTokenInfo: null,
                      assistantLoading: false
                    });
                    console.log(`Select model ${value}`);
                  }}
                  options={modelsOptions}
                />
              </Tooltip>
            </Form.Item>
          {!isFlowBased && (
            <>
              <Form.Item label={<strong>Background samples</strong>} style={{ marginBottom: 10 }} >
                <div style={{ display: 'inline-flex' }}>
                  <Form.Item label="bg" name="bg" noStyle>
                    <Tooltip title="Select number of samples used for producing explanations (maximum is the length of the training dataset).">
                      <InputNumber min={1} defaultValue={10}
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
              <Form.Item label={<strong>Explained samples</strong>} style={{ marginBottom: 10 }} >
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
          <Form.Item name="slider" label={<strong>Features to display</strong>}
            style={{ marginBottom: -5 }}
          >
            <Slider
              marks={XAI_SLIDER_MARKS}
              min={1} max={30} defaultValue={maxDisplay}
              value={this.state.maxDisplay}
              onChange={v => this.setState({ maxDisplay: v })}
            />
          </Form.Item>
          <Form.Item name="checkbox" label={<strong>Contributions to display</strong>}
            valuePropName="checked"
            style={{ flex: 'none', marginBottom: 10 }}
          >
            <Checkbox.Group
              options={['Positive', 'Negative']}
              defaultValue={['Positive', 'Negative']}

              onChange={this.handleContributionsChange}
            />
          </Form.Item>
          <Form.Item name="select" label={<strong>Feature(s) to mask</strong>}
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
            <Tooltip title={!this.props.userRole?.isSignedIn ? "Sign in required" : 
                           this.props.userRole?.tokenLimitReached ? "Token limit reached" : 
                           "Get AI explanation of SHAP results"}>
              <Button 
                style={{ marginLeft: 8 }} 
                htmlType="button" 
                type="primary"
                onClick={() => this.handleAskAssistantShap()}
                disabled={!this.state.modelId || this.state.shapValues.length === 0 || 
                         !this.props.userRole?.isSignedIn || 
                         this.props.userRole?.tokenLimitReached}
                loading={this.state.assistantLoading}
              >
                Ask Assistant
              </Button>
            </Tooltip>
          </div>
                  </Form>
                </Col>
                <Col xs={24} lg={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8, padding: 16, maxWidth: 560, width: '100%', margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                      <Typography.Text strong style={{ color: '#1677ff', fontSize: 15 }}>SHAP Method Overview</Typography.Text>
                    </div>
                    <Typography.Paragraph style={{ color: '#0958d9', marginBottom: 8, lineHeight: 1.6 }}>
                      <strong>SHapley Additive exPlanations (SHAP)</strong> uses Shapley values from cooperative game theory to quantify each feature's contribution to a prediction. It computes the average marginal contribution of each feature across all possible feature combinations, providing a theoretically sound and model-agnostic explanation.
                    </Typography.Paragraph>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6 }}>
                      <WarningOutlined style={{ color: '#d48806', fontSize: 16, marginTop: 2 }} />
                      <Typography.Text style={{ color: '#ad6800', fontSize: 13, lineHeight: 1.6 }}>
                        <strong>Performance Warning:</strong> Running SHAP with a large number of background or explaining samples can be very slow and may take hours to complete. Start with small sample sizes (10-30) for testing.
                      </Typography.Text>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>SHAP Explanations</h2>
        </Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Feature Importances{isFlowBased && sampleIdParam ? ` - Flow sample ID ${sampleIdParam}` : ''}</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Shows the average impact of each feature on model predictions across the complete dataset
                </span>
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
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>{`Top ${maxDisplay} most important features`}</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Details of the most influential features with their technical descriptions
                </span>
              </div>
              <Table dataSource={topFeatures} columns={COLUMNS_TOP_FEATURES}
                size="small"
              />
            </Card>
            
            {/* AI Assistant Explanation Card - Right Side */}
            {(this.state.assistantText || this.state.assistantLoading) && (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>AI Assistant Explanation</h3>
                  <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                    AI-generated explanation of the SHAP results to help interpret feature importance
                  </span>
                </div>
                {this.state.assistantLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <>
                    <div className="assistant-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {this.state.assistantText || ''}
                      </ReactMarkdown>
                    </div>
                    {this.state.assistantTokenInfo && (
                      <div style={{ marginTop: 16, padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '4px' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                          <strong>Token Usage:</strong> {this.state.assistantTokenInfo.thisRequest} tokens used this request
                          {this.state.assistantTokenInfo.limit !== Infinity && (
                            <> - <strong>Total:</strong> {(this.state.assistantTokenInfo.totalUsed != null ? this.state.assistantTokenInfo.totalUsed : 0).toLocaleString()}/{(this.state.assistantTokenInfo.limit != null ? this.state.assistantTokenInfo.limit : 0).toLocaleString()} 
                            ({this.state.assistantTokenInfo.percentUsed}% used) - <strong>Remaining:</strong> {(this.state.assistantTokenInfo.remaining != null ? this.state.assistantTokenInfo.remaining : 0).toLocaleString()} tokens</>
                          )}
                          {this.state.assistantTokenInfo.limit === Infinity && <> - <strong>Unlimited</strong> (Admin)</>}
                        </Typography.Text>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}
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
  fetchRunShap: (modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberBackgroundSamples, numberExplainedSamples, maxDisplay })),
});

// HOC to inject userRole
const XAIShapPageWithUserRole = (props) => {
  const userRole = useUserRole();
  return <XAIShapPage {...props} userRole={userRole} />;
};

export default connect(mapPropsToStates, mapDispatchToProps)(XAIShapPageWithUserRole);