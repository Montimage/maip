import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { Row, Col, Tooltip, message, notification, Upload, Spin, Button, InputNumber, Space, Form, Input, Select, Checkbox } from 'antd';
import {
  requestApp,
  requestDatasetsAC,
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
      typeModel: null,
      dataset: null,
      featureList: "Raw Features",
      training_ratio: 0.7,
    };
    this.handleButtonBuild = this.handleButtonBuild.bind(this);
  }

  componentDidMount() {
    this.props.fetchApp();
    this.props.fetchDatasetsAC();
  }

  async handleButtonBuild() {
    console.log('Build model');
  }

  render() {
    const { datasets } = this.props;
    console.log(datasets);
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
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 600 }}>
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

          <Form.Item label="Training Ratio" name="training_ratio">
            <Tooltip title="The training ratio refers to the proportion of data used for training a machine learning model compared to the total dataset. The training ratio is 0.7, meaning 70% for training and 30% for testing/validation.">
              <InputNumber
                name="training_ratio"
                value={this.state.training_ratio}
                min={0} max={1} step={0.1} defaultValue={0.7}
                onChange={v => this.setState({ training_ratio: v })}
              />
            </Tooltip>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              style={{ marginTop: '16px' }}
              disabled={ !this.state.modelType || !this.state.dataset }
              onClick={this.handleButtonBuild}
            >
              Build model
            </Button>
          </div>
        </Form>
        </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, datasets }) => ({
  app, datasets,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchDatasetsAC: () => dispatch(requestDatasetsAC()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(BuildACPage);
