import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Spin } from 'antd';
import { RedoOutlined, UserOutlined, DownloadOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestRunShap,
  requestRunLime,
  requestXAIStatus,
  requestShapValues,
  requestLimeValues,
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
const downloadLimeImage = () => { barLime?.downloadImage(); };
const toDataURL = () => { console.log(barShap?.toDataURL()); };

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
      positiveChecked: false,
      negativeChecked: false,
    };
    this.handleRandomClick = this.handleRandomClick.bind(this);
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
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

  componentDidMount() {
    let modelId = getLastPath();
    console.log(modelId);
    this.props.fetchShapValues(modelId);
    this.props.fetchLimeValues(modelId);
    this.props.fetchXAIStatus();
    /* this.xaiStatusTimer = setInterval(() => {
      this.props.fetchXAIStatus();
    }, 3000); */
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
    } = this.state;
    const { 
      shap, 
      lime,
      xaiStatus, 
    } = this.props;
    console.log(xaiStatus);

    /* TODO: wait for the XAI method process finishes and auto display new plots? */
    if (!xaiStatus.isRunning) {
      //clearInterval(intervalXAI);
      //setInterval(null);
      const sortedLime = lime.slice().sort((a, b) => b.value - a.value);
      const notZeroSortedLime = sortedLime.filter(d => d.value !== 0);
      const filteredLime = notZeroSortedLime.filter((d) => {
        if (d.value > 0 && positiveChecked) return true;
        if (d.value < 0 && negativeChecked) return true;
        return false;
      });

      const shapBarConfig = {
        data: shap.slice(0, maxDisplay),
        isStack: true,
        xField: 'importance_value',
        yField: 'feature',
        seriesField: 'type',
        label: false,
        geometry: 'interval',
        interactions: [{ type: 'zoom' }],
      }; 
      const limeBarConfig = {
        data: filteredLime.slice(0, maxDisplay),
        isStack: true,
        xField: 'value',
        yField: 'feature',
        seriesField: 'type',
        label: false,
        /* TODO: check why bars color is not changed */
        barStyle: {
          fill: (d) => (d.value > 0 ?'#37D67A' : '#1890FF')
        },
        meta: {
          value: {
            min: Math.min(...filteredLime.map((d) => d.value)),
            max: Math.max(...filteredLime.map((d) => d.value))
          }
        },
        geometry: 'interval',
        interactions: [{ type: 'zoom' }],
      };

      return (
        <LayoutPage pageTitle="XAI Page" pageSubTitle="">
          <Divider orientation="left"><h2>Parameters</h2></Divider>
          <Form
          {...layout}
          name="control-hooks"
          onFinish={onFinish}
          style={{
            maxWidth: 600,
          }}
          >
            <Form.Item label="Sample ID" style={{ marginBottom: 10 }}>
              <div style={{ display: 'inline-flex' }}>
                <Form.Item label="id" name="id" noStyle>
                  <InputNumber min={1} defaultValue={sampleId}
                    onChange={(e) => this.onSampleIdChange(e)}
                  />
                </Form.Item>
                {/* TODO: click button doesn't change value of InputNumber? */}
                <Button icon={<RedoOutlined />} 
                  type="text" bordered={false} 
                  /* onClick={this.handleRandomClick} */
                  onClick={() => {
                    this.handleRandomClick();
                    console.log([modelId, sampleId, maxDisplay]);
                    this.props.fetchRunLime(
                      modelId,
                      sampleId,
                      maxDisplay,
                    );
                  }}
                />
              </div>  
            </Form.Item>
            <Form.Item label="Background samples" style={{ marginBottom: 10 }}>
              <Form.Item label="bg" name="bg" noStyle>
                <InputNumber min={1} defaultValue={10} 
                  onChange={(e) => this.onNumberSamplesChange(e)} 
                />
              </Form.Item>
            </Form.Item>
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
            <Form.Item name="explain" style={{ marginBottom: 10, marginLeft: 100 }}>
              <Button icon={<UserOutlined />}
                onClick={() => {
                  console.log([modelId, numberSamples, maxDisplay]);
                  this.props.fetchRunShap(
                    modelId,
                    numberSamples,
                    maxDisplay,
                  );
                }}
              >Explain</Button>
            </Form.Item>
          </Form>
          <Divider orientation="left"><h2>Explanations</h2></Divider>
            <Row gutter={24}>
              <Col className="gutter-row" span={12}>
                <div style={style}>
                  <h2>&nbsp;&nbsp;&nbsp;Feature Importance</h2>
                  <Button type="button" icon={<DownloadOutlined />} 
                    onClick={downloadLimeImage} 
                    style={{ marginLeft: 10, marginRight: 24, marginBottom: 15 }}
                  />
                  {/* <button type="button" onClick={toDataURL}>
                    Get base64
                  </button> */}
                  <Bar {...shapBarConfig} onReady={(bar) => (barShap = bar)}/>
                </div>
              </Col>
              <Col className="gutter-row" span={12}>
                <div style={style}>
                  <h2>&nbsp;&nbsp;&nbsp;Local Explanation - Sample ID {sampleId}</h2>
                  <Button type="button" icon={<DownloadOutlined />} 
                    onClick={downloadLimeImage} 
                    style={{ marginLeft: 10, marginRight: 24, marginBottom: 15 }}
                  />
                  <Bar {...limeBarConfig} onReady={(bar) => (barLime = bar)}/>
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
        <LayoutPage pageTitle="XAI Page" pageSubTitle="">
          <Divider orientation="left"><h2>Parameters</h2></Divider>
          <Form
          {...layout}
          name="control-hooks"
          onFinish={onFinish}
          style={{
            maxWidth: 600,
          }}
          >
            <Form.Item label="Sample ID" style={{ marginBottom: 10 }}>
              <div style={{ display: 'inline-flex' }}>
                <Form.Item label="id" name="id" noStyle>
                  <InputNumber min={1} defaultValue={sampleId}
                    onChange={(e) => this.onSampleIdChange(e)}
                  />
                </Form.Item>
                {/* TODO: click button doesn't change value of InputNumber? */}
                <Button icon={<RedoOutlined />} type="text" bordered={false} onClick={this.handleRandomClick} />
              </div>  
            </Form.Item>
            <Form.Item label="Background samples" style={{ marginBottom: 10 }}>
              <Form.Item label="bg" name="bg" noStyle>
                <InputNumber min={1} defaultValue={10} 
                  onChange={(e) => this.onNumberSamplesChange(e)} 
                />
              </Form.Item>
            </Form.Item>
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
            <Form.Item name="explain" style={{ marginBottom: 10, marginLeft: 100 }}>
              <Button icon={<UserOutlined />}
                onClick={() => {
                  console.log([modelId, numberSamples, maxDisplay]);
                  this.props.fetchRunShap(
                    modelId,
                    numberSamples,
                    maxDisplay,
                  );
                }}
              >Explain</Button>
            </Form.Item>
          </Form>
        </LayoutPage>
      );
    }
  }
}

const mapPropsToStates = ({ shap, lime, xaiStatus }) => ({
  shap, lime, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunShap: (modelId, numberSamples, maxDisplay) =>
    dispatch(
      requestRunShap({
        modelId,
        numberSamples,
        maxDisplay,
      })
    ),
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(
      requestRunLime({
        modelId,
        sampleId,
        numberFeatures,
      })
    ),
  fetchShapValues: (modelId) => dispatch(requestShapValues(modelId)),
  fetchLimeValues: (modelId) => dispatch(requestLimeValues(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);