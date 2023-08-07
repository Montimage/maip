import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import { Tooltip, message, Upload, Spin, Button, Form, Select, Checkbox } from 'antd';
import { UploadOutlined } from "@ant-design/icons";
import { connect } from "react-redux";
import {
  FORM_LAYOUT,
  SERVER_URL,
} from "../constants";
import {
  requestMMTStatus,
  requestAllModels,
} from "../actions";

let isModelIdPresent = getLastPath() !== "online";

class PredictOnlinePage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
    };
    this.handleButtonPredict = this.handleButtonPredict.bind(this);
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchAllModels(); 
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
    const { models, mmtStatus, reports } = this.props;
    const { modelId } = this.state;

    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    const modelsOptions = models ? models.map(model => ({
      value: model.modelId,
      label: model.modelId,
    })) : []; 

    const subTitle = isModelIdPresent ? 
      `Online prediction using the model ${modelId}` : 
      'Online prediction using models';

    return (
      <LayoutPage pageTitle="Predict Online Page" pageSubTitle={subTitle}>
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
            <Tooltip title="Select a model to make predictions.">
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
          <div style={{ display: 'flex', justifyContent: 'center', }}>
            <Button
              type="primary"
              onClick={this.handleButtonPredict}
              disabled={ !this.state.modelId }
            >
              Predict
            </Button>
          </div>
        </Form>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ models, mmtStatus }) => ({
  models, mmtStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchMMTStatus: () => dispatch(requestMMTStatus()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(PredictOnlinePage);