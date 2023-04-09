import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select } from 'antd';
import { RedoOutlined, UserOutlined } from "@ant-design/icons";
import { Link } from 'react-router-dom';
import {
  requestAllModels,
  requestRunShap,
  requestRunLime,
  requestXAIStatus,
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
      modelId: "",
      sampleId: 20,
      numberSamples: 10,
      maxDisplay: 30,
    };
    this.handleRandomClick = this.handleRandomClick.bind(this);
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

  handleOptionChange(value) {
    this.setState({ modelId: value });
    console.log(`Selected option: ${value}`);
  }

  componentDidMount() {
    this.props.fetchAllModels();
    this.props.fetchXAIStatus();
  }

  componentWillUnmount() {
    clearInterval(this.xaiStatusTimer);
  }

  render() {
    const {
      modelId,
      sampleId,
      numberSamples,
      maxDisplay, 
    } = this.state;
    const {
      allModels,
      xaiStatus, 
    } = this.props;
    console.log(xaiStatus);
    const selectOptions = allModels.map((label, index) => ({
      value: label, label,
    }));

    return (
      <LayoutPage pageTitle="XAI Page" pageSubTitle="">
        <Form
        {...layout}
        name="control-hooks"
        onFinish={onFinish}
        style={{
          maxWidth: 600,
        }}
        >
        <Divider orientation="left"><h3>Model</h3></Divider>
          <Form.Item label="Select">
            <Select
              placeholder="Select a model"
              showSearch optionFilterProp="children"
              value={modelId} onChange={(e) => this.handleOptionChange(e)}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={selectOptions}
            />
          </Form.Item>

        <Divider orientation="left"><h3>Parameters</h3></Divider>
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
                <Link to={`/xai/${modelId}`}>
                  <Button icon={<UserOutlined />}
                    onClick={() => {
                      console.log([modelId, sampleId, numberSamples, maxDisplay]);
                      this.props.fetchRunShap(
                        modelId,
                        numberSamples,
                        maxDisplay,
                      );
                    }}
                    >SHAP Explain
                  </Button>
                </Link>
              </div>  
            </Form.Item>
          </Col>
          <Col className="gutter-row" span={12}>
            <Divider orientation="left"><h3>LIME Explanations</h3></Divider>
            <Form.Item label="Sample ID" style={{ marginBottom: 10 }}>
              <div style={{ display: 'inline-flex' }}>
                <Form.Item label="id" name="id" noStyle>
                  <InputNumber min={1} defaultValue={sampleId}
                    onChange={(e) => this.onSampleIdChange(e)}
                  />
                </Form.Item>
                {/* TODO: click button doesn't change value of InputNumber? */}
                {/* <Button icon={<RedoOutlined />} 
                  type="text" bordered={false} 
                  onClick={this.handleRandomClick}
                /> */}
                <Link to={`/xai/${modelId}`}>
                  <Button icon={<UserOutlined />}
                    onClick={() => {
                      console.log([modelId, sampleId, numberSamples, maxDisplay]);
                      this.props.fetchRunLime(
                        modelId,
                        sampleId,
                        maxDisplay,
                      );
                    }}
                    >LIME Explain
                  </Button>
                </Link>
              </div>  
            </Form.Item>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ allModels, xaiStatus }) => ({
  allModels, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunShap: (modelId, numberSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberSamples, maxDisplay })),
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(requestRunLime({ modelId, sampleId, numberFeatures })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);