import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Spin, Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip } from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar, Pie } from '@ant-design/plots';
import {
  requestModel,
  requestRunLime,
  requestXAIStatus,
  requestLimeValues,
  requestPredictedProbsModel,
} from "../actions";
import {
  FORM_LAYOUT, BOX_STYLE,
  FEATURES_DESCRIPTIONS,
  SERVER_URL,
  LIME_URL, XAI_SLIDER_MARKS
} from "../constants";

let barLime;

const downloadLimeImage = () => { barLime?.downloadImage(); };
//const toDataURL = () => { console.log(barLime?.toDataURL()); };

class XAILimePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
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
    };
    this.handleRandomClick = this.handleRandomClick.bind(this);
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleMaskedFeatures = this.handleMaskedFeatures.bind(this);
    this.handleLimeClick = this.handleLimeClick.bind(this);
  }

  handleRowClick = (record) => {
    this.setState({ sampleId: record.key });
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
    this.setState({ maskedFeatures: values });
  };

  componentDidMount() {
    let modelId = getLastPath();
    this.props.fetchModel(modelId);
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

    // Check if limeValues state is updated and clear the interval if it is
    if (prevState.limeValues !== this.state.limeValues && this.state.limeValues.length > 0) {
      clearInterval(this.intervalId);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.limeValues !== nextState.limeValues ||
      this.props.xaiStatus.isRunning !== nextProps.xaiStatus.isRunning ||
      (this.state.limeValues === nextState.limeValues &&
        (this.state.positiveChecked !== nextState.positiveChecked ||
          this.state.negativeChecked !== nextState.negativeChecked ||
          this.state.maxDisplay !== nextState.maxDisplay ||
          this.state.maskedFeatures !== nextState.maskedFeatures))
    );
  }

  async handleLimeClick() {
    const { sampleId, maxDisplay, isRunning, limeValues } = this.state;
    const modelId = getLastPath();
    const limeConfig = {
      "modelId": modelId,
      "sampleId": sampleId,
      "numberFeature": maxDisplay,
    };
    console.log("update isRunning state!");
    this.setState({ isRunning: true });     

    // reset Bar chart to avoid confusion
    if (limeValues) {
      this.setState({ limeValues: [] });           
    }

    const response = await fetch(LIME_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limeConfig }),
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
    const dataTableProbs = [
      {
        key: 0,
        label: 'Normal traffic',
        probability: sampleId && yProbs[sampleId] ? `${(yProbs[sampleId][0] * 100).toFixed(0)}%` : '-'
      },
      {
        key: 1,
        label: 'Malware traffic',
        probability: sampleId && yProbs[sampleId] ? `${(yProbs[sampleId][1] * 100).toFixed(0)}%` : '-'
      }
    ];

    const pieData = sampleId ? yProbs[sampleId].map((prob, i) => {
      const label = i === 0 ? "Normal traffic" : "Malware traffic";
      const percentage = (prob * 100).toFixed(0);
      return {
        type: label,
        value: prob,
      };
    }) : [];
    
    this.setState({ 
      pieData: pieData,
      dataTableProbs: dataTableProbs,
    });
  }

  async fetchNewValues(modelId) {
    const limeValuesUrl = `${LIME_URL}/explanations/${modelId}`;
    const limeValues = await fetch(limeValuesUrl).then(res => res.json());
    console.log(`Get new LIME values of the model ${modelId} from server`);
    //console.log(JSON.stringify(limeValues));
    // Update state only if new data is different than old data
    if (JSON.stringify(limeValues) !== JSON.stringify(this.state.limeValues)) {
      this.setState({ limeValues });
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
      limeValues,
      pieData,
      dataTableProbs,
    } = this.state;
    console.log(`XAI isRunning: ${isRunning}`);
    const { 
      model,
      xaiStatus, 
    } = this.props;

    const { stats, buildConfig, confusionMatrix, trainingSamples, testingSamples } = model;

    const columnsTableProbs = [
      {
        title: 'Label',
        dataIndex: 'label',
        key: 'label'
      },
      {
        title: 'Probability',
        dataIndex: 'probability',
        key: 'probability'
      }
    ];

    const pieConfig = {
      appendPadding: 10,
      data: pieData,
      angleField: 'value',
      colorField: 'type',
      radius: 1,
      label: {
        type: 'inner',
        offset: '-50%',
        content: '{value}',
        style: {
          textAlign: 'center',
          fontSize: 18,
          fill: '#fff',
        },
        autoRotate: false,
      },
      interactions: [{ type: 'element-highlight' }],
    };

    // TODO: remove the first two keys and the last one
    const features = Object.keys(FEATURES_DESCRIPTIONS).sort();
    const selectFeaturesOptions = features.map((label, index) => ({
      value: label, label,
    }));

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
      barStyle: (d) => {
        //console.log(d)
        return {
          /* https://casesandberg.github.io/react-color/ */
          fill: d.value > 0 ? "#0693e3" : "#EB144C"
        };
      },
      interactions: [{ type: 'element-active' }],
    };

    return (
      <LayoutPage pageTitle="Explainable AI with Local Interpretable Model-Agnostic Explanations (LIME)" 
        pageSubTitle={`Model ${modelId}`}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>LIME Parameters</h1>
        </Divider>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600 }}>
          <Form.Item label="Sample ID" style={{ marginBottom: 10 }}>
            <div style={{ display: 'inline-flex' }}>
              <Form.Item label="id" name="id" noStyle>
                <InputNumber min={1} defaultValue={sampleId}
                  onChange={(e) => this.onSampleIdChange(e)}
                />
              </Form.Item>
            </div>  
          </Form.Item>
          <Form.Item name="slider" label="Features to display" 
            style={{ marginBottom: -5 }}>
            <Slider
              marks={XAI_SLIDER_MARKS}
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
          <Form.Item name="select" label="Feature(s) to mask" 
            style={{ flex: 'none', marginBottom: 10 }}>
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
            <Button type="primary" //>icon={<UserOutlined />}
              onClick={this.handleLimeClick} disabled={isRunning}
              >LIME Explain
              {isRunning && 
                <Spin size="large" style={{ marginBottom: '8px' }}>
                  <div className="content" />
                </Spin>
              }
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
              {limeValuesBarConfig && (
                <Bar {...limeValuesBarConfig} onReady={(bar) => (barLime = bar)}/>
              )}
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={BOX_STYLE}>
              <h2>&nbsp;&nbsp;&nbsp;Prediction - Sample ID {sampleId}</h2>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {pieConfig && (
                  <>
                    <Table
                      columns={columnsTableProbs}
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
      </LayoutPage>
    );
  } 
}

const mapPropsToStates = ({ model, xaiStatus }) => ({
  model, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
  fetchRunLime: (modelId, sampleId, numberFeatures) =>
    dispatch(requestRunLime({ modelId, sampleId, numberFeatures })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAILimePage);