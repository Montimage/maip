import React, { Component } from "react";
import { connect } from "react-redux";
import { Typography, Form, Table, Space, Button, Select } from "antd";
import { Link } from 'react-router-dom';
import LayoutPage from "./LayoutPage";
import Papa from "papaparse";
import { 
  FolderViewOutlined, DownloadOutlined, FileOutlined, TableOutlined, 
  LineChartOutlined, SolutionOutlined, BugOutlined, ExperimentOutlined,
  HourglassOutlined, RestOutlined, QuestionOutlined,
} from '@ant-design/icons';
import {
  requestAllModels,
  requestDeleteModel,
  requestUpdateModel,
  requestDownloadModel,
} from "../actions";
import moment from "moment";
const {
  SERVER_URL,
} = require('../constants');
const { Text } = Typography;
const { Option, OptGroup } = Select;

function removeCsvPath(buildConfig) {
  const updatedDatasets = buildConfig.datasets.map((dataset) => {
    const parts = dataset.csvPath.split('/');
    const newCsvPath = parts.slice(parts.indexOf('outputs') + 1).join('/');
    //console.log(newCsvPath);
    return {
      ...dataset,
      csvPath: newCsvPath,
    };
  });

  // remove "total_samples" for old buildConfig
  const { total_samples, ...newBuildConfig } = buildConfig;
  return {
    ...newBuildConfig,
    datasets: updatedDatasets,
  };
}

class ModelListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      selectedOption: null, // if "", don't see placeholder
    };
  }

  componentDidMount() {
    this.props.fetchAllModels();
  }

  // TODO: move this function to Sage & Redux ???
  async handleDownloadDataset(modelId, datasetType) {
    try {
      const res = await fetch(`${SERVER_URL}/api/models/${modelId}/datasets/${datasetType}/download`);
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

  async handleDownloadModel(modelId) {
    try {
      const res = await fetch(`${SERVER_URL}/api/models/${modelId}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', modelId);
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error('Error downloading model:', error);
    }
  }

  render() {
    const { models, deleteModel, updateModel } = this.props;
    const { selectedOption } = this.state;
    console.log(models);

    if (!models) {
      console.error("No models")
      return null;
    }

    const handleOptionClick = (option, modelId) => {
      if (option.onClick) {
        option.onClick(modelId);
      }
      this.setState({ selectedOption: null });
    };

    const dataSource = models.map((model, index) => ({ ...model, key: index }));
    const columns = [
      {
        title: "Model Id",
        key: "data",
        width: '25%',
        render: (model) => (
          <Text
            editable={{
              onChange: (newModelId) => {
                updateModel(model.modelId, newModelId);
              },
            }}
            code
          > {model.modelId}</Text>
        ),
      },
      {
        title: "Built At",
        key: "data",
        sorter: (a, b) => a.lastBuildAt - b.lastBuildAt,
        render: (model) => {
          console.log(model.lastBuildAt);
          return moment(model.lastBuildAt).format("MMMM Do YYYY, h:mm:ss a");
        },
        width: '20%', /* width: 300, */
      },
      {
        title: "Training Dataset",
        key: "data",
        width: '20%',
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
        width: '20%',
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
        title: "Actions",
        key: "data",
        width: '15%',
        render: (model) => {
          const options = [
            {
              label: 'Retrain',
              icon: <HourglassOutlined />,
              url: `/retrain/${model.modelId}`,
              onClick: () => {
                console.log("Option Retrain clicked!");
                window.location.href = `/retrain/${model.modelId}`;
              }
            },
            {
              label: 'Predict',
              icon: <LineChartOutlined />,
              url: `/predict/${model.modelId}`,
              onClick: () => {
                console.log("Option Predict clicked!");
                window.location.href = `/predict/${model.modelId}`;
              }
            },
            {
              label: (
                <span style={{ fontSize: '16px' }}>XAI</span>
              ),
              options: [
                {
                  label: 'Shap',
                  icon: <SolutionOutlined />,
                  url: `/xai/shap/${model.modelId}`,
                  onClick: () => {
                    console.log("Option XAI Shap clicked!");
                    window.location.href = `/xai/shap/${model.modelId}`;
                  }
                },
                {
                  label: 'Lime',
                  icon: <SolutionOutlined />,
                  url: `/xai/lime/${model.modelId}`,
                  onClick: () => {
                    console.log("Option XAI Lime clicked!");
                    window.location.href = `/xai/lime/${model.modelId}`;
                  }
                },
              ]
            },
            {
              label: 'Metrics',
              icon: <ExperimentOutlined />,
              url: `/metrics/${model.modelId}`,
              onClick: () => {
                console.log("Option Metrics clicked!");
                window.location.href = `/metrics/${model.modelId}`;
              }
            },
            {
              label: 'Attacks',
              icon: <BugOutlined />,
              url: `/attacks/${model.modelId}`,
              onClick: () => {
                console.log("Option Attacks clicked!");
                window.location.href = `/attacks/${model.modelId}`;
              }
            },
            {
              label: 'Delete',
              icon: <RestOutlined />,
              onClick: () => deleteModel(model.modelId)
            }
          ];
          return (
            <Select placeholder="Select an action"
              style={{ width: 200 }}
              value={selectedOption}
              onChange={(value, option) => handleOptionClick(option, model.modelId)}
            >
              {options.map(option => {
                if (option.options) {
                  return (
                    <OptGroup key={option.label} label={option.label}>
                      {option.options.map(subOption => (
                        <Option key={subOption.label} value={subOption.url} onClick={subOption.onClick}>
                          <Space wrap>
                            {subOption.icon}
                            {subOption.label}
                          </Space>
                        </Option>
                      ))}
                    </OptGroup>
                  );
                } else {
                  return (
                    <Option key={option.label} value={option.url} onClick={option.onClick}>
                      <Space wrap>
                        {option.icon}
                        {option.label}
                      </Space>
                    </Option>
                  );
                }
              })}
            </Select>
          );
        },
      },
    ];
        
    return (
      <LayoutPage pageTitle="Models" pageSubTitle="All the deep learning models">
        <a href={`/build`}>
          <Space wrap>
            <Button style={{ marginBottom: '16px' }}>
              Build a new model
            </Button>
          </Space>
        </a>
        <Table columns={columns} dataSource={dataSource}
          pagination={{ pageSize: 5 }}
          expandable={{
            expandedRowRender: (model) => 
              <p style={{ margin: 0 }}>
                <h3><b>Build config:</b></h3>
                <pre style={{ fontSize: "12px" }}>
                  {JSON.stringify(removeCsvPath(model.buildConfig), null, 2)}
                </pre>
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
  deleteModel: (modelId) => dispatch(requestDeleteModel(modelId)),
  updateModel: (modelId, newModelId) => {
    // should dispatch with both modelId and newModelId as the payload
    dispatch(requestUpdateModel({modelId, newModelId}))
  },
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
