import React, { Component, useState } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { Line } from '@ant-design/charts';
import { Col, Row, Divider, Slider, Form, InputNumber, Button } from 'antd';
import { RedoOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestShapValues,
} from "../actions";

const data = [
  { year: '1991', value: 3 },
  { year: '1992', value: 4 },
  { year: '1993', value: 3.5 },
  { year: '1994', value: 5 },
  { year: '1995', value: 4.9 },
  { year: '1996', value: 6 },
  { year: '1997', value: 7 },
  { year: '1998', value: 9 },
  { year: '1999', value: 13 },
];

const config = {
  data,
  width: 600,
  height: 300,
  autoFit: false,
  xField: 'year',
  yField: 'value',
  point: {
    size: 5,
    shape: 'diamond',
  },
  label: {
    style: {
      fill: '#aaa',
    },
  },
};

const style = {
  //background: '#0092ff',
  padding: '8px 0',
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

const handleRandomClick = () => {
  const randomValue = Math.floor(Math.random() * 100); // generate random number between 0 and 100
  console.log(randomValue.toString());
};

let chart;
let bar;
//let maxDisplay = 10;



// Export Image
const downloadImage = () => {
  bar?.downloadImage();
};

// Get chart base64 string
const toDataURL = () => {
  console.log(bar?.toDataURL());
};

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
      maxDisplay: 10,
    };
  }

  onSliderChange(newVal) {
    this.setState({ maxDisplay: newVal });
  }

  componentDidMount() {
    let modelId = getLastPath();
    console.log(modelId);
    this.props.fetchShapValues(modelId);
  }

  render() {
    const { maxDisplay } = this.state;
    const {shap} = this.props;
    //console.log(shap);
    console.log(`maxDisplay: ${maxDisplay}`);
    const shapconfig = {
      data: shap.slice(0, maxDisplay),
      isStack: true,
      xField: 'importance_value',
      yField: 'feature',
      seriesField: 'type',
      label: false,
      geometry: 'interval',
      interactions: [{ type: 'zoom' }],
      /* label: {
        position: 'middle',
        layout: [
          {
            type: 'interval-adjust-position',
          },
          {
            type: 'interval-hide-overlap',
          },
          {
            type: 'adjust-color',
          },
        ],
      }, */
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
          <Form.Item label="Sample ID">
            <div style={{ display: 'inline-flex' }}>
              <Form.Item label="id" name="id" noStyle>
                <InputNumber min={1} defaultValue={1} onChange={(e) => console.log(e)} />
              </Form.Item>
              <Button icon={<RedoOutlined />} type="text" bordered={false} onClick={handleRandomClick} />
            </div>  
          </Form.Item>
          <Form.Item label="Background samples">
            <Form.Item label="bg" name="bg" noStyle>
              <InputNumber min={1} defaultValue={10} onChange={(e) => console.log(e)} />
            </Form.Item>
          </Form.Item>
          <Form.Item name="slider" label="Features to display">
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
                min={1} max={30} defaultValue={maxDisplay} step={null}
                tipFormatter={null}
                onChange={(value) => this.onSliderChange(value)}
              />
          </Form.Item>
        </Form>
        <Divider orientation="left"><h2>Explanations</h2></Divider>
          <Row gutter={20}>
            <Col className="gutter-row" span={10}>
              <div style={style}>
                <h2>&nbsp;&nbsp;&nbsp;Feature Importance</h2>
                <button type="button" onClick={downloadImage} style={{ marginRight: 24 }}>
                  Export Image
                </button>
                <button type="button" onClick={toDataURL}>
                  Get base64
                </button>
                <Bar {...shapconfig} onReady={(barSHAP) => (bar = barSHAP)}/>
              </div>
            </Col>
            {/* <Col className="gutter-row" span={10}>
              <div style={style}>
                <h2>&nbsp;&nbsp;&nbsp;Local Explanation - ID ???</h2>
                <button type="button" onClick={downloadImage} style={{ marginRight: 24 }}>
                  Export Image
                </button>
                <button type="button" onClick={toDataURL}>
                  Get base64
                </button>
                <Line {...config} onReady={(chartInstance) => (chart = chartInstance)} />
              </div>
            </Col> */}
          </Row>
        
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ shap }) => ({
  shap,
});

const mapDispatchToProps = (dispatch) => ({
  fetchShapValues: (modelId) => dispatch(requestShapValues(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);