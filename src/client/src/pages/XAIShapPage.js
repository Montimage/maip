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
import {
  getFilteredModelsOptions,
  getFilteredFeatures,
  getLastPath,
  getFilteredFeaturesOptions,
  getNumberFeatures,
  getLabelsOptions,
} from "../utils";
import {
  FORM_LAYOUT, BOX_STYLE,
  FEATURES_DESCRIPTIONS,
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
      label: null,
      numberSamples: 10,
      maxDisplay: 10,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
      isRunning: props.xaiStatus.isRunning,
      shapValues: [],
    };
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleShapClick = this.handleShapClick.bind(this);
  }

  componentDidMount() {
    const modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels(); 
    //await this.fetchNewValues(this.state.modelId, this.state.label);
  }

  handleContributionsChange(checkedValues) {
    const positiveChecked = checkedValues.includes('Positive');
    const negativeChecked = checkedValues.includes('Negative');
    this.setState({ positiveChecked, negativeChecked });
  };

  // Pay attention to re-render
  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.props.app !== nextProps.app ||
      this.props.models !== nextProps.models ||
      this.state.modelId !== nextState.modelId ||
      this.state.label !== nextState.label ||
      this.state.shapValues !== nextState.shapValues ||
      this.props.xaiStatus.isRunning !== nextProps.xaiStatus.isRunning ||
      (this.state.limeValues === nextState.limeValues &&
        (this.state.positiveChecked !== nextState.positiveChecked ||
          this.state.negativeChecked !== nextState.negativeChecked ||
          this.state.maxDisplay !== nextState.maxDisplay ||
          this.state.maskedFeatures !== nextState.maskedFeatures))
    );
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId, label } = this.state;

    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      // TODO: how to reset the current state when changing app
      this.setState({
        modelId: null,
        label: "Web",
        numberSamples: 10,
        maxDisplay: 10,
        positiveChecked: true,
        negativeChecked: true,
        maskedFeatures: [], 
      });
    }

    if (prevState.modelId !== this.state.modelId) {
      this.setState({ shapValues: [] }); 
    }

    if (prevState.label !== this.state.label) {
      await this.fetchNewValues(modelId, label);
    }

    if (prevProps.xaiStatus.isRunning !== this.props.xaiStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.xaiStatus.isRunning });
      if (!this.props.xaiStatus.isRunning) {
        console.log('isRunning changed from True to False');
        await this.fetchNewValues(modelId, label);  
      }
    }

    // Check if shapValues state is updated and clear the interval if it is
    if (prevState.shapValues !== this.state.shapValues && this.state.shapValues.length > 0) {
      clearInterval(this.intervalId);
    }
  }

  async handleShapClick() {
    const { modelId, numberSamples, maxDisplay, isRunning } = this.state;
    const shapConfig = {
      "modelId": modelId,
      "numberSamples": numberSamples,
      "maxDisplay": maxDisplay,
    };
    if (!isRunning) {
      console.log("update isRunning state!");
      this.setState({ isRunning: true });        
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
  }

  async fetchNewValues(modelId, label) {
    const labelsOptions = modelId.includes('ac-') ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
    const labelIndex = labelsOptions.indexOf(label);

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
      label,
      maxDisplay, 
      positiveChecked,
      negativeChecked,
      maskedFeatures,
      isRunning,
      shapValues,
    } = this.state;
    console.log(`XAI isRunning: ${isRunning}`);
    const { app, models } = this.props;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const features = getFilteredFeatures(app);
    const selectFeaturesOptions = getFilteredFeaturesOptions(app);
    const numberFeatures = getNumberFeatures(app);
    const labelsOptions = getLabelsOptions(modelId);
    
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
      barStyle: (d) => {
        //console.log(d)
        return {
          fill: d.importance_value > 0 ? "#0693e3" : "#EB144C"
        };
      },
      interactions: [{ type: 'element-active' }],
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
              <Tooltip title="Select a model to perform attacks.">
                <Select placeholder="Select a model ..."
                  style={{ width: '100%' }}
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
          <Form.Item label="Explained samples" style={{ marginBottom: 10 }} > 
            <div style={{ display: 'inline-flex' }}>
              <Form.Item label="bg" name="bg" noStyle>
                <InputNumber min={1} defaultValue={10} 
                  value={this.state.numberSamples}
                  onChange={v => this.setState({ numberSamples: v })}
                />
              </Form.Item>
            </div>
          </Form.Item>
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
            <Button type="primary" //>icon={<UserOutlined />}
              onClick={this.handleShapClick} disabled={isRunning || !this.state.modelId}
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
                <h2>&nbsp;&nbsp;&nbsp;Feature Importances</h2>
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
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 200, marginTop: '10px', marginBottom: '10px' }}
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
          <Col span={12} style={{ marginTop: "24px" }}>
            <div style={BOX_STYLE}>
              <h2>&nbsp;&nbsp;&nbsp;Feature Dependence</h2>
            </div>
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
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunShap: (modelId, numberSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberSamples, maxDisplay })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIShapPage);