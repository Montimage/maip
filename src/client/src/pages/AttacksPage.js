import React, { Component } from "react";
import { connect } from "react-redux";
import LayoutPage from "./LayoutPage";
import {
  requestPerformAttack,
} from "../actions";
import { 
  getBeforeLastPath,
  getLastPath,
} from "../utils";
import Papa from "papaparse";
import { Heatmap, Bar, Scatter, Histogram, Mix } from '@ant-design/plots';
import { message, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography } from 'antd';
import { DownloadOutlined, BugOutlined, CameraOutlined } from "@ant-design/icons";

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};
const style = {
  padding: '10px 0',
  border: '1px solid black',
};
const {
  SERVER_URL,
  FEATURES_DESCRIPTIONS,
} = require('../constants');
const { Option } = Select;

const selectAttacksOptions = 
  [
    {
      value: 'rsl',
      label: 'Random swapping labels',
    },
    {
      value: 'tlf',
      label: 'Target labels flipping',
    },
  ];

// TODO: users must select only 1 option in TLF attack

class AttacksPage extends Component {

  constructor(props) {
    super(props);
    this.state = {
      poisoningRate: 50,
      selectedAttack: null,
      targetClass: null,
      //normalChecked: false,
      //malwareChecked: false,
    };
    this.handleTargetClass = this.handleTargetClass.bind(this);
  }

  handleTargetClass(checkedValues) {
    //const normalChecked = checkedValues.includes('Normal traffic');
    //const malwareChecked = checkedValues.includes('Malware traffic');
    let targetClass = null;
    if (checkedValues.length === 1) {
      if (checkedValues[0].includes('Malware')) {
        targetClass = 1;
      } else {
        targetClass = 0;
      }
    } else {
      message.warning('Please select only one option.');
      targetClass = null; // Or set a default value  
    }
    this.setState({ targetClass });
  };

  render() {
    const modelId = getLastPath();

    const { poisoningRate, selectedAttack, targetClass } = this.state;

    return (
      <LayoutPage pageTitle="Adversarial Attacks" 
        pageSubTitle={`Adversarial attacks against the model ${modelId}`}>
        
        <Form
        {...layout}
        name="control-hooks"
        style={{
          maxWidth: 800,
        }}
        >
          <Form.Item name="slider" label="Poisoning percentage"
            style={{ marginBottom: 0 }}
          >
            <Slider
              marks={{
                0: '0',
                20: '20',
                40: '40',
                60: '60',
                80: '80',
                100: '100',
              }}
              min={0} max={100} defaultValue={poisoningRate}
              value={poisoningRate}
              onChange={value => this.setState({ poisoningRate: value })}
            />
          </Form.Item>

          <Form.Item name="select" label="Adversarial attack" 
            style={{ flex: 'none', marginBottom: 20 }}
          > 
            <Tooltip title="Select an adversarial attack to be performed against the model.">
              <Select
                style={{
                  width: '100%',
                }}
                allowClear
                placeholder="Select an attack ..."
                onChange={value => this.setState({ selectedAttack: value })}
                optionLabelProp="label"
                options={selectAttacksOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item name="checkbox" label="Target class" 
            valuePropName="checked"
            style={{ flex: 'none', marginBottom: 10 }}
          >
            <Checkbox.Group 
              options={['Normal traffic', 'Malware traffic']}
              defaultValue={[]}
              disabled={selectedAttack !== 'tlf'}
              //onChange={values => this.setState({ targetClass: values[0] })}
              onChange={this.handleTargetClass}
            />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button icon={<BugOutlined />}
              onClick={() => {
                console.log({ modelId, selectedAttack, poisoningRate, targetClass });
                this.props.fetchPerformAttack(modelId, selectedAttack, poisoningRate, targetClass);
              }}
              >Perform Attack
            </Button>
          </div>
        </Form>

        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Compare Two Models</h1>
        </Divider>

        <div style={style}>
          <Row gutter={24}>
            <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
              <h3> Model before </h3>
            </Col>
            <Col className="gutter-row" span={12} style={{ display: 'flex', justifyContent: 'center' }}>
              <h3> Model after </h3>
            </Col>
          </Row>
        </div>

      </LayoutPage>
    );
  }
}

/*this.props.fetchBuildModel(datasets, training_ratio, training_parameters);*/

const mapPropsToStates = ({  }) => ({
});

const mapDispatchToProps = (dispatch) => ({
  fetchPerformAttack: (modelId, selectedAttack, poisoningRate, targetClass) =>
    dispatch(requestPerformAttack({ modelId, selectedAttack, poisoningRate, targetClass })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(AttacksPage);
