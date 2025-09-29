import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Modal } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar, Pie } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
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
      assistantModalVisible: false,
      assistantText: '',
      assistantLoading: false,
    };
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleLimeClick = this.handleLimeClick.bind(this);
  }

  handleAskAssistantLime = async () => {
    const { modelId, label, limeValues, dataTableProbs, pieData, sampleId } = this.state;
    if (!modelId || !limeValues || limeValues.length === 0) return;
    this.setState({ assistantModalVisible: true, assistantLoading: true, assistantText: '' });
    try {
      const context = { dataTableProbs, pieData, sampleId };
      const resp = await requestAssistantExplainXAI({
        method: 'lime',
        modelId,
        label,
        explanation: limeValues,
        context,
      });
      console.log('Assistant (LIME) response:', resp);
      const text = resp && typeof resp.text === 'string' ? resp.text : '';
      this.setState({ assistantText: text || 'Assistant returned no content.', assistantLoading: false });
    } catch (e) {
      this.setState({ assistantText: `Error: ${e.message || String(e)}` , assistantLoading: false });
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
      console.log('isRunning has been changed from true to false');
      this.setState({ isRunning: false, isLabelEnabled: true });
      await this.fetchNewValues(modelId, label);
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
    const { modelId, label, limeValues, positiveChecked, negativeChecked, maxDisplay, maskedFeatures, assistantModalVisible, assistantLoading, assistantText } = this.state;
    return (
      app !== nextProps.app ||
      models !== nextProps.models ||
      modelId !== nextState.modelId ||
      label !== nextState.label ||
      limeValues !== nextState.limeValues ||
      xaiStatus.isRunning !== nextProps.xaiStatus.isRunning ||
      assistantModalVisible !== nextState.assistantModalVisible ||
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
    const limeConfig = {
      "modelId": modelId,
      "sampleId": sampleId,
      "numberFeature": maxDisplay,
    };

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

    // Choose endpoint: flow-based when predictionId is provided
    const isFlowBased = !!predictionIdParam;
    const endpoint = isFlowBased ? `${LIME_URL}/flow` : LIME_URL;
    const payload = isFlowBased
      ? { limeFlowConfig: { modelId, predictionId: predictionIdParam, sessionId: sampleId, numberFeature: maxDisplay } }
      : { limeConfig };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    console.log(`Building LIME values of the model ${modelId}`);
    //console.log(JSON.stringify(data));
    this.intervalId = setInterval(() => { // start interval when button is clicked
      this.props.fetchXAIStatus();
    }, 1000);

    // TODO: refactor code ?
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
          label: 'Video',
          probability: sampleId && yProbs[sampleId] ? yProbs[sampleId][2].toFixed(6) : '-'
        }
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

  }

  async fetchNewValues(modelId, label) {
    const labelsList = getLabelsListXAI(this.state.modelId);
    const labelIndex = labelsList.indexOf(label);

    if (labelIndex === -1) {
      console.error(`Invalid label: ${label}`);
      return;
    }

    const limeValuesUrl = `${LIME_URL}/explanations/${modelId}/${labelIndex}`;
    const limeValues = await fetch(limeValuesUrl).then(res => res.json());
    console.log(`Get new LIME values of the model ${modelId} for label ${label} (index ${labelIndex}) from server`);
    //console.log(JSON.stringify(limeValues));

    // Update state only if new data is different than old data
    if (JSON.stringify(limeValues) !== JSON.stringify(this.state.limeValues)) {
      this.setState({ limeValues });
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

    const isFlowBased = !!(new URLSearchParams(window.location.search).get('predictionId'));
    let sampleTrueLabel = "";
    if (!isFlowBased && predictions && Number.isInteger(sampleId) && sampleId >= 0) {
      sampleTrueLabel = getTrueLabel(modelId, predictions, sampleId);
    }

    const pieConfig = {
      appendPadding: 10,
      data: pieData,
      angleField: 'value',
      colorField: 'type',
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
          <h1 style={{ fontSize: '24px' }}>LIME Parameters</h1>
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
                    predictions: null
                  });
                  console.log(`Select model ${value}`);
                }}
                options={modelsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item label="Sample ID" style={{ marginBottom: 10 }}>
            <div style={{ display: 'inline-flex' }}>
              <Form.Item label="id" name="id" noStyle>
                <Tooltip title="Select a sample to be explained.">
                  {/* TODO: get errors if remove the number on form */}
                  <InputNumber min={1} defaultValue={5}
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
          <Form.Item name="slider" label="Features to display"
            style={{ marginBottom: -5 }}>
            <Slider
              marks={XAI_SLIDER_MARKS}
              min={1} max={30} defaultValue={maxDisplay}
              value={maxDisplay}
              onChange={v => this.setState({ maxDisplay: v })}
            />
          </Form.Item>
          <Form.Item name="checkbox" label="Contributions to display"
            valuePropName="checked"
            style={{ flex: 'none', marginBottom: 10 }}>
            <Checkbox.Group
              options={['Positive', 'Negative']}
              defaultValue={['Positive', 'Negative']}
              onChange={this.handleContributionsChange}
            />
          </Form.Item>
          <Form.Item name="select" label="Feature(s) to mask"
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
            <Button type="primary" //>icon={<UserOutlined />}
              onClick={this.handleLimeClick}
              disabled={isRunning || !this.state.modelId}
              >LIME Explain
              {isRunning && (
                <Spin size="small" style={{ marginLeft: 8 }} />
              )}
            </Button>
            <Button style={{ marginLeft: 8 }} htmlType="button" type="primary"
              onClick={() => this.handleAskAssistantLime()}
              disabled={!this.state.modelId || this.state.limeValues.length === 0}
            >Ask Assistant
            </Button>
          </div>
        </Form>

        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>LIME Explanations</h1>
        </Divider>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={BOX_STYLE}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2>&nbsp;&nbsp;&nbsp;Local Explanation - Sample ID {sampleId}</h2>
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <Tooltip title="Download plot as png">
                    <Button
                      type="link" icon={<CameraOutlined />}
                      style={{ marginLeft: '15rem' }}
                      onClick={downloadLimeImage}
                    />
                  </Tooltip>
                  <Tooltip title="Local interpretability plot displays each most important feature's contributions for this specific sample.">
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
                  {labelsList.map((header) => (
                    <Option key={header} value={header}>
                      {header}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
              {limeValuesBarConfig && (
                <Bar {...limeValuesBarConfig} onReady={(bar) => (barLime = bar)}/>
              )}
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={BOX_STYLE}>
              <h2>&nbsp;&nbsp;&nbsp;Prediction - Sample ID {sampleId} { !isFlowBased ? `(ground truth: ${sampleTrueLabel})` : '' }</h2>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {pieConfig && (
                  <>
                    <Table
                      columns={COLUMNS_TABLE_PROBS}
                      dataSource={dataTableProbs}
                      pagination={false}
                      style={{ marginLeft: '10px', marginRight: '10px', marginTop: '-50px', width: '280px' }}
                    />
                    <div style={{ width: '400px', marginRight: '10px', marginTop: '-50px' }}>
                      <Pie {...pieConfig} />
                      <div style={{ position: 'absolute', top: 10, right: 10 }}>
                        <Tooltip title="Shows predicted probability for each sample.">
                          <Button type="link" icon={<QuestionOutlined />} />
                        </Tooltip>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Col>
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

const mapPropsToStates = ({ app, models, model, xaiStatus }) => ({
  app, models, model, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(requestRunLime({ modelId, sampleId, numberFeatures })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAILimePage);