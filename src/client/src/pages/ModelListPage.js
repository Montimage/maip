import React, { Component } from "react";
import { connect } from "react-redux";
import { Table, Space, Button } from "antd";
import { Link } from 'react-router-dom';
import LayoutPage from "./LayoutPage";
import Papa from "papaparse";
import { 
  FolderViewOutlined, DownloadOutlined, FileOutlined, TableOutlined, 
  LineChartOutlined, SolutionOutlined, BugOutlined,
  HourglassOutlined, RestOutlined, QuestionOutlined,
} from '@ant-design/icons';
import {
  requestAllModels,
  deleteModel,
  requestDownloadModel,
} from "../actions";
import moment from "moment";
const {
  SERVER_HOST,
  SERVER_PORT,
} = require('../constants');

class ModelListPage extends Component {

  componentDidMount() {
    this.props.fetchAllModels();
  }

  async handleDownloadDataset(modelId, datasetType) {
    try {
      const res = await fetch(`http://${SERVER_HOST}:${SERVER_PORT}/api/models/${modelId}/datasets/${datasetType}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      const datasetFileName = `${modelId}_${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}_samples.csv`;
      link.setAttribute('download', datasetFileName);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Error downloading dataset:', error);
    }
  }
  
  render() {
    const { models, fetchDeleteModel } = this.props;
    console.log(models);

    if (!models) {
      console.error("No models")
      return null;
    }

    const dataSource = models.map((model, index) => ({ ...model, key: index }));
    const columns = [
      {
        title: "Id",
        key: "data",
        width: '14%',
        render: (model) => (
          <div>
            <a href={`/models/${model.modelId}`}>
              {model.modelId}
            </a>
          </div>
        ),
      },
      {
        title: "Build At",
        key: "data",
        sorter: (a, b) => a.lastBuildAt - b.lastBuildAt,
        render: (model) => {
          console.log(model.lastBuildAt);
          return moment(model.lastBuildAt).format("MMMM Do YYYY, h:mm:ss a");
        },
        width: '10%', /* width: 300, */
      },
      {
        title: "Training Dataset",
        key: "data",
        width: '18%',
        render: (model) => (
          <div>
            <a href={`/datasets/${model.modelId}/train`} view>
              <Space wrap>
                <Button icon={<FolderViewOutlined />}>View</Button>
              </Space>
            </a>
            &nbsp;&nbsp;
            <Space wrap>
              <Button icon={<DownloadOutlined />} 
                onClick={() => this.handleDownloadDataset(model.modelId, "train")}
              >Download</Button>
            </Space>
          </div>
        ),
      },
      {
        title: "Testing Dataset",
        key: "data",
        width: '18%',
        render: (model) => (
          <div>
            <a href={`/datasets/${model.modelId}/test`} view>
                <Space wrap>
                  <Button icon={<FolderViewOutlined />}>View</Button>
                </Space>
              </a>
              &nbsp;&nbsp;
              <Space wrap>
                <Button icon={<DownloadOutlined />} 
                  onClick={() => this.handleDownloadDataset(model.modelId, "test")}
                >Download</Button>
            </Space>
          </div>
        ),
      },
      {
        title: "Action",
        key: "data",
        width: '35%',
        render: (model) => (
          <div>
            <a href={`/retrain/${model.modelId}`}>
              <Space wrap>
                <Button icon={<HourglassOutlined />}>Retrain</Button>
              </Space>
            </a>
            &nbsp;&nbsp;
            <a href={`/predict/${model.modelId}`}>
              <Space wrap>
                <Button icon={<LineChartOutlined />}>Predict</Button>
              </Space>
            </a>
            &nbsp;&nbsp;
            <a href={`/xai/${model.modelId}`}>
              <Space wrap>
                <Button icon={<SolutionOutlined />}>XAI</Button>
              </Space>
            </a>
            &nbsp;&nbsp;
            <a href={`/attacks/${model.modelId}`}>
              <Space wrap>
                <Button icon={<BugOutlined />}>Attacks</Button>
              </Space>
            </a>
            &nbsp;&nbsp;
            <a>
              <Space wrap>
                <Button icon={<RestOutlined />}
                  onClick={() => fetchDeleteModel(model.modelId)}
                >Delete</Button>
              </Space>
            </a>
          </div>
        ),
      },
    ];
    return (
      <LayoutPage pageTitle="Models" pageSubTitle="All the models">
        <a href={`/build`}>
          <Space wrap>
            <Button>
              Add a new model
            </Button>
          </Space>
        </a>
        &nbsp;&nbsp;
        <Table columns={columns} dataSource={dataSource} 
          pagination={{ pageSize: 5 }}
          expandable={{
            expandedRowRender: (model) => 
              <p style={{ margin: 0 }}>
                <h3>Build config:</h3>
                <pre>{JSON.stringify(model.buildConfig, null, 2)}</pre>
              </p>,
          }}
        />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ models }) => ({
  models
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchDeleteModel: (modelId) => dispatch(deleteModel(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
