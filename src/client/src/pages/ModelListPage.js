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

  /* constructor(props) {
    super(props);
    this.state = {
      tableData: [],
      datasetId: this.props?.params?.datasetId // use optional chaining to access params
    };
  } */

  componentDidMount() {
    this.props.fetchAllModels();
  }

  /* componentDidMount() {
    this.props.fetchAllModels();
    const { modelId, datasetType } = this.props;
    fetch(`/models/${modelId}/datasets/${datasetType}/view`)
      .then(response => response.text())
      .then(data => {
        const parsedData = Papa.parse(data, { header: true }).data;
        this.setState({ tableData: parsedData });
      });
  } */

  /* viewDataset(modelId) {
    const response = await fetch(`/api/models/${modelId}/datasets/training/csv`);
    const data = await response.text();
    const rows = data.split('\n').map((row) => row.split(','));
    const headers = rows[0];
    const content = rows.slice(1, -1);
  
    // TODO: display the content in a table
  }; */

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
            {/* <br/>
             */}
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
            <a href={`/datasets/Train_samples.csv`} view>
              <Space wrap>
                <Button icon={<FolderViewOutlined />}>
                  {/* onClick={() => viewDataset(model.id)} */}
                  View
                </Button>
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
            <a href={`/datasets/test`} download>
                <Space wrap>
                  <Button icon={<FolderViewOutlined />}>
                    {/* onClick={() => viewDataset(model.id)} */}
                    View
                  </Button>
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
        <Table columns={columns} dataSource={dataSource} 
          pagination={{ pageSize: 5 }}
          expandable={{
            expandedRowRender: (model) => 
              <p style={{ margin: 0 }}>
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
