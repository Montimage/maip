import React, { Component } from 'react';
import { connect } from 'react-redux';
import LayoutPage from './LayoutPage';
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography, Modal, Card, notification } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QuestionOutlined, CameraOutlined } from '@ant-design/icons';
import { Bar, Pie } from '@ant-design/plots';
import { useUserRole } from '../hooks/useUserRole';
import {
  requestApp,
  requestAllModels,
  requestRunLime,
  requestXAIStatus,
} from "../actions";
import { requestPredictionsModel, requestAssistantExplainXAI } from "../api";
import {
  getFilteredFeaturesOptions,
  getFilteredModelsOptions,
  getLastPath,
  getLabelsListXAI,
  getLabelsListAppXAI,
  getTrueLabel
} from "../utils";
import { getFlowParams, fetchInstanceProbs } from "../utils/xaiFlowHelpers";
import {
  FORM_LAYOUT, BOX_STYLE,
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
  SERVER_URL,
  LIME_URL, XAI_SLIDER_MARKS, COLUMNS_TABLE_PROBS,
} from "../constants";

const { Option } = Select;
let barLime;
let isModelIdPresent = getLastPath() !== "lime";
const downloadLimeImage = () => { barLime?.downloadImage(); };

class XAILimePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      label: getLabelsListAppXAI(this.props.app)[1],
      sampleId: 5,
      numberSamples: 10,
      maxDisplay: 15,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
      pieData: [],
      dataTableProbs: [],
      isRunning: props.xaiStatus.isRunning,
      limeValues: [],
      isLabelEnabled: false,
      predictions: null,
      assistantText: '',
      assistantLoading: false,
      assistantTokenInfo: null,
    };
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleLimeClick = this.handleLimeClick.bind(this);
  }

  handleAskAssistantLime = async () => {
    const { modelId, label, limeValues, dataTableProbs, pieData, sampleId } = this.state;
    const { userRole } = this.props;
    if (!modelId || !limeValues || limeValues.length === 0) return;
    this.setState({ assistantLoading: true, assistantText: '', assistantTokenInfo: null });
    try {
      const context = { dataTableProbs, pieData, sampleId };
      const resp = await requestAssistantExplainXAI({
        method: 'lime',
        modelId,
        label,
        explanation: limeValues,
        context,
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
            description: `Tokens used: ${thisRequest} - Unlimited (Admin)`,
            placement: 'topRight',
            duration: 4,
          });
        } else {
          const color = percentUsed >= 90 ? 'warning' : 'success';
          notification[color]({
            message: 'AI Explanation Generated',
            description: `Tokens used: ${thisRequest} - Remaining: ${remaining.toLocaleString()}/${limit.toLocaleString()} (${percentUsed}% used)`,
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

  async componentDidMount() {
    const modelId = getLastPath();
    // read optional sampleId from query string
    const { sampleId: sampleIdParam, predictionId: predictionIdParam } = getFlowParams();
    const sampleIdFromQuery = sampleIdParam !== null ? parseInt(sampleIdParam, 10) : null;
    if (isModelIdPresent) {
      this.setState({ modelId, label: getLabelsListXAI(modelId)[1] });
      // Only fetch test-set predictions for non flow-based mode
      if (!predictionIdParam) {
        const predictions = await requestPredictionsModel(modelId);
        this.setState({ predictions });
      }
      if (Number.isInteger(sampleIdFromQuery)) {
        // apply provided sampleId and auto-run LIME
        this.setState({ sampleId: sampleIdFromQuery }, async () => {
          await this.handleLimeClick();
        });
      }
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  handleContributionsChange(checkedValues){
    const positiveChecked = checkedValues.includes('Positive');
    const negativeChecked = checkedValues.includes('Negative');
    this.setState({ positiveChecked, negativeChecked });
  };

  async componentDidUpdate(prevProps, prevState) {
    const { modelId, label, limeValues, sampleId } = this.state;
    const { app, xaiStatus } = this.props;

    if (app !== prevProps.app && !isModelIdPresent) {
      const defaultLabel = isModelIdPresent ?
                            getLabelsListXAI(modelId)[1] : getLabelsListAppXAI(app)[1];
      this.setState({
        modelId: null,
        label: defaultLabel,
        sampleId: 5,
        maxDisplay: 15,
        positiveChecked: true,
        negativeChecked: true,
        maskedFeatures: [],
        pieData: [],
        dataTableProbs: [],
        limeValues: [],
        isRunning: false,
        isLabelEnabled: false,
        predictions: null,
      });
    }

    if (prevState.label !== label && prevState.modelId === modelId) {
      await this.fetchNewValues(modelId, label);
    }

    if (prevProps.xaiStatus.isRunning === true && xaiStatus.isRunning === false) {
      console.log('[LIME componentDidUpdate] isRunning changed from true to false');
      console.log('[LIME componentDidUpdate] modelId:', modelId, 'label:', label);
      // Clear any old polling interval if it exists
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.setState({ isRunning: false, isLabelEnabled: true });
      console.log('[LIME componentDidUpdate] About to call fetchNewValues');
      await this.fetchNewValues(modelId, label);
      console.log('[LIME componentDidUpdate] fetchNewValues completed');
      // If flow-based (predictionId present), fetch instance probabilities for pie chart
      const { predictionId: predictionIdParam } = getFlowParams();
      if (predictionIdParam && (!this.state.dataTableProbs || this.state.dataTableProbs.length === 0)) {
        try {
          const probs = await fetchInstanceProbs({ serverUrl: SERVER_URL, modelId });
          if (probs) {
            const malware = Number(probs.malware || 0);
            const normal = Number(probs.normal || Math.max(0, 1 - malware));
            const dataTableProbs = [
              { key: 0, label: 'Normal traffic', probability: normal.toFixed(6) },
              { key: 1, label: 'Malware traffic', probability: malware.toFixed(6) },
            ];
            const pieData = [
              { type: 'Normal', value: parseFloat((normal * 100).toFixed(2)) },
              { type: 'Malware', value: parseFloat((malware * 100).toFixed(2)) },
            ];
            this.setState({ dataTableProbs, pieData });
          }
        } catch (e) {
          // ignore errors fetching instance probs
        }
      }
    }

    // Check if limeValues state is updated and clear the interval if it is
    if (prevState.limeValues !== limeValues && limeValues.length > 0) {
      this.setState({ isLabelEnabled: true });
      clearInterval(this.intervalId);
    }

    if (prevState.sampleId !== sampleId || prevState.modelId !== modelId) {
      if (modelId) {
        const predictions = await requestPredictionsModel(modelId);
        this.setState({ predictions });
      } else {
        this.setState({ predictions: null });
      }
    }
  }

  // Pay attention to re-render
  shouldComponentUpdate(nextProps, nextState) {
    const { app, models, xaiStatus } = this.props;
    const { modelId, label, limeValues, positiveChecked, negativeChecked, maxDisplay, maskedFeatures, assistantLoading, assistantText } = this.state;
    return (
      app !== nextProps.app ||
      models !== nextProps.models ||
      modelId !== nextState.modelId ||
      label !== nextState.label ||
      limeValues !== nextState.limeValues ||
      xaiStatus.isRunning !== nextProps.xaiStatus.isRunning ||
      assistantLoading !== nextState.assistantLoading ||
      assistantText !== nextState.assistantText ||
      (limeValues === nextState.limeValues &&
        (positiveChecked !== nextState.positiveChecked ||
          negativeChecked !== nextState.negativeChecked ||
          maxDisplay !== nextState.maxDisplay ||
          maskedFeatures !== nextState.maskedFeatures))
    );
  }

  async handleLimeClick() {
    const { modelId, sampleId, maxDisplay } = this.state;
    const { predictionId: predictionIdParam } = getFlowParams();

    // Only fetch test-set predictions for non flow-based mode
    const predictions = predictionIdParam ? null : await requestPredictionsModel(modelId);

    this.setState({
      isRunning: true,
      limeValues: [],
      pieData: [],
      dataTableProbs: [],
      isLabelEnabled: false,
      predictions
    });

    console.log(`Building LIME values of the model ${modelId}`);
    
    // Use Redux action which handles queue-based processing
    // The saga will handle polling and updating status
    this.props.fetchRunLime(modelId, sampleId, maxDisplay);

    // TODO: refactor code ?
    try {
      const predictedProbsResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/probabilities`, {
        method: 'GET',
      });
      const predictedProbsData = await predictedProbsResponse.json();
      const predictedProbs = predictedProbsData.probs;
      const linesProbs = predictedProbs.split('\n');
      const dataProbs = linesProbs.slice(1).map(line => line.split(','));
      const yProbs = dataProbs.map(row => row.map(val => parseFloat(val)));

    let dataTableProbs = [];
    let pieData = [];
    if (modelId.startsWith('ac-')) {
      dataTableProbs = [
        {
          key: 0,
          label: 'Web',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][0].toFixed(6) : '-'
        },
        {
          key: 1,
          label: 'Interactive',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][1].toFixed(6) : '-'
        },
        {
          key: 2,
          label: 'Mail',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][2].toFixed(6) : '-'
        },
        {
          key: 3,
          label: 'File Transfer',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][3].toFixed(6) : '-'
        },
      ];

      pieData = sampleId ? yProbs[sampleId].map((prob, i) => {
        const percentage = parseFloat((prob * 100).toFixed(2));
        return {
          type: `${AC_OUTPUT_LABELS[i]}`,
          value: percentage,
        };
      }) : [];
    } else {
      dataTableProbs = [
        {
          key: 0,
          label: 'Normal traffic',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][0].toFixed(6) : '-'
        },
        {
          key: 1,
          label: 'Malware traffic',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][1].toFixed(6) : '-'
        }
      ];

      pieData = sampleId ? yProbs[sampleId].map((prob, i) => {
        const percentage = parseFloat((prob * 100).toFixed(2));
        return {
          type: `${AD_OUTPUT_LABELS[i]}`,
          value: percentage,
        };
      }) : [];
      }

      this.setState({
        pieData: pieData,
        dataTableProbs: dataTableProbs,
      });
    } catch (error) {
      console.error('[LIME] Error fetching predicted probabilities:', error);
      // Continue without probabilities - LIME can still work
    }
  }

  async fetchNewValues(modelId, label) {
    console.log('[LIME fetchNewValues] Called with modelId:', modelId, 'label:', label);
    const labelsList = getLabelsListXAI(this.state.modelId);
    const labelIndex = labelsList.indexOf(label);

    if (labelIndex === -1) {
      console.error(`[LIME fetchNewValues] Invalid label: ${label}, labelsList:`, labelsList);
      return;
    }

    const limeValuesUrl = `${LIME_URL}/explanations/${modelId}/${labelIndex}`;
    console.log('[LIME fetchNewValues] Fetching from:', limeValuesUrl);
    
    try {
      const limeValues = await fetch(limeValuesUrl).then(res => res.json());
      console.log(`[LIME fetchNewValues] Got LIME values:`, limeValues);

      if (JSON.stringify(limeValues) !== JSON.stringify(this.state.limeValues)) {
        console.log('[LIME fetchNewValues] Setting new LIME values in state');
        this.setState({ limeValues });
      } else {
        console.log('[LIME fetchNewValues] LIME values unchanged, skipping setState');
      }
    } catch (error) {
      console.error('[LIME fetchNewValues] Error fetching LIME values:', error);
    }
  }

  render() {
    const {
      modelId,
      sampleId,
      maxDisplay,
      positiveChecked,
      negativeChecked,
      maskedFeatures,
      isRunning,
      limeValues,
      pieData,
      dataTableProbs,
      predictions,
    } = this.state;
    const { app, models, } = this.props;
    console.log(app);

    const modelsOptions = getFilteredModelsOptions(app, models);
    const selectFeaturesOptions = getFilteredFeaturesOptions(app);
    const labelsList = isModelIdPresent ?
                        getLabelsListXAI(modelId) : getLabelsListAppXAI(app);
    const labelsOptions = labelsList
      .filter(label => label.trim() !== "")  // filter out empty or whitespace-only labels
      .map(label => ({
        value: label,
        label: label,
      }));

    // Check if this is from prediction context (either has predictionId or fromPrediction flag)
    const urlParams = new URLSearchParams(window.location.search);
    const isFlowBased = !!(urlParams.get('predictionId') || urlParams.get('fromPrediction'));
    
    let sampleTrueLabel = "";
    if (!isFlowBased && predictions && Number.isInteger(sampleId) && sampleId >= 0) {
      sampleTrueLabel = getTrueLabel(modelId, predictions, sampleId);
    }

    const pieConfig = {
      appendPadding: 10,
      data: pieData,
      angleField: 'value',
      colorField: 'type',
      color: ({ type }) => {
        // Check if the type indicates malware/attack (case-insensitive)
        const typeLower = String(type).toLowerCase();
        const isMalware = typeLower.includes('malware') || 
                         typeLower.includes('attack') || 
                         typeLower.includes('ddos') ||
                         typeLower.includes('malicious') ||
                         type === '1';
        const color = isMalware ? '#ff4d4f' : '#1890ff';
        console.log('[Pie Color]', { type, typeLower, isMalware, color });
        return color;
      },
      radius: 1,
      label: {
        type: 'inner',
        offset: '-50%',
        content: '{value}%',
        style: {
          textAlign: 'center',
          fontSize: 18,
          fill: '#fff',
        },
        autoRotate: false,
      },
      interactions: [{ type: 'element-highlight' }],
    };

    //const sortedValuesLime = limeValues.slice().sort((a, b) => b.value - a.value);
    //const notZeroSortedValuesLime = sortedValuesLime.filter(d => d.value !== 0);
    const filteredValuesLime = limeValues.filter((d) => {
      if (d.value > 0 && positiveChecked) return true;
      if (d.value < 0 && negativeChecked) return true;
      return false;
    });

    const filteredMaskedValuesLime = filteredValuesLime.filter(obj =>
      !maskedFeatures.some(feature => obj.feature.includes(feature)));
    //console.log(filteredMaskedValuesLime);

    const limeValuesBarConfig = {
      data: filteredMaskedValuesLime.slice(0, maxDisplay),
      isStack: true,
      xField: 'value',
      yField: 'feature',
      //seriesField: "value",
      label: false,
      color: (d) => {
        return d.value > 0 ? "#0693e3" : "#EB144C";
      },
      barStyle: (d) => {
        //console.log(d)
        return {
          /* https://casesandberg.github.io/react-color/ */
          //color: d.value > 0 ? "#0693e3" : "#EB144C",
          fill: d.value > 0 ? "#0693e3" : "#EB144C"
        };
      },
      legend: false,
      tooltip: {
        showMarkers: false,
        customItems: (items) => {
          return items.map((it) => {
            const val = it?.data?.value ?? 0;
            return {
              ...it,
              color: val > 0 ? '#0693e3' : '#EB144C',
            };
          });
        },
      },
      interactions: [],
    };

    const subTitle = isModelIdPresent ?
      `LIME explanations of the model ${modelId}` :
      'LIME explanations of models';

    return (
      <LayoutPage pageTitle="Explainable AI with Local Interpretable Model-Agnostic Explanations (LIME)"
        pageSubTitle={subTitle}>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        <Card style={{ marginBottom: 16 }}>
          <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600 }}>
          <Form.Item name="model" label={<strong><span style={{ color: 'red' }}>* </span>Model</strong>}
            style={{ flex: 'none', marginBottom: 10 }}
          >
            <Tooltip title="Select a model to perform LIME method.">
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
                    limeValues: [],
                    pieData: [],
                    dataTableProbs: [],
                    isLabelEnabled: false,
                    predictions: null,
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
          <Form.Item label={<strong>Sample ID</strong>} style={{ marginBottom: 10 }}>
            <div style={{ display: 'inline-flex' }}>
              <Form.Item label="id" name="id" noStyle>
                <Tooltip title="Select a sample to be explained.">
                  {/* TODO: get errors if remove the number on form */}
                  <InputNumber min={1} defaultValue={6}
                    value={this.state.sampleId}
                    onChange={v => this.setState({
                      sampleId: v,
                      limeValues: [],
                      pieData: [],
                      dataTableProbs: [],
                      isLabelEnabled: false
                    })}
                  />
                </Tooltip>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item name="slider" label={<strong>Features to display</strong>}
            style={{ marginBottom: -5 }}>
            <Slider
              marks={XAI_SLIDER_MARKS}
              min={1} max={30} defaultValue={maxDisplay}
              value={maxDisplay}
              onChange={v => this.setState({ maxDisplay: v })}
            />
          </Form.Item>
          <Form.Item name="checkbox" label={<strong>Contributions to display</strong>}
            valuePropName="checked"
            style={{ flex: 'none', marginBottom: 10 }}>
            <Checkbox.Group
              options={['Positive', 'Negative']}
              defaultValue={['Positive', 'Negative']}
              onChange={this.handleContributionsChange}
            />
          </Form.Item>
          <Form.Item name="select" label={<strong>Feature(s) to mask</strong>}
            style={{ flex: 'none', marginBottom: 10 }}>
            <Select
              mode="multiple"
              style={{
                width: '100%',
              }}
              allowClear
              placeholder="Select feature(s) ..."
              onChange={v => this.setState({ maskedFeatures: v })}
              optionLabelProp="label"
              options={selectFeaturesOptions}
            />
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Button type="primary"
              onClick={this.handleLimeClick}
              disabled={isRunning || !this.state.modelId}
              loading={isRunning}
            >
              LIME Explain
            </Button>
            <Tooltip title={!this.props.userRole?.isSignedIn ? "Sign in to use AI Assistant" : 
                           this.props.userRole?.tokenLimitReached ? "Token limit reached" : 
                           "Get AI explanation of LIME results"}>
              <Button 
                style={{ marginLeft: 8 }} 
                htmlType="button" 
                type="primary"
                onClick={() => this.handleAskAssistantLime()}
                disabled={!this.state.modelId || this.state.limeValues.length === 0 || 
                         !this.props.userRole?.isSignedIn || 
                         this.props.userRole?.tokenLimitReached}
                loading={this.state.assistantLoading}
              >
                Ask Assistant
              </Button>
            </Tooltip>
          </div>
          </Form>
        </Card>

        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>LIME Explanations</h2>
        </Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>LIME Explanation</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Local model explanation showing feature contributions to the prediction
                </span>
              </div>
              {limeValuesBarConfig && (
                <Bar {...limeValuesBarConfig} onReady={(bar) => (barLime = bar)} />
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ marginBottom: 16, height: 'fit-content' }}>
              <div style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Prediction - Sample ID {sampleId}</h3>
                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                  Model's predicted probabilities for normal and malicious traffic classes
                </span>
              </div>
              {!isFlowBased && sampleTrueLabel && (() => {
                const isMalware = sampleTrueLabel.toLowerCase().includes('malware') || sampleTrueLabel === '1';
                const bgColor = isMalware ? '#fff1f0' : '#f0f5ff';
                const borderColor = isMalware ? '#ffccc7' : '#d6e4ff';
                const textColor = isMalware ? '#ff4d4f' : '#1890ff';
                return (
                  <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: bgColor, borderRadius: '4px', border: `1px solid ${borderColor}` }}>
                    <Typography.Text style={{ fontSize: '13px', color: textColor }}>
                      <strong>Ground Truth:</strong> {sampleTrueLabel}
                    </Typography.Text>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {pieConfig && (
                  <>
                    <div style={{ flex: '0 0 33.33%' }}>
                      <Table
                        columns={COLUMNS_TABLE_PROBS}
                        dataSource={dataTableProbs}
                        pagination={false}
                        size="small"
                      />
                    </div>
                    <div style={{ flex: '0 0 66.67%', display: 'flex', justifyContent: 'center' }}>
                      <Pie {...pieConfig} />
                    </div>
                  </>
                )}
              </div>
            </Card>
            
            {/* AI Assistant Explanation Card - Right Side */}
            {(this.state.assistantText || this.state.assistantLoading) && (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>AI Assistant Explanation</h3>
                  <span style={{ fontSize: '13px', color: '#8c8c8c' }}>
                    AI-generated explanation of the LIME results to help interpret the model's decision
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
                            <> - <strong>Total:</strong> {this.state.assistantTokenInfo.totalUsed.toLocaleString()}/{this.state.assistantTokenInfo.limit.toLocaleString()} 
                            ({this.state.assistantTokenInfo.percentUsed}% used) - <strong>Remaining:</strong> {this.state.assistantTokenInfo.remaining.toLocaleString()} tokens</>
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
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(requestRunLime({ modelId, sampleId, numberFeatures })),
});

// HOC to inject userRole
const XAILimePageWithUserRole = (props) => {
  const userRole = useUserRole();
  return <XAILimePage {...props} userRole={userRole} />;
};

export default connect(mapPropsToStates, mapDispatchToProps)(XAILimePageWithUserRole);