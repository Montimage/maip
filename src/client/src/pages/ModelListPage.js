import React, { Component } from "react";
import { connect } from "react-redux";
import { Modal, Tooltip, Typography, Table, Space, Button, Select, notification } from "antd";
import LayoutPage from "./LayoutPage";
import {
  FolderViewOutlined, DownloadOutlined, DeleteOutlined, SendOutlined,
  LineChartOutlined, SolutionOutlined, BugOutlined, ExperimentOutlined,
  HourglassOutlined, RestOutlined, CopyOutlined, HighlightOutlined
} from '@ant-design/icons';
import {
  requestApp,
  setApp,
  requestAllModels,
  requestDeleteAllModels,
  requestDeleteModel,
  requestUpdateModel,
  requestDownloadModel,
  requestDownloadDatasets,
} from "../actions";
import { sendToNats } from "../utils/mitigation";
import {
  getFilteredModels,
  convertBuildConfigStrToJson
} from "../utils";
import { SERVER_URL } from "../constants";
import moment from "moment";
const { Text } = Typography;
const { Option, OptGroup } = Select;

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
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  showDeleteAllModelsConfirm = () => {
    Modal.confirm({
      title: 'Are you sure to delete all models?',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: () => {
        this.props.deleteAllModels(this.props.app);
      },
      onCancel: () => {
        console.log('Cancelled');
      },
    });
  };

  async componentDidUpdate(prevProps, prevState) {
    const { app } = this.props;

    if (app !== prevProps.app) {
      this.props.setApp(app);
    }
    console.log(`app is changed from ${prevProps.app} to ${app}`);
  }

  render() {
    const {
      app,
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
    console.log(`Selected app from ModelListPage: ${app}`);

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

    const filteredModels = getFilteredModels(app, models);
    const dataSource = filteredModels.length ?
                    filteredModels.map((model, index) => ({ ...model, key: index })) :
                    [];
    const columns = [
      {
        title: "Model Id",
        key: "data",
        width: '30%',
        sorter: (a, b) => {
          if(a.modelId < b.modelId) return -1;
          if(a.modelId > b.modelId) return 1;
          return 0;
        },
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
                if (this.props.app === 'ac' && !newModelId.startsWith('ac-')) {
                  notification.error({
                    type: 'error',
                    message: `AC model names must start with 'ac-'`,
                    placement: 'topRight',
                  });
                } else {
                  updateModel(model.modelId, newModelId);
                  notification.success({
                    type: 'success',
                    message: `Model ${model.modelId} name has been updated to ${newModelId}`,
                    placement: 'topRight',
                  });
                }
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
        defaultSortOrder: 'descend',
        render: (model) => {
          return moment(model.lastBuildAt).format('YYYY-MM-DD HH:mm:ss');
        },
        width: '15%', /* reduced width */
      },
      {
        title: "Training Dataset",
        key: "data",
        width: '20%',
        render: (model) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <a href={`/models/datasets/${model.modelId}/train`} view>
              <Button size="small" icon={<FolderViewOutlined />}>View</Button>
            </a>
            <Button size="small" icon={<DownloadOutlined />}
              onClick={() => downloadDatasets(model.modelId, "train")}
            >Download</Button>
            <Button size="small" icon={<SendOutlined />}
              onClick={async () => {
                try {
                  const res = await fetch(`${SERVER_URL}/api/security/nats-publish/dataset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelId: model.modelId, datasetType: 'train', chunkLines: 1000 }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  notification.success({ message: 'Sent training dataset to NATS', description: `Published in ${data.chunks} chunk(s)`, placement: 'topRight' });
                } catch (e) {
                  notification.error({ message: 'Failed to send training dataset to NATS', description: e.message || String(e), placement: 'topRight' });
                }
              }}
            >Send to NATS</Button>
          </div>
        ),
      },
      {
        title: "Testing Dataset",
        key: "data",
        width: '20%',
        render: (model) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <a href={`/models/datasets/${model.modelId}/test`} view>
              <Button size="small" icon={<FolderViewOutlined />}>View</Button>
            </a>
            <Button size="small" icon={<DownloadOutlined />}
              onClick={() => downloadDatasets(model.modelId, "test")}
            >Download</Button>
            <Button size="small" icon={<SendOutlined />}
              onClick={async () => {
                try {
                  const res = await fetch(`${SERVER_URL}/api/security/nats-publish/dataset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelId: model.modelId, datasetType: 'test', chunkLines: 1000 }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  notification.success({ message: 'Sent testing dataset to NATS', description: `Published in ${data.chunks} chunk(s)`, placement: 'topRight' });
                } catch (e) {
                  notification.error({ message: 'Failed to send testing dataset to NATS', description: e.message || String(e), placement: 'topRight' });
                }
              }}
            >Send to NATS</Button>
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
                window.location.href = `/predict/${model.modelId}`;
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
              onClick: () => {
                deleteModel(model.modelId);
                notification.success({
                  type: 'success',
                  message: `Model ${model.modelId} has been deleted`,
                  placement: 'topRight',
                });
              }
            }
          ];
          return (
            <Select placeholder="Select an action ..."
              style={{ width: 230 }}
              popupMatchSelectWidth={false}  // Set to false so dropdown width doesn't follow the select width
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
      <LayoutPage pageTitle="All Models" pageSubTitle="All the machine learning models">
        <Table columns={columns} dataSource={dataSource}
          pagination={{ pageSize: 7 }}
          expandable={{
            expandedRowRender: (model) =>
              <p style={{ margin: 0 }}>
                <h3><b>Build config:</b></h3>
                <pre style={{ fontSize: "12px" }}>
                  {convertBuildConfigStrToJson(this.props.app, model.buildConfig)}
                </pre>
              </p>,
          }}
          locale={{
            emptyText: <h3>No models found! Let's build a new one!</h3>,
          }}
        />

        <Space wrap>
          <Button type="primary" danger icon={<DeleteOutlined />}
            onClick={this.showDeleteAllModelsConfirm}
            style={{ marginTop: '10px', marginBottom: '16px' }}
            disabled={dataSource.length === 0}
          >
            Delete All Models
          </Button>
        </Space>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ models, app }) => ({
  models, app,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  setApp: (app) => dispatch(setApp(app)),
  fetchAllModels: () => dispatch(requestAllModels()),
  deleteAllModels: (app) => dispatch(requestDeleteAllModels(app)),
  downloadModel: (modelId) => dispatch(requestDownloadModel(modelId)),
  downloadDatasets: (modelId, datasetType) => {
    dispatch(requestDownloadDatasets({modelId, datasetType}))
  },
  deleteModel: (modelId) => dispatch(requestDeleteModel(modelId)),
  updateModel: (modelId, newModelId) => {
    dispatch(requestUpdateModel({modelId, newModelId}))
  },
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
