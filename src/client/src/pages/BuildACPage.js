import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Row, Col, Tooltip, notification, Spin, Button, InputNumber, Form, Select } from 'antd';
import { RocketOutlined, LockOutlined } from '@ant-design/icons';
import { useUserRole } from '../hooks/useUserRole';
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
    const { datasets, isAdmin, isSignedIn } = this.props;
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

    // Frozen overlay style for non-admin users
    const frozenOverlayStyle = {
      position: 'relative',
      pointerEvents: isAdmin ? 'auto' : 'none',
      opacity: isAdmin ? 1 : 0.5,
    };

    const overlayMessageStyle = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '24px 32px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      textAlign: 'center',
      border: '2px solid #ff4d4f',
    };

    return (
      <LayoutPage pageTitle="Build Models" pageSubTitle="Build a new AI model for activity classification">
        {/* Overlay message for non-admin users */}
        {!isAdmin && (
          <div style={overlayMessageStyle}>
            <LockOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px', fontWeight: 600 }}>Administrator Access Required</h3>
            <p style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: 0 }}>
              {isSignedIn ? 'Only administrators can build and train AI models' : 'Please sign in with administrator privileges to build models'}
            </p>
          </div>
        )}
        
        <div style={frozenOverlayStyle}>
        <Row>
        <Col span={12}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600, marginBottom: 10 }}>
          <Form.Item label={<strong><span style={{ color: 'red' }}>* </span>Model Type</strong>} name="modelType"
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

          <Form.Item label={<strong><span style={{ color: 'red' }}>* </span>Dataset</strong>} name="dataset"
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
        </div>
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

// Wrap with role check
const BuildACPageWithRole = (props) => {
  const userRole = useUserRole();
  return <BuildACPage {...props} isAdmin={userRole.isAdmin} isSignedIn={userRole.isSignedIn} />;
};

export default connect(mapPropsToStates, mapDispatchToProps)(BuildACPageWithRole);
