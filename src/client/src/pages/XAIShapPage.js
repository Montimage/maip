import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography } from 'antd';
import { UserOutlined, DownloadOutlined, QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestRunShap,
  requestXAIStatus,
  requestShapValues,
} from "../actions";
import {
  FEATURES_DESCRIPTIONS,
  SERVER_URL,
} from "../constants";
const SHAP_URL = `${SERVER_URL}/api/xai/shap`;
const style = {
  //background: '#0092ff',
  padding: '10px 0',
  border: '1px solid black',
};

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

let barShap;

const downloadShapImage = () => { barShap?.downloadImage(); };
//const toDataURL = () => { console.log(barShap?.toDataURL()); };

class XAIShapPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sampleId: 20,
      numberSamples: 10,
      maxDisplay: 10,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
      isRunning: props.xaiStatus.isRunning,
      shapValues: [],
    };
    this.handleRandomClick = this.handleRandomClick.bind(this);
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleMaskedFeatures = this.handleMaskedFeatures.bind(this);  
    this.handleShapClick = this.handleShapClick.bind(this);
  }

  onSliderChange(newVal) {
    this.setState({ maxDisplay: newVal });
  }
  
  onSampleIdChange(newId) {
    this.setState({ sampleId: newId });
  }

  onNumberSamplesChange(newVal) {
    this.setState({ numberSamples: newVal });
  }

  handleRandomClick() {
    const randomVal = Math.floor(Math.random() * 100);
    console.log(randomVal.toString());
    this.setState({ sampleId: randomVal });
  };

  handleContributionsChange(checkedValues) {
    const positiveChecked = checkedValues.includes('Positive');
    const negativeChecked = checkedValues.includes('Negative');
    this.setState({ positiveChecked, negativeChecked });
  };

  handleMaskedFeatures(values) {
    this.setState({ maskedFeatures: values });
  };

  shouldComponentUpdate(nextProps, nextState) {
    return (
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
    const modelId = getLastPath();
    const { isRunning } = this.state;
    const { xaiStatus } = this.props;
    
    if (prevProps.xaiStatus.isRunning !== this.props.xaiStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.xaiStatus.isRunning });
      if (!this.props.xaiStatus.isRunning) {
        console.log('isRunning changed from True to False');
        await this.fetchNewValues(modelId);  
      }
    }

    // Check if shapValues state is updated and clear the interval if it is
    if (prevState.shapValues !== this.state.shapValues && this.state.shapValues.length > 0) {
      clearInterval(this.intervalId);
    }
  }

  async handleShapClick() {
    const { numberSamples, maxDisplay, isRunning, shapValuesBarConfig } = this.state;
    const modelId = getLastPath();
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

  async fetchNewValues(modelId) {
    const shapValuesUrl = `${SHAP_URL}/explanations/${modelId}`;
    const shapValues = await fetch(shapValuesUrl).then(res => res.json());
    console.log(`Get new SHAP values of the model ${modelId} from server`);
    //console.log(JSON.stringify(shapValues));
    // Update state only if new data is different than old data
    if (JSON.stringify(shapValues) !== JSON.stringify(this.state.shapValues)) {
      this.setState({ shapValues });
    }
  }

  render() {
    const modelId = getLastPath();
    const { 
      sampleId,
      numberSamples,
      maxDisplay, 
      positiveChecked,
      negativeChecked,
      maskedFeatures,
      isRunning,
      shapValues,
    } = this.state;
    console.log(`XAI isRunning: ${isRunning}`);
    const {
      xaiStatus, 
    } = this.props;

    const features = shapValues.map(obj => obj.feature).sort();
    const selectFeaturesOptions = features.map((label, index) => ({
      value: label, label,
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
      description: FEATURES_DESCRIPTIONS[item.feature] || 'N/A',
    }));
    //console.log(topFeatures);
    
    const columnsTopFeatures = [
      {
        title: 'ID',
        dataIndex: 'key',
        key: 'key',
        sorter: (a, b) => a.key - b.key,
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
      },
    ];

    return (
      <LayoutPage pageTitle="Explainable AI with SHapley Additive exPlanations (SHAP)" pageSubTitle={`Model ${modelId}`}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>SHAP Parameters</h1>
        </Divider>
        <Form
        {...layout}
        name="control-hooks"
        style={{
          maxWidth: 600,
        }}
        >
          <Form.Item label="Background samples" style={{ marginBottom: 10 }} > 
            <div style={{ display: 'inline-flex' }}>
              <Form.Item label="bg" name="bg" noStyle>
                <InputNumber min={1} defaultValue={10} 
                  onChange={(e) => this.onNumberSamplesChange(e)} 
                />
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item name="slider" label="Features to display"
            style={{ marginBottom: -5 }}
          >
            <Slider
              marks={{
                1: '1',
                5: '5',
                10: '10',
                15: '15',
                20: '20',
                25: '25',
                30: '30',
              }}
              min={1} max={30} defaultValue={maxDisplay}
              value={maxDisplay}
              onChange={(value) => this.onSliderChange(value)}
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
              placeholder="Select ..."
              onChange={this.handleMaskedFeatures}
              optionLabelProp="label"
              options={selectFeaturesOptions}
            />
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Button icon={<UserOutlined />}
              onClick={this.handleShapClick} disabled={isRunning}
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
            <div style={style}>
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
              <Typography.Title level={4} style={{ textAlign: 'center', fontSize: '16px' }}>
                Average impact on predicted Malware traffic <br />
              </Typography.Title>
              <center>(Total number of features: {Object.keys(FEATURES_DESCRIPTIONS).length - 3})</center>
              {shapValuesBarConfig && (
                <Bar {...shapValuesBarConfig} onReady={(bar) => (barShap = bar)}/>
              )}
              <Typography.Title level={4} style={{ textAlign: 'center', fontSize: '16px', marginTop: '10px' }}>
                Mean absolute SHAP value
              </Typography.Title>
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;{`Top ${maxDisplay} most important features`}</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={`Displays the top ${maxDisplay} most important features with detailed description.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table dataSource={topFeatures} columns={columnsTopFeatures} 
                size="small" style={{ marginTop: '20px', marginBottom: 0 }}
              />
            </div>
          </Col>
          <Col span={12} style={{ marginTop: "24px" }}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Feature Dependence</h2>
            </div>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ xaiStatus }) => ({
  xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunShap: (modelId, numberSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberSamples, maxDisplay })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIShapPage);