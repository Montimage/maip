import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Row, Col, Tooltip, notification, Spin, Button, InputNumber, Form, Select } from 'antd';
import {
  requestApp,
  requestDatasetsAC,
  requestBuildModelAC,
  requestBuildStatusAC,
} from "../actions";
import { connect } from 'react-redux';
import {
  FORM_LAYOUT,
  AI_MODEL_TYPES,
  FEATURES_OPTIONS,
} from "../constants";

class BuildACPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelType: null,
      dataset: null,
      featureList: "Raw Features",
      trainingRatio: 0.7,
      isRunning: props.buildACStatus.isRunning,
    };
    this.handleButtonBuild = this.handleButtonBuild.bind(this);
  }

  componentDidMount() {
    this.props.fetchApp();
    this.props.fetchDatasetsAC();
  }

  async handleButtonBuild() {
    const { modelType, dataset, featureList, trainingRatio, isRunning } = this.state;
    const buildConfig = {
      buildConfig: {
        modelType, dataset, featureList, trainingRatio
      }
    };
    console.log(buildConfig);

    if (!isRunning) {
      console.log("update isRunning state!");
      this.setState({ isRunning: true });        
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchBuildStatusAC();
      }, 3000);   

      this.props.fetchBuildModelAC(modelType, dataset, featureList, trainingRatio);
    }
  }

  componentDidUpdate(prevProps) {
    const { isRunning } = this.state;
    const { buildACStatus } = this.props;
    console.log(`buildACStatus: ${buildACStatus.isRunning}`);
    console.log(`build isRunning: ${isRunning}`);
    if (prevProps.buildACStatus.isRunning !== this.props.buildACStatus.isRunning) {
      console.log('isRunning has been changed');
      this.setState({ isRunning: this.props.buildACStatus.isRunning });
      if (!this.props.buildACStatus.isRunning) {
        let builtModelId = this.props.buildACStatus.lastBuildId;
        builtModelId = `ac-${builtModelId}`;
        console.log('isRunning changed from True to False');  
        clearInterval(this.intervalId);
        notification.success({
          message: 'Success',
          description: `The model ${builtModelId} was built successfully!`,
          placement: 'topRight',
        });
        this.setState({
          modelType: null, 
          dataset: null,
        });
      }
    }
  }

  render() {
    const { datasets } = this.props;
    console.log(datasets);
    const { isRunning } = this.state;
    const modelTypesOptions = AI_MODEL_TYPES ? AI_MODEL_TYPES.map(feature => ({
      value: feature,
      label: feature,
    })) : [];
    const datasetsOptions = datasets ? datasets.map(feature => ({
      value: feature,
      label: feature,
    })) : [];
    const featureOptions = FEATURES_OPTIONS ? FEATURES_OPTIONS.map(feature => ({
      value: feature,
      label: feature,
    })) : [];

    return (
      <LayoutPage pageTitle="Build Models" pageSubTitle="Build a new AI model for activity classification">
        <Row>
        <Col span={12}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600, marginBottom: 10 }}>
          <Form.Item label="Model Type" name="modelType"
            rules={[
              {
                required: true,
                message: 'Please select a type of AI models!',
              },
            ]}
          >
            <Tooltip title="Select a model type.">
              <Select
                placeholder="Select a model type ..."
                value={this.state.modelType}
                showSearch allowClear
                onChange={v => this.setState({ modelType: v })}
                options={modelTypesOptions}
              />
            </Tooltip>
          </Form.Item>

          <Form.Item label="Dataset" name="dataset"
            rules={[
              {
                required: true,
                message: 'Please select a dataset!',
              },
            ]}
          >
            <Tooltip title="Select a dataset.">
              <Select
                placeholder="Select a dataset ..."
                value={this.state.dataset}
                showSearch allowClear
                onChange={v => this.setState({ dataset: v })}
                options={datasetsOptions}
              />
            </Tooltip>
          </Form.Item>

          <Form.Item label="Feature List" name="featureList">
            <Tooltip title="Select feature lists used to build models.">
              <Select
                value={this.state.featureList}
                onChange={v => this.setState({ featureList: v })}
                options={featureOptions}
              />
            </Tooltip>
          </Form.Item>

          <Form.Item label="Training Ratio" name="trainingRatio">
            <Tooltip title="The training ratio refers to the proportion of data used for training a machine learning model compared to the total dataset. The training ratio is 0.7, meaning 70% for training and 30% for testing/validation.">
              <InputNumber
                name="trainingRatio"
                value={this.state.trainingRatio}
                min={0} max={1} step={0.1} defaultValue={0.7}
                onChange={v => this.setState({ trainingRatio: v })}
              />
            </Tooltip>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              // style={{ marginTop: '10px' }}
              disabled={ isRunning || !this.state.modelType || !this.state.dataset }
              onClick={this.handleButtonBuild}
            >
              Build model
              {isRunning && 
                <Spin size="large" style={{ marginBottom: '8px' }}>
                  <div className="content" />
                </Spin>
              }
            </Button>
          </div>
        </Form>
        </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, buildACStatus, datasets }) => ({
  app, buildACStatus, datasets,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchBuildStatusAC: () => dispatch(requestBuildStatusAC()),
  fetchDatasetsAC: () => dispatch(requestDatasetsAC()),
  fetchBuildModelAC: (modelType, dataset, featuresList ,trainingRatio) =>
    dispatch(requestBuildModelAC({ modelType, dataset, featuresList ,trainingRatio })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildACPage);
