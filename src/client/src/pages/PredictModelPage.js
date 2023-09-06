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
  requestAllReports,
} from "../actions";

class PredictModelPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      testingPcapFile: null,
      testingDataset: null,
    };
    this.handleButtonPredict = this.handleButtonPredict.bind(this);
  }

  componentDidMount() {
    this.props.fetchAllReports();
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

  beforeUploadPcap = (file) => {
    const isPCAP = file.name.endsWith('.pcap');
    console.log(file.name.endsWith('.pcap'));
    if (!isPCAP) {
      message.error(`${file.name} is not a pcap file`);
    }
    return isPCAP ? true : Upload.LIST_IGNORE;
  }

  handleUploadPcap = async (info, typePcap) => {
    const { status, response, name } = info.file;
    console.log({ status, response, name });
  
    if (status === 'uploading') {
      console.log(`Uploading ${name}`);
    } else if (status === 'done') {
      this.setState({ testingPcapFile: info.file.originFileObj });
    } else if (status === 'error') {
      console.error('Pcap file upload failed');
    }
  };

  processUploadPcap = async ({ file, onProgress, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('pcapFile', file);

    try {
      const response = await fetch(`${SERVER_URL}/api/pcaps`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data, response);
        console.log(`Uploaded successfully ${file.name}`);
      } else {
        const error = await response.text();
        onError(new Error(error));
        console.error(error);
      }
    } catch (error) {
      onError(error);
      console.error(error);
    }
  }

  async handleButtonPredict() {
    const { 
      testingPcapFile,
      testingDataset,
    } = this.state;
  }

  render() {
    let modelId = getLastPath();
    const { mmtStatus, reports } = this.props;

    const reportsOptions = reports ? reports.map(report => ({
      value: report,
      label: report,
    })) : [];

    return (
      <LayoutPage pageTitle="Predict Page" pageSubTitle={`Make predictions using the model ${modelId}`}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }}>
          <Form.Item
            label="Testing Dataset"
            name="testingDataset"
            rules={[
              {
                required: true,
                message: 'Please select a testing dataset!',
              },
            ]}
          >
            <Tooltip title="Select MMT's analyzing reports of testing traffic.">
              <Select
                /*placeholder="Select a testing dataset"*/
                showSearch allowClear
                onChange={(value) => {
                  this.setState({ testingDataset: value });
                }}
                options={reportsOptions}
                disabled={this.state.testingPcapFile !== null}
              />
            </Tooltip>
            <Upload
              beforeUpload={this.beforeUploadPcap}
              action={`${SERVER_URL}/api/pcaps`}
              onChange={(info) => this.handleUploadPcap(info)} 
              customRequest={this.processUploadPcap}
              onRemove={() => {
                this.setState({ testingPcapFile: null });
              }}
            >
              <Button icon={<UploadOutlined />} style={{ marginTop: '5px' }} 
                disabled={!!this.state.testingDataset}>
                Upload pcaps only
              </Button>
            </Upload>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'center', }}>
            <Button
              type="primary"
              onClick={this.handleButtonPredict}
              disabled={ !(this.state.testingDataset || this.state.testingPcapFile) }
            >
              Predict
            </Button>
          </div>
        </Form>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ mmtStatus, reports }) => ({
  mmtStatus, reports,
});

const mapDispatchToProps = (dispatch) => ({
  fetchMMTStatus: () => dispatch(requestMMTStatus()),
  fetchAllReports: () => dispatch(requestAllReports()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(PredictModelPage);
