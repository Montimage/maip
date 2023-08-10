import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { Tooltip, message, Upload, Spin, Button, Form, Select, Checkbox } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import {
  FORM_LAYOUT,
  SERVER_URL,
} from "../constants";
import {
  requestApp,
  requestMMTStatus,
  requestAllModels,
} from "../actions";
import {
  getFilteredModelsOptions,
  getLastPath,
} from "../utils";

let isModelIdPresent = getLastPath() !== "online";

class PredictOnlinePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      interface: null,
      interfacesOptions: [],
    };
    this.handleButtonPredict = this.handleButtonPredict.bind(this);
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels(); 
    this.fetchInterfacesAndSetOptions();
  }

  async componentDidUpdate(prevProps, prevState) {
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({ modelId: null });
    }
  }

  async requestMMTStatus() {
    const url = `${SERVER_URL}/api/mmt`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      throw data.error;
    }
    console.log(data.mmtStatus);
    return data.mmtStatus;
  };

  async requestNetworkInterfaces() {
    const url = `${SERVER_URL}/api/predict/interfaces`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      throw data.error;
    }
    console.log(data.interfaces);
    return data.interfaces;
  }

  async fetchInterfacesAndSetOptions() {
    let interfacesOptions = [];
    try {
      const interfaces = await this.requestNetworkInterfaces(); 
      interfacesOptions = interfaces.map(i => ({
        label: i,
        value: i,
      }));
    } catch (error) {
      console.error('Error:', error);
    }
    this.setState({ interfacesOptions });
  }

  async requestMMTOffline(file) {
    console.log(`Uploaded file ${file.name}`);
    const url = `${SERVER_URL}/api/mmt/offline`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: file.name }),
    });
    const data = await response.json();
    console.log(`MMT offline analysis of pcap file ${file.name}`);
    return data;
  }

  async handleButtonPredict() {
    const { 
      modelId,
    } = this.state;
  }

  render() {
    const { app, models, mmtStatus, reports } = this.props;
    const { modelId, interfacesOptions } = this.state;

    const modelsOptions = getFilteredModelsOptions(app, models);

    const subTitle = isModelIdPresent ? 
      `Online prediction using the model ${modelId}` : 
      'Online prediction using models';

    return (
      <LayoutPage pageTitle="Predict Online" pageSubTitle={subTitle}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }}>
          <Form.Item name="model" label="Model" 
            style={{ flex: 'none', marginBottom: 10 }}
            rules={[
              {
                required: true,
                message: 'Please select a model!',
              },
            ]}
          > 
            <Tooltip title="Select a model to perform online predictions.">
              <Select placeholder="Select a model ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent}
                onChange={(value) => {
                  this.setState({ modelId: value });
                  console.log(`Select model ${value}`);
                }}
                //optionLabelProp="label"
                options={modelsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item name="interface" label="Network interface" 
            style={{ flex: 'none', marginBottom: 10 }}
            rules={[
              {
                required: true,
                message: 'Please select a network interface!',
              },
            ]}
          > 
            <Tooltip title="Select a network interface to perform online predictions.">
              <Select placeholder="Select a network interface ..."
                style={{ width: '100%' }}
                allowClear showSearch
                value={this.state.interface}
                onChange={v => this.setState({ interface: v })}
                options={interfacesOptions}
              />
            </Tooltip>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'center', }}>
            <Button
              type="primary"
              onClick={this.handleButtonPredict}
              disabled={ !this.state.modelId || !this.state.interface }
            >
              Predict
            </Button>
          </div>
        </Form>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, mmtStatus }) => ({
  app, models, mmtStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchMMTStatus: () => dispatch(requestMMTStatus()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(PredictOnlinePage);