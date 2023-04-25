import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Table, Col, Row, Divider, Slider, Form, InputNumber, Button, Checkbox, Select, Tooltip, Typography } from 'antd';
import { UserOutlined, DownloadOutlined, QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Bar } from '@ant-design/plots';
import {
  requestRunShap,
  requestXAIStatus,
  requestShapValues,
} from "../actions";
import {
  FEATURES_DESCRIPTIONS,
} from "../constants";

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
      maxDisplay: 10,
      positiveChecked: true,
      negativeChecked: true,
      maskedFeatures: [],
      loading: false,
    };
    this.handleRandomClick = this.handleRandomClick.bind(this);
    this.handleContributionsChange = this.handleContributionsChange.bind(this);
    this.handleMaskedFeatures = this.handleMaskedFeatures.bind(this);
    this.handleShapExplain = this.handleShapExplain.bind(this);
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
    console.log(`Masked features ${values}`);
    this.setState({ maskedFeatures: values });
  };

  /* handleShapExplain() {
    this.setState({ loading: true });
    const modelId = getLastPath();
    this.props.requestRunShap(modelId).then(() => {
      this.props.requestShapValues(modelId).then(() => {
        this.setState({ loading: false });
      });
    });
  } */
  handleShapExplain(modelId, numberSamples, maxDisplay) {
    this.setState({ loading: true });
    //const modelId = getLastPath();
    /* this.props.fetchRunShap(modelId, numberSamples, maxDisplay)
      .then((response) => {
        // Handle successful response
      })
      .catch((error) => {
        // Handle error
      }); */
    this.props.fetchRunShap(modelId, numberSamples, maxDisplay)
      /* .then(() => {
      requestShapValues(modelId).then(() => {
        this.setState({ loading: false });
      }); */
      .then(() => {
        window.location.reload(); // reload the current page
        this.setState({ loading: false });
      })
      .catch(error => {
        console.log(error);
      });
  };
  /* handleShapExplain(modelId, numberSamples, maxDisplay) {
    this.setState({ loading: true });
    //const modelId = getLastPath();
    //fetch(`/xai/shap?model_id=${modelId}`, { method: 'POST' })
    this.props.fetchRunShap(
      modelId, numberSamples, maxDisplay,
    )
      .then(() => {
        this.props.fetchShapValues(modelId).then(() => {
          this.setState({ loading: false });
        });
      })
      .catch(error => {
        console.error(error);
        this.setState({ loading: false });
      });
  } */

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
      //console.log(shapValues);
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
        geometry: 'interval',
        interactions: [{ type: 'zoom' }],
        title: {
          text: 'Feature Importance',
          style: {
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center'
          }
        }
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
          <Divider orientation="left"><h3>Parameters</h3></Divider>
          <Form
          {...layout}
          name="control-hooks"
          onFinish={onFinish}
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
            {/* TODO: display value of slider (really need?), space between Slide and Checkbox is large? */}
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
                onClick={() => {
                  console.log([modelId, sampleId, numberSamples, maxDisplay]);
                  //this.handleShapExplain(modelId, numberSamples, maxDisplay);
                  /* this.props.fetchRunShap(
                    modelId, numberSamples, maxDisplay,
                  ); */
                  this.handleShapExplain(modelId, numberSamples, maxDisplay);
                }}
              >SHAP Explain</Button>
            </div>
          </Form>
          <Divider orientation="left"><h3>SHAP Explanations</h3></Divider>
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
                      <Button style={{ fontSize: '15px', border: 'none' }} type="link">
                        <QuestionOutlined style={{ opacity: 0.5 }} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                &nbsp;&nbsp;&nbsp;
                <Typography.Title level={4} style={{ textAlign: 'center', fontSize: '16px' }}>
                  Average impact on predicted Malware traffic <br />
                </Typography.Title>
                <center>(Total number of features: {features.length})</center>
                <Bar {...shapValuesBarConfig} onReady={(bar) => (barShap = bar)}/>
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
                    <Button style={{ fontSize: '15px', border: 'none' }} type="link">
                      <QuestionOutlined style={{ opacity: 0.5 }} />
                    </Button>
                  </Tooltip>
                </div>
                <Table dataSource={topFeatures} columns={columnsTopFeatures} 
                  size="small" style={{ marginTop: '20px', marginBottom: 0 }}
                />
              </div>
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
  fetchShapValues: (modelId) => dispatch(requestShapValues(modelId)),
  fetchRunShap: (modelId, numberSamples, maxDisplay) =>
    dispatch(requestRunShap({ modelId, numberSamples, maxDisplay })),
  /* fetchRunShap: (modelId, numberSamples, maxDisplay) => {
    return dispatch(requestRunShap({ modelId, numberSamples, maxDisplay }))
      .then(() => {
        return fetchShapValues(modelId)
          .then(modelId => {
            dispatch(requestShapValues(modelId));
          });
      }); */
    /* return new Promise((resolve, reject) => {
      dispatch(requestRunShap({ modelId, numberSamples, maxDisplay }))
        .then((response) => {
          // Handle successful response
          resolve(response);
        })
        .catch((error) => {
          // Handle error
          reject(error);
        });
    }); */
  /* }, */
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage);