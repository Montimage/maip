import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select } from 'antd';
import { UserOutlined, DownloadOutlined, QuestionOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestRunShap,
  requestXAIStatus,
  requestShapValues,
} from "../actions";

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

let barShap, barLime;
let intervalXAI;

const downloadShapImage = () => { barShap?.downloadImage(); };
//const toDataURL = () => { console.log(barShap?.toDataURL()); };

const onFinish = (values) => {
  console.log(values);
};

const onChange = (values) => {
  console.log(values);
};

class XAIPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sampleId: 20,
      numberSamples: 10,
      maxDisplay: 30,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
    };
    this.handleRandomClick = this.handleRandomClick.bind(this);
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleMaskedFeatures = this.handleMaskedFeatures.bind(this);
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

  handleContributionsChange(checkedValues){
    const positiveChecked = checkedValues.includes('Positive');
    const negativeChecked = checkedValues.includes('Negative');
    this.setState({ positiveChecked, negativeChecked });
  };

  handleMaskedFeatures(values){
    console.log(`Masked features ${values}`);
    this.setState({ maskedFeatures: values });
  };

  componentDidMount() {
    let modelId = getLastPath();
    console.log(modelId);
    this.props.fetchShapValues(modelId);
    this.props.fetchXAIStatus();
  }

  componentWillUnmount() {
    clearInterval(this.xaiStatusTimer);
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
    } = this.state;
    const {
      shapValues,
      xaiStatus, 
    } = this.props;
    console.log(xaiStatus);

    const features = shapValues.map(obj => obj.feature).sort();
    console.log(features);
    const selectFeaturesOptions = features.map((label, index) => ({
      value: label, label,
    }));

    /* TODO: wait for the XAI method process finishes and auto display new plots? */
    if (!xaiStatus.isRunning) {
      //clearInterval(intervalXAI);
      //setInterval(null);
      const filteredMaskedShap = shapValues.filter(obj => 
        !maskedFeatures.some(feature => obj.feature.includes(feature)));
      //console.log(filteredMaskedShap);

      const shapValuesBarConfig = {
        data: filteredMaskedShap.slice(0, maxDisplay),
        isStack: true,
        xField: 'importance_value',
        yField: 'feature',
        seriesField: 'type',
        label: false,
        geometry: 'interval',
        interactions: [{ type: 'zoom' }],
      };

      return (
        <LayoutPage pageTitle="XAI Page" pageSubTitle={`Model ${modelId}`}>
          <Divider orientation="left"><h3>Parameters</h3></Divider>
          <Form
          {...layout}
          name="control-hooks"
          onFinish={onFinish}
          style={{
            maxWidth: 600,
          }}
          >
            {/* TODO: display value of slider (really need?), space between Slide and Checkbox is large? */}
            <Form.Item name="slider" label="Features to display" 
              style={{ marginBottom: 10 }}>
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
              style={{ flex: 'none', marginBottom: 10 }}>
              <Checkbox.Group 
                options={['Positive', 'Negative']}
                defaultValue={['Positive', 'Negative']}
                onChange={this.handleContributionsChange} 
              />
            </Form.Item>
            <Form.Item name="select" label="Features to mask" 
              style={{ flex: 'none', marginBottom: 10 }}>
              <Select
                mode="multiple"
                style={{
                  width: '100%',
                }}
                allowClear
                placeholder="Select a feature"
                onChange={this.handleMaskedFeatures}
                optionLabelProp="label"
                options={selectFeaturesOptions}
              />
            </Form.Item>
          </Form>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              <Divider orientation="left"><h3>SHAP Explanations</h3></Divider>
              <Form.Item label="Background samples" style={{ marginBottom: 10 }}>
                <div style={{ display: 'inline-flex' }}>
                  <Form.Item label="bg" name="bg" noStyle>
                    <InputNumber min={1} defaultValue={10} 
                      onChange={(e) => this.onNumberSamplesChange(e)} 
                    />
                  </Form.Item>
                  <Button icon={<UserOutlined />}
                    onClick={() => {
                      console.log([modelId, sampleId, numberSamples, maxDisplay]);
                      this.props.fetchRunShap(
                        modelId, numberSamples, maxDisplay,
                      );
                    }}
                    >SHAP Explain
                  </Button>
                </div>  
              </Form.Item>
              <div style={style}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <h2>&nbsp;&nbsp;&nbsp;Feature Importance</h2>
                  <Button type="button" icon={<DownloadOutlined />}
                    style={{ marginLeft: '30rem' }}
                    titleDelay={50}
                    title="Download plot as png" 
                    onClick={downloadShapImage} 
                  />
                  <Button type="button" icon={<QuestionOutlined />}
                    titleDelay={50}
                    title="Feature importance plot displays the sum of individual contributions, computed on the complete dataset."
                  />
                </div>
                {/* <button type="button" onClick={toDataURL}>
                  Get base64
                </button> */}
                &nbsp;&nbsp;&nbsp;
                <Bar {...shapValuesBarConfig} onReady={(bar) => (barShap = bar)}/>
              </div>
            </Col>
          </Row>
        </LayoutPage>
      );
    } else {
      /* intervalXAI = setInterval(() => {
        this.props.fetchXAIStatus();
      }, 10000); */
      return (
        <LayoutPage pageTitle="XAI Page" pageSubTitle={`Model ${modelId}`}>
          <Divider orientation="left"><h3>Parameters</h3></Divider>
          <Form
          {...layout}
          name="control-hooks"
          onFinish={onFinish}
          style={{
            maxWidth: 600,
          }}
          >
            {/* TODO: display value of slider (really need?), space between Slide and Checkbox is large? */}
            <Form.Item name="slider" label="Features to display" style={{ marginBottom: 10 }}>
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
            <Form.Item name="checkbox" label="Contributions to display" style={{ flex: 'none', marginBottom: 10 }}>
              <Checkbox.Group 
                options={['Positive', 'Negative']}
                /* TODO: checked values did not display correctly */
                /* defaultValue={['Positive', 'Negative']} */
                onChange={this.handleContributionsChange} 
              />
            </Form.Item>
          </Form>
          
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              <Divider orientation="left"><h3>SHAP Explanations</h3></Divider>
              <Form.Item label="Background samples" style={{ marginBottom: 10 }}>
                <div style={{ display: 'inline-flex' }}>
                  <Form.Item label="bg" name="bg" noStyle>
                    <InputNumber min={1} defaultValue={10} 
                      onChange={(e) => this.onNumberSamplesChange(e)} 
                    />
                  </Form.Item>
                  <Button icon={<UserOutlined />}
                    onClick={() => {
                      console.log([modelId, sampleId, numberSamples, maxDisplay]);
                      this.props.fetchRunShap(
                        modelId, numberSamples, maxDisplay,
                      );
                    }}
                    >SHAP Explain
                  </Button>
                </div>    
            </Form.Item>
          </Col>
        </Row>
        </LayoutPage>
      );
    }
  }
}

const mapPropsToStates = ({ shapValues, xaiStatus }) => ({
  shapValues, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunShap: (modelId, numberSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberSamples, maxDisplay })),
  fetchShapValues: (modelId) => dispatch(requestShapValues(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);