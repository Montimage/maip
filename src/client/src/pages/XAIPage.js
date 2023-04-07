import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox } from 'antd';
import { RedoOutlined, UserOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
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
      maxDisplay: 30,
      sampleId: 20,
      positiveChecked: true,
      negativeChecked: true,
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
  }

  render() {
    const { 
      maxDisplay, 
      sampleId,
      positiveChecked,
      negativeChecked,
    } = this.state;
    const { 
      shap, 
      lime, 
    } = this.props;
    console.log(`maxDisplay: ${maxDisplay}`);
    console.log(`sampleId: ${sampleId}`);
    const sortedLime = lime.slice().sort((a, b) => b.value - a.value);
    //console.log(sortedLime);
    const notZeroSortedLime = sortedLime.filter(d => d.value !== 0);

    const filteredLime = notZeroSortedLime.filter((d) => {
      if (d.value > 0 && positiveChecked) return true;
      if (d.value < 0 && negativeChecked) return true;
      return false;
    });

    const shapConfig = {
      data: shap.slice(0, maxDisplay),
      isStack: true,
      xField: 'importance_value',
      yField: 'feature',
      seriesField: 'type',
      label: false,
      geometry: 'interval',
      interactions: [{ type: 'zoom' }],
    }; 
    const limeConfig = {
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
                  onChange={(e) => this.onSampleIdChange(e)} />
              </Form.Item>
              {/* TODO: click button doesn't change value of InputNumber? */}
              <Button icon={<RedoOutlined />} type="text" bordered={false} onClick={this.handleRandomClick} />
            </div>  
          </Form.Item>
          <Form.Item label="Background samples" style={{ marginBottom: 10 }}>
            <Form.Item label="bg" name="bg" noStyle>
              <InputNumber min={1} defaultValue={10} 
                onChange={(e) => console.log(e)} 
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
              defaultValue={['Positive', 'Negative']}
              onChange={this.handleContributionsChange} 
            />
          </Form.Item>
          <Form.Item name="explain" label="" 
            style={{ marginBottom: 10, marginLeft: 100 }}
          >
            <Button icon={<UserOutlined />}>Explain</Button>
          </Form.Item>
        </Form>
        <Divider orientation="left"><h2>Explanations</h2></Divider>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              <div style={style}>
                <h2>&nbsp;&nbsp;&nbsp;Feature Importance</h2>
                <button type="button" onClick={downloadShapImage} 
                  style={{ marginLeft: 10, marginRight: 24, marginBottom: 15 }}
                >
                  Export Image
                </button>
                <button type="button" onClick={toDataURL}>
                  Get base64
                </button>
                <Bar {...shapConfig} onReady={(bar) => (barShap = bar)}/>
              </div>
            </Col>
            <Col className="gutter-row" span={12}>
              <div style={style}>
                <h2>&nbsp;&nbsp;&nbsp;Local Explanation - Sample ID {sampleId}</h2>
                <button type="button" onClick={downloadLimeImage} 
                  style={{ marginLeft: 10, marginRight: 24, marginBottom: 15 }}
                >
                  Export Image
                </button>
                <Bar {...limeConfig} onReady={(bar) => (barLime = bar)}/>
              </div>
            </Col>
          </Row>
        
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ shap, lime }) => ({
  shap, lime,
});

const mapDispatchToProps = (dispatch) => ({
  fetchShapValues: (modelId) => dispatch(requestShapValues(modelId)),
  fetchLimeValues: (modelId) => dispatch(requestLimeValues(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);