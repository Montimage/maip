import React, { Component } from "react";
import { connect } from "react-redux";
import { Tooltip, Typography, Table, Space, Button, Select } from "antd";
import LayoutPage from "./LayoutPage";
import { 
  FolderViewOutlined, DownloadOutlined,
  LineChartOutlined, SolutionOutlined, BugOutlined, ExperimentOutlined,
  HourglassOutlined, RestOutlined, CopyOutlined, HighlightOutlined
} from '@ant-design/icons';
import {
  requestAllModels,
  requestDeleteModel,
  requestUpdateModel,
  requestDownloadModel,
  requestDownloadDatasets,
} from "../actions";
import moment from "moment";
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

// TODO: add Grouped Column plot to compare model performance of 2 models?

class ModelListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      dataStatsLeft: [],
      dataStatsRight: [],
      selectedModelLeft: null,
      selectedModelRight: null,
      buildConfigLeft: null,
      buildConfigRight: null,
      cmConfigLeft: null,
      cmConfigRight: null,
      selectedOption: null,
      selectedCriteria: null,
    };
  }

  componentDidMount() {
    this.props.fetchAllModels();
  }

  render() {
    const { 
      models, 
      downloadModel, 
      downloadDatasets,
      deleteModel, 
      updateModel,
    } = this.props;
    const { 
      selectedOption,
    } = this.state;
    //console.log(models);

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

    const modelIds = models.map((model) => model.modelId);
    console.log(modelIds);
    const dataSource = models.map((model, index) => ({ ...model, key: index }));
    const columns = [
      {
        title: "Model Id",
        key: "data",
        width: '30%',
        render: (model) => (
          <Text
            copyable={{
              text: model.modelId,
              tooltip: 'Copy',
              icon: <CopyOutlined style={{ fontSize: '16px' }} />,
            }}
            editable={{
              icon: <HighlightOutlined style={{ fontSize: '16px' }}/>,
              tooltip: 'Edit',
              onChange: (newModelId) => {
                updateModel(model.modelId, newModelId);
              },
            }}
            keyboard
            style={{ display: 'flex', alignItems: 'center', gap: '24px' }}
          > 
            {model.modelId}
            <span style={{ marginLeft: '10px' }}>
              <Tooltip title="Download">
                <a href="#" title="Download"
                  onClick={() => downloadModel(model.modelId)}>
                  <DownloadOutlined style={{ fontSize: '16px' }} />
                </a>
              </Tooltip>
            </span>
          </Text>
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
                onClick={() => downloadDatasets(model.modelId, "train")}
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
                  onClick={() => downloadDatasets(model.modelId, "test")}
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
                window.location.href = `/models/retrain/${model.modelId}`;
              }
            },
            {
              label: 'Predict',
              icon: <LineChartOutlined />,
              url: `/predict/${model.modelId}`,
              onClick: () => {
                window.location.href = `/predict/offline/${model.modelId}`;
              }
            },
            {
              label: (
                <span style={{ fontSize: '16px' }}>XAI</span>
              ),
              options: [
                {
                  label: 'SHAP',
                  icon: <SolutionOutlined />,
                  url: `/xai/shap/${model.modelId}`,
                  onClick: () => {
                    window.location.href = `/xai/shap/${model.modelId}`;
                  }
                },
                {
                  label: 'LIME',
                  icon: <SolutionOutlined />,
                  url: `/xai/lime/${model.modelId}`,
                  onClick: () => {
                    window.location.href = `/xai/lime/${model.modelId}`;
                  }
                },
              ]
            },
            {
              label: 'Attacks',
              icon: <BugOutlined />,
              url: `/attacks/${model.modelId}`,
              onClick: () => {
                window.location.href = `/attacks/${model.modelId}`;
              }
            },
            {
              label: (
                <span style={{ fontSize: '16px' }}>Metrics</span>
              ),
              options: [
                {
                  label: 'Accountability',
                  icon: <ExperimentOutlined />,
                  url: `/metrics/accountability/${model.modelId}`,
                  onClick: () => {
                    window.location.href = `/metrics/accountability/${model.modelId}`;
                  }
                },
                {
                  label: 'Resilience',
                  icon: <ExperimentOutlined />,
                  url: `/metrics/resilience/${model.modelId}`,
                  onClick: () => {
                    window.location.href = `/metrics/resilience/${model.modelId}`;
                  }
                },
              ]
            },
            {
              label: 'Delete',
              icon: <RestOutlined />,
              onClick: () => deleteModel(model.modelId)
            }
          ];
          return (
            <Select placeholder="Select an action ..."
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
      <LayoutPage pageTitle="All Models" pageSubTitle="All the deep learning models">
        {/* <a href={`/build`}>
          <Space wrap>
            <Button type="primary" style={{ marginBottom: '16px' }}>
              Build a new model
            </Button>
          </Space>
        </a> */}
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
  downloadModel: (modelId) => dispatch(requestDownloadModel(modelId)),
  downloadDatasets: (modelId, datasetType) => {
    dispatch(requestDownloadDatasets({modelId, datasetType}))
  },
  deleteModel: (modelId) => dispatch(requestDeleteModel(modelId)),
  updateModel: (modelId, newModelId) => {
    // should dispatch with both modelId and newModelId as the payload
    dispatch(requestUpdateModel({modelId, newModelId}))
  },
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
