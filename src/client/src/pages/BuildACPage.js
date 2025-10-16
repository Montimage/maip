import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Row, Col, Tooltip, notification, Spin, Button, InputNumber, Form, Select } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
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
    this.props.fetchDatasetsAC();
  }

  async handleButtonBuild() {
    const { modelType, dataset, featureList, trainingRatio, isRunning } = this.state;
    
    if (!isRunning) {
      // Disable button and show spinner immediately
      this.setState({ isRunning: true });
      
      try {
        const buildACConfig = {
          buildACConfig: {
            modelType,
            dataset,
            features: featureList,
            training_ratio: trainingRatio,
          }
        };
        console.log(buildACConfig);
        
        // Start polling for build status
        this.intervalId = setInterval(() => {
          this.props.fetchBuildACStatus();
        }, 5000);

        // Dispatch build model action
        this.props.fetchBuildModelAC(modelType, dataset, featureList, trainingRatio);
        // isRunning is already set to true at the beginning
        
      } catch (error) {
        console.error('Error during model building:', error);
        notification.error({
          message: 'Build Failed',
          description: error.message || 'An error occurred while building the model.',
          placement: 'topRight',
        });
        this.setState({ isRunning: false });
        if (this.intervalId) {
          clearInterval(this.intervalId);
        }
      }
    }
  }

  componentDidUpdate(prevProps) {
    const { buildACStatus } = this.props;

    if (prevProps.buildACStatus.isRunning === true && buildACStatus.isRunning === false) {
      console.log('isRunning has been changed from true to false');
      this.setState({ isRunning: false });
      let builtModelId = buildACStatus.lastBuildId;
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
              icon={<RocketOutlined />}
              loading={isRunning}
              disabled={ isRunning || !this.state.modelType || !this.state.dataset }
              onClick={this.handleButtonBuild}
            >
              Build Model
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
  fetchBuildModelAC: (modelType, dataset, featuresList, trainingRatio) =>
    dispatch(requestBuildModelAC({ modelType, dataset, featuresList, trainingRatio })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildACPage);
