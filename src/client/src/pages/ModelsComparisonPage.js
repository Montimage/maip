import React, { Component } from "react";
import { connect } from "react-redux";
import { Row, Col, Tooltip, Table, Select } from "antd";
import LayoutPage from "./LayoutPage";
import { Heatmap } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
} from "../actions";
import {
  transformConfigStrToTableData,
  removeCsvPath,
  updateConfusionMatrix,
  getTablePerformanceStats,
  getConfigConfusionMatrix,
  getFilteredModels,
  getColumnsPerfStats,
  isACApp,
} from "../utils";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
} from "../api";
import './styles.css';

const {
  BOX_STYLE,
  CRITERIA_LIST, TABLE_BUILD_CONFIGS,
} = require('../constants');
const { Option } = Select;

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
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  componentDidUpdate(prevProps) {
    const { app } = this.props;
    if (prevProps.app !== app) {
      this.setState({
        selectedModelLeft: null,
        selectedModelRight: null,
        selectedCriteria: null,
      });
    }
  }

  async loadPredictions(modelId, isLeft) {
    const cutoffProb = 0.5; // default value
    const buildConfig = await requestBuildConfigModel(modelId);
    console.log(buildConfig);

    let dataBuildConfig;
    if (this.props.app === 'ad') {
      const transformedBuildConfig = removeCsvPath(JSON.parse(buildConfig));
      //console.log(transformedBuildConfig);

      const { datasets, training_ratio, training_parameters } = transformedBuildConfig;

      dataBuildConfig = [
        ...datasets.map(({ csvPath, isAttack }) => ({
          parameter: isAttack ? 'attack dataset' : 'normal dataset',
          value: csvPath,
        })),
        { parameter: 'training ratio', value: training_ratio },
        ...Object.entries(training_parameters).map(([parameter, value]) => ({
          parameter: parameter,
          value: value,
        })),
      ];
    } else {
      dataBuildConfig = transformConfigStrToTableData(buildConfig);
    }
    console.log(dataBuildConfig);

    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));

    const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
    const confusionMatrix = cm.confusionMatrix;
    const stats = cm.stats;
    this.setState({
      predictions,
      stats,
      confusionMatrix,
      classificationData: cm.classificationData
    });

    const dataStats = getTablePerformanceStats(modelId, stats, confusionMatrix);
    const configCM = confusionMatrix && getConfigConfusionMatrix(modelId, confusionMatrix);

    if (isLeft) {
      this.setState({
        selectedModelLeft: modelId,
        dataBuildConfigLeft: dataBuildConfig,
        dataStatsLeft: dataStats,
        cmConfigLeft: configCM,
      });
    } else {
      this.setState({
        selectedModelRight: modelId,
        dataBuildConfigRight: dataBuildConfig,
        dataStatsRight: dataStats,
        cmConfigRight: configCM,
      });
    }
  }

  render() {
    const {
      app,
      models,
    } = this.props;
    const {
      selectedCriteria,
      selectedModelLeft,
      selectedModelRight,
      dataBuildConfigLeft,
      dataBuildConfigRight,
      dataStatsLeft,
      dataStatsRight,
      cmConfigLeft,
      cmConfigRight,
    } = this.state;
    //console.log(models);

    if (!models) {
      console.error("No models")
      return null;
    }

    const filteredModels = getFilteredModels(app, models);
    const columnsPerfStats = getColumnsPerfStats(app);
    const modelIds = filteredModels.map((model) => model.modelId);
    const cmStyle = isACApp(this.props.app) ? "cmAC" : "cmAD";

    return (
      <LayoutPage pageTitle="Models Comparison" pageSubTitle="Comparing models based on performance metrics">
        <div style={BOX_STYLE}>
          <Row gutter={24}>
            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center' }}>
              <div><h3>Model 1:</h3></div>
            </Col>
            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center' }}>
              <div><h3>Comparison Criteria:</h3></div>
            </Col>
            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center' }}>
              <div><h3>Model 2:</h3></div>
            </Col>

            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center', marginTop: '-10px' }}>
              <Tooltip title="Select a model to compare.">
                <Select
                  showSearch allowClear
                  value={this.state.selectedModelLeft}
                  placeholder="Select a model ..."
                  onChange={(modelId) => modelId && this.loadPredictions(modelId, true)}
                  onClear={() => this.setState({ selectedModelLeft: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {modelIds.map((modelId) => (
                    <Option key={modelId} value={modelId}>
                      {modelId}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>

            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center', marginTop: '-10px' }}>
              <Tooltip title="Select a criteria for comparing the two selected models.">
                <Select
                  showSearch allowClear
                  value={this.state.selectedCriteria}
                  placeholder="Select a criteria ..."
                  onChange={(criteria) => this.setState({ selectedCriteria: criteria })}
                  onClear={() => this.setState({ selectedCriteria: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {CRITERIA_LIST.map((criteria) => (
                    <Option key={criteria} value={criteria}>
                      {criteria}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>

            <Col className="gutter-row" span={8} style={{ display: 'flex', justifyContent: 'center', marginTop: '-10px' }}>
              <Tooltip title="Select a model to compare.">
                <Select
                  showSearch allowClear
                  value={this.state.selectedModelRight}
                  placeholder="Select a model ..."
                  onChange={(modelId) => modelId && this.loadPredictions(modelId, false)}
                  onClear={() => this.setState({ selectedModelRight: null })}
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.value ?? '').includes(input)}
                  style={{ width: 350, marginTop: '15px', marginBottom: '15px' }}
                >
                  {modelIds.map((modelId) => (
                    <Option key={modelId} value={modelId}>
                      {modelId}
                    </Option>
                  ))}
                </Select>
              </Tooltip>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && dataBuildConfigLeft && (selectedCriteria === "Build Configuration") &&
                <div style={{ marginBottom: '20px', marginTop: '30px' }}>
                  <Table columns={TABLE_BUILD_CONFIGS} dataSource={dataBuildConfigLeft} pagination={false}
                  />
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight &&dataBuildConfigRight && (selectedCriteria === "Build Configuration") &&
                <div style={{ marginBottom: '20px', marginTop: '30px' }}>
                  <Table columns={TABLE_BUILD_CONFIGS} dataSource={dataBuildConfigRight} pagination={false}
                  />
                </div>
              }
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && dataStatsLeft && (selectedCriteria === "Model Performance") &&
                <div style={{marginBottom: '20px', marginTop: '30px'}}>
                  <Table columns={columnsPerfStats} dataSource={dataStatsLeft} pagination={false}
                  />
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && dataStatsRight && (selectedCriteria === "Model Performance") &&
                <div style={{marginBottom: '20px', marginTop: '30px'}}>
                  <Table columns={columnsPerfStats} dataSource={dataStatsRight} pagination={false}
                  />
                </div>
              }
            </Col>
          </Row>
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {selectedModelLeft && cmConfigLeft && (selectedCriteria === "Confusion Matrix") &&
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '40px', marginBottom: '10px' }}>
                    <div className={cmStyle}>
                      <Heatmap {...cmConfigLeft}/>
                    </div>
                  </div>
                </div>
              }
            </Col>
            <Col className="gutter-row" span={12}>
              {selectedModelRight && cmConfigRight && (selectedCriteria === "Confusion Matrix") &&
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '40px', marginBottom: '10px' }}>
                    <div className={cmStyle}>
                      <Heatmap {...cmConfigRight}/>
                    </div>
                  </div>
                </div>
              }
            </Col>
          </Row>
        </div>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models }) => ({
  app, models,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
