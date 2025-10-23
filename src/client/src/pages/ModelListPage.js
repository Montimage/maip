import React, { Component } from "react";
import { connect } from "react-redux";
import { Modal, Tooltip, Typography, Table, Space, Button, Select, notification, Tag, Card, Input } from "antd";
import LayoutPage from "./LayoutPage";
import { useUserRole } from '../hooks/useUserRole';
import {
  FolderViewOutlined, DownloadOutlined, DeleteOutlined, SendOutlined,
  LineChartOutlined, SolutionOutlined, BugOutlined, ExperimentOutlined,
  HourglassOutlined, RestOutlined, CopyOutlined, EditOutlined, LockOutlined
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
      editingModelId: null,
      editingValue: '',
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
    const handleCopyModelId = (modelId) => {
      navigator.clipboard.writeText(modelId);
      notification.success({
        message: 'Copied to clipboard',
        description: `Model ID: ${modelId}`,
        placement: 'topRight',
        duration: 2,
      });
    };

    const handleEditStart = (modelId) => {
      this.setState({ 
        editingModelId: modelId, 
        editingValue: modelId 
      });
    };

    const handleEditCancel = () => {
      this.setState({ 
        editingModelId: null, 
        editingValue: '' 
      });
    };

    const handleEditSave = (oldModelId) => {
      const newModelId = this.state.editingValue.trim();
      
      if (!newModelId) {
        notification.error({
          message: 'Invalid model name',
          description: 'Model name cannot be empty',
          placement: 'topRight',
        });
        return;
      }

      if (this.props.app === 'ac' && !newModelId.startsWith('ac-')) {
        notification.error({
          message: 'Invalid model name',
          description: `AC model names must start with 'ac-'`,
          placement: 'topRight',
        });
        return;
      }

      updateModel(oldModelId, newModelId);
      notification.success({
        message: 'Model name updated',
        description: `${oldModelId} → ${newModelId}`,
        placement: 'topRight',
      });
      
      this.setState({ 
        editingModelId: null, 
        editingValue: '' 
      });
    };

    const columns = [
      {
        title: "Model Id",
        key: "data",
        width: '25%',
        sorter: (a, b) => {
          if(a.modelId < b.modelId) return -1;
          if(a.modelId > b.modelId) return 1;
          return 0;
        },
        render: (model) => {
          const isEditing = this.state.editingModelId === model.modelId;
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isEditing ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Input
                    value={this.state.editingValue}
                    onChange={(e) => this.setState({ editingValue: e.target.value })}
                    onPressEnter={() => handleEditSave(model.modelId)}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => handleEditSave(model.modelId)}
                  >
                    Save
                  </Button>
                  <Button 
                    size="small"
                    onClick={handleEditCancel}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 500,
                    color: '#262626',
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}>
                    {model.modelId}
                  </div>
                  <Space size="small" wrap>
                    <Tooltip title="Edit model name">
                      <Button
                        type="default"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditStart(model.modelId)}
                      >
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip title="Copy model ID">
                      <Button
                        type="default"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopyModelId(model.modelId)}
                      >
                        Copy
                      </Button>
                    </Tooltip>
                    <Tooltip title="Download model">
                      <Button
                        type="default"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => downloadModel(model.modelId)}
                      >
                        Download
                      </Button>
                    </Tooltip>
                  </Space>
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Built At",
        key: "data",
        sorter: (a, b) => a.lastBuildAt - b.lastBuildAt,
        defaultSortOrder: 'descend',
        render: (model) => {
          return moment(model.lastBuildAt).format('YYYY-MM-DD HH:mm:ss');
        },
        width: '12%',
      },
      {
        title: "Training Dataset",
        key: "data",
        width: '20%',
        render: (model) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <a href={`/models/datasets/${model.modelId}/train`} view>
                <Button size="small" icon={<FolderViewOutlined />}>View</Button>
              </a>
              <Button size="small" icon={<DownloadOutlined />}
                onClick={() => downloadDatasets(model.modelId, "train")}
              >Download</Button>
            </div>
            <Button 
              size="small" 
              icon={<SendOutlined />}
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
              disabled={!this.props.isAdmin}
              style={{ width: 'fit-content' }}
            >
              Send to NATS
            </Button>
          </div>
        ),
      },
      {
        title: "Testing Dataset",
        key: "data",
        width: '20%',
        render: (model) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <a href={`/models/datasets/${model.modelId}/test`} view>
                <Button size="small" icon={<FolderViewOutlined />}>View</Button>
              </a>
              <Button size="small" icon={<DownloadOutlined />}
                onClick={() => downloadDatasets(model.modelId, "test")}
              >Download</Button>
            </div>
            <Button 
              size="small" 
              icon={<SendOutlined />}
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
              disabled={!this.props.isAdmin}
              style={{ width: 'fit-content' }}
            >
              Send to NATS
            </Button>
          </div>
        ),
      },
      {
        title: "Actions",
        key: "data",
        width: '23%',
        render: (model) => {
          const options = [
            {
              label: (
                <span>
                  Retrain
                  {!this.props.isAdmin && (
                    <LockOutlined style={{ fontSize: '11px', color: '#faad14', marginLeft: '6px' }} />
                  )}
                </span>
              ),
              icon: <HourglassOutlined />,
              url: `/retrain/${model.modelId}`,
              disabled: !this.props.isAdmin,
              tooltip: !this.props.isAdmin ? "Admin access required" : "Retrain this model with new data",
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
              label: (
                <span>
                  Delete
                  {!this.props.isAdmin && (
                    <LockOutlined style={{ fontSize: '11px', color: '#faad14', marginLeft: '6px' }} />
                  )}
                </span>
              ),
              icon: <RestOutlined />,
              disabled: !this.props.isAdmin,
              tooltip: !this.props.isAdmin ? "Admin access required" : "Permanently delete this model from the database",
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
            <Select placeholder="Select action"
              style={{ width: '100%', minWidth: 140 }}
              popupMatchSelectWidth={false}
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
                  const optionContent = (
                    <Space wrap>
                      {option.icon}
                      {option.label}
                    </Space>
                  );
                  
                  return (
                    <Option 
                      key={option.label} 
                      value={option.url} 
                      onClick={option.onClick}
                      disabled={option.disabled}
                    >
                      {option.tooltip ? (
                        <Tooltip title={option.tooltip} placement="left">
                          {optionContent}
                        </Tooltip>
                      ) : (
                        optionContent
                      )}
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
        <Table 
          columns={columns} 
          dataSource={dataSource}
          pagination={{ pageSize: 10 }}
          scroll={{ y: 'calc(100vh - 320px)' }}
          size="middle"
          expandable={{
            expandedRowRender: (model) => {
              const buildConfig = convertBuildConfigStrToJson(this.props.app, model.buildConfig);
              let parsedConfig;
              let formattedJson;
              
              try {
                parsedConfig = JSON.parse(buildConfig);
                formattedJson = JSON.stringify(parsedConfig, null, 2);
              } catch (e) {
                parsedConfig = null;
                formattedJson = buildConfig;
              }
              
              // Syntax highlighting for JSON
              const highlightJson = (json) => {
                return json
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
                    let cls = 'json-number';
                    if (/^"/.test(match)) {
                      if (/:$/.test(match)) {
                        cls = 'json-key';
                      } else {
                        cls = 'json-string';
                      }
                    } else if (/true|false/.test(match)) {
                      cls = 'json-boolean';
                    } else if (/null/.test(match)) {
                      cls = 'json-null';
                    }
                    return `<span class="${cls}">${match}</span>`;
                  });
              };
              
              return (
                <Card 
                  title={
                    <span style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📋 Build Configuration
                      <Tag color="blue" style={{ fontSize: '11px' }}>JSON</Tag>
                    </span>
                  }
                  bordered={false}
                  size="small"
                  style={{ 
                    background: 'linear-gradient(to bottom, #fafafa, #f5f5f5)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    padding: '16px',
                    overflow: 'auto',
                    maxHeight: '600px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                  }}>
                    <pre 
                      style={{ 
                        margin: 0,
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: '#2c3e50',
                        fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace"
                      }}
                      dangerouslySetInnerHTML={{ __html: highlightJson(formattedJson) }}
                    />
                  </div>
                  <style>{`
                    .json-key { color: #c7254e; font-weight: 600; }
                    .json-string { color: #0d8050; }
                    .json-number { color: #ff6b35; }
                    .json-boolean { color: #0066cc; font-weight: 600; }
                    .json-null { color: #9b59b6; font-style: italic; }
                  `}</style>
                </Card>
              );
            },
          }}
          locale={{
            emptyText: <h3>No models found! Let's build a new one!</h3>,
          }}
        />

        <div style={{ marginTop: '16px' }}>
          <Space wrap>
            <Tooltip title={!this.props.isAdmin ? "Admin access required" : "Delete all models from the database"}>
              <Button 
                type="primary" 
                danger 
                icon={<DeleteOutlined />}
                onClick={this.showDeleteAllModelsConfirm}
                style={{ marginTop: '10px', marginBottom: '16px' }}
                disabled={dataSource.length === 0 || !this.props.isAdmin}
              >
                Delete All Models
              </Button>
            </Tooltip>
          </Space>
        </div>
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

// HOC to inject user role into class component
function withUserRole(Component) {
  return function WrappedComponent(props) {
    const userRole = useUserRole();
    return <Component {...props} isAdmin={userRole.isAdmin} />;
  };
}

export default connect(mapPropsToStates, mapDispatchToProps)(withUserRole(ModelListPage));
