import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip } from 'antd';
import { UserOutlined, DownloadOutlined, QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar, Pie } from '@ant-design/plots';
import isEqual from 'lodash/isEqual';
import {
  requestModel,
  requestRunLime,
  requestXAIStatus,
  requestLimeValues,
} from "../actions";
const URL = `http://localhost:31057`;
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

let barLime;
let intervalXAI;
const maxDisplay = 10;
const numberSamples = 5;

class XAIPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sampleId: 5,
      isRunning: props.xaiStatus.isRunning, // set initial value from props
      limeValues: [],
      /*limeValuesBarConfig: {
        data: [],
        isStack: true,
        xField: 'value',
        yField: 'feature',
        label: false,
        barStyle: (d) => {
          return {
            fill: d.value > 0 ? "#0693e3" : "#EB144C"
          };
        },
      }*/
    };
    this.handleLimeClick = this.handleLimeClick.bind(this);
  }

  /*onSampleIdChange(newId) {
    this.setState({ sampleId: newId });
  }*/

  onSampleIdChange = (value) => {
    if (value !== this.state.sampleId) {
      this.setState({ sampleId: value });
    }
  }

  componentDidMount() {
    this.intervalId = setInterval(() => {
      this.props.fetchXAIStatus();
    }, 10000);
  }

  /*shouldComponentUpdate(nextProps, nextState) {
    console.log('shouldComponentUpdate AAAAAAAAAA');
    const { limeValues } = this.state;
    const { limeValues: nextLimeValues } = nextState;
    return !isEqual(limeValues, nextLimeValues);
  }*/

  componentWillUnmount() {
    clearInterval(this.intervalId);
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

    /*if (prevState.isRunning && !isRunning && !xaiStatus.isRunning) {
      
      
    }*/
  }

  async handleLimeClick() {
    const { sampleId, isRunning, limeValuesBarConfig } = this.state;
    const modelId = getLastPath();
    const url = `${URL}/api/xai/lime`;
    const limeConfig = {
      "modelId": modelId,
      "sampleId": sampleId,
      "numberFeature": maxDisplay,
    };
    if (!isRunning) {
      console.log("update isRunning state!");
      this.setState({ isRunning: true });        
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limeConfig }),
      });
      const data = await response.json();

      console.log(`Building LIME values of the model ${modelId}`);
      console.log(JSON.stringify(data));
    }
  }

  async fetchNewValues(modelId) {
    //const modelId = getLastPath();
    const url = `${URL}/api/xai/lime/explanations/${modelId}`;
    const limeValues = await fetch(url).then(res => res.json());
    console.log(`Get new LIME values of the model ${modelId} from server`);
    console.log(JSON.stringify(limeValues));

    // Update state only if new data is different than old data
    if (JSON.stringify(limeValues) !== JSON.stringify(this.state.limeValues)) {
      this.setState({ limeValues });
    }
    
    /*const limeValuesBarConfig = {
      data: limeValues,
      isStack: true,
      xField: 'value',
      yField: 'feature',
      label: false,
      barStyle: (d) => {
        return {
          fill: d.value > 0 ? "#0693e3" : "#EB144C"
        };
      },
    };
    barLime.update(limeValuesBarConfig);
    this.setState({ limeValuesBarConfig });*/
  }

  render() {
    const modelId = getLastPath();    
    const { 
      sampleId,
      isRunning,
      limeValues,
    } = this.state;
    /*const {
      xaiStatus, 
    } = this.props;*/
    console.log(`isRunning: ${isRunning}`);
    const limeValuesBarConfig = {
      data: limeValues,
      isStack: true,
      xField: 'value',
      yField: 'feature',
      label: false,
      barStyle: (d) => {
        return {
          fill: d.value > 0 ? "#0693e3" : "#EB144C"
        };
      },
    };
    return (
      <LayoutPage pageTitle="Explainable AI with Local Interpretable Model-Agnostic Explanations (LIME)" 
        pageSubTitle={`Model ${modelId}`}>
        <InputNumber min={1} defaultValue={sampleId}
          onChange={(e) => this.onSampleIdChange(e)}
        />
        <Button icon={<UserOutlined />}
          onClick={this.handleLimeClick}
          >LIME Explain
          {isRunning && <p>LIME values are building...</p>}
        </Button>
        {limeValuesBarConfig && (
          <Bar
            {...limeValuesBarConfig}
            onReady={(bar) => (barLime = bar)}
          />
          )
        }
      </LayoutPage>
    );
  } 
}

/*  */

const mapPropsToStates = ({ model, xaiStatus }) => ({
  model, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(requestRunLime({ modelId, sampleId, numberFeatures })),
  fetchLimeValues: (modelId) => dispatch(requestLimeValues(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);