import React, { Component } from "react";
import { connect } from "react-redux";
import LayoutPage from "./LayoutPage";
import {
  requestApp,
  requestAllModels,
  requestPerformAttack,
  requestAttacksStatus,
} from "../actions";
import { 
  isACModel,
  getLastPath,
  getFilteredModelsOptions,
  getLabelsList,
  getConfigLabelsColumn,
} from "../utils";
import {
  requestViewModelDatasets,
  requestViewPoisonedDatasets,
} from "../api";
import Papa from "papaparse";
import { Column } from '@ant-design/plots';
import { Spin, message, Col, Row, Divider, Slider, Form, Button, Checkbox, Select, Tooltip, Card, Statistic, Space, Alert } from 'antd';
import { WarningOutlined, ExperimentOutlined, PercentageOutlined, PlayCircleOutlined } from "@ant-design/icons";
import {
  FORM_LAYOUT, BOX_STYLE,
  ATTACK_OPTIONS, ATTACKS_SLIDER_MARKS, 
  AC_OUTPUT_LABELS, AD_OUTPUT_LABELS,
  AC_CLASS_MAPPING, AD_CLASS_MAPPING,
} from "../constants";

let isModelIdPresent = getLastPath() !== "attacks";

class AttacksPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelId: null,
      csvDataOriginal: [],
      csvDataPoisoned: [],
      poisoningRate: 50,
      selectedAttack: null,
      targetClass: null,
      checkboxValues: [],
      isRunning: false,
    };
    this.handleTargetClass = this.handleTargetClass.bind(this);
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  componentWillUnmount() {
    clearInterval(this.intervalId);
  }

  handleTargetClass = (checkedValues) => {
    const { modelId } = this.state;
    let targetClass = null;
    if (checkedValues.length > 1) {
      message.error('You can only select one option');
      this.setState({ targetClass: null, checkboxValues: [] });
    } else {
      if (checkedValues.length === 1) {
        const labelMapping = isACModel(modelId) ? AC_CLASS_MAPPING : AD_CLASS_MAPPING;
        const targetClasses = Object.keys(labelMapping).filter(
                                key => labelMapping[key] === checkedValues[0]);
        
        if (targetClasses.length > 0) {
            targetClass = parseInt(targetClasses[0]);
        } else {
            message.error(`Invalid option for ${isACModel(modelId) ? 'AC' : 'AD'} model`);
        }
      }
      this.setState({ targetClass, checkboxValues: checkedValues });
    }
  }

  async fetchCSVPoisonedDataset(modelId, selectedAttack) {
    try {
      const csvDataPoisonedString = await requestViewPoisonedDatasets(modelId, selectedAttack);
  
      Papa.parse(csvDataPoisonedString, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
        complete: (results) => {
          const csvDataPoisoned = results.data;
          this.setState({ csvDataPoisoned });
        },
        error: () => {
          console.log('Error parsing CSV file');
        },
      });
    } catch (error) {
      console.error("Failed to fetch model dataset:", error);
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId, selectedAttack } = this.state;
    const { attacksStatus } = this.props;
    const datasetType = "train";
    
    if (prevProps.attacksStatus.isRunning === true && attacksStatus.isRunning === false) {
      console.log('State isRunning has been changed from true to false');
      this.setState({ isRunning: false });
      if (selectedAttack) {
        this.fetchCSVPoisonedDataset(modelId, selectedAttack);
      }
    }

    if (prevState.modelId !== this.state.modelId) {
      try {
        const csvDataString = await requestViewModelDatasets(modelId, datasetType);
    
        Papa.parse(csvDataString, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';',
          complete: (results) => {
            const csvDataOriginal = results.data;
            this.setState({ csvDataOriginal });
          },
          error: () => {
            console.log('Error parsing CSV file');
          },
        });
      } catch (error) {
        console.error("Failed to fetch model dataset:", error);
      }
    }

    // Check if csvDataPoisoned state is updated and clear the interval if it is
    if (prevState.csvDataPoisoned !== this.state.csvDataPoisoned) {
      clearInterval(this.intervalId);
    }
  }

  async handlePerformAttackClick(modelId, selectedAttack, poisoningRate, targetClass) {
    const { isRunning } = this.state;
    if (!isRunning) {
      this.setState({ isRunning: true });        
      this.props.fetchPerformAttack(modelId, selectedAttack, poisoningRate, targetClass);
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchAttacksStatus();
      }, 1000);
    }
  }

  handleChangeSelectedAttack = selectedAttack => {
    this.setState({ selectedAttack, csvDataPoisoned: [] });
    if (selectedAttack !== 'tlf') {
      this.setState({ checkboxValues: [] });
    }
  }

  updateData(modelId, csvDataOriginal, csvDataPoisoned) {
    const CLASS_LABELS = isACModel(modelId) ? AC_OUTPUT_LABELS : AD_OUTPUT_LABELS;
    const CLASS_MAPPING = isACModel(modelId) ? AC_CLASS_MAPPING : AD_CLASS_MAPPING;

    const labelsDataOriginal = csvDataOriginal.map((row) => 
      isACModel(modelId) ? CLASS_MAPPING[row.output] : CLASS_MAPPING[row.malware]);
    const labelsDataPoisoned = csvDataPoisoned.map((row) => 
      isACModel(modelId) ? CLASS_MAPPING[parseInt(row.output)] : CLASS_MAPPING[parseInt(row.malware)]);
    console.log(labelsDataOriginal);
    console.log(labelsDataPoisoned);

    const totalSamples = labelsDataOriginal.length;
    const groupedDataOriginal = labelsDataOriginal.reduce((acc, label) => {
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const groupedDataPoisoned = labelsDataPoisoned.reduce((acc, label) => {
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const dataLabelsColumn = [];
    // Generate data for each class label for both the original and poisoned datasets
    CLASS_LABELS.forEach(label => {
      dataLabelsColumn.push(
        {
          "datasetType": "original",
          "class": label,
          "count": (groupedDataOriginal[label] || 0),
          "value": ((groupedDataOriginal[label] || 0) * 100) / totalSamples
        },
        {
          "datasetType": "poisoned",
          "class": label,
          "count": (groupedDataPoisoned[label] || 0),
          "value": ((groupedDataPoisoned[label] || 0) * 100) / totalSamples
        }
      );
    });

    console.log(dataLabelsColumn);

    return dataLabelsColumn;
  }

  render() {
    const {
      modelId,
      csvDataOriginal,
      csvDataPoisoned,
      poisoningRate, 
      selectedAttack,
      targetClass,
      isRunning,
    } = this.state;
    const {
      app,
      models,
    } = this.props;
    
    const modelsOptions = getFilteredModelsOptions(app, models);
    const targetOptions = getLabelsList(modelId);
    const dataLabelsColumn = this.updateData(modelId, csvDataOriginal, csvDataPoisoned);
    const configLabelsColumn = getConfigLabelsColumn(dataLabelsColumn); 

    const subTitle = isModelIdPresent ? 
      `Adversarial attacks against model ${modelId}` : 
      'Adversarial attacks against models';

    return (
      <LayoutPage pageTitle="Adversarial Attacks" pageSubTitle={subTitle}>
        
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Configuration</h2>
        </Divider>
        
        {/* Attack Configuration Card */}
        <Card
          bordered={false}
          style={{ marginBottom: 24 }}
        >
          <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }}>
            <Form.Item 
              name="model" 
              label={<strong>Model</strong>}
              style={{ marginBottom: 16 }}
              rules={[
                {
                  required: true,
                  message: 'Please select a model!',
                },
              ]}
            > 
              <Tooltip title="Select a model to perform attacks.">
                <Select
                  placeholder="Select a model ..."
                  style={{ width: '100%' }}
                  allowClear 
                  showSearch
                  value={this.state.modelId}
                  disabled={isModelIdPresent}
                  onClear={() => this.setState({ csvDataOriginal: [], csvDataPoisoned: [] })}
                  onChange={(value) => {
                    this.setState({ modelId: value });
                    console.log(`Select model ${value}`);
                  }}
                  options={modelsOptions}
                />
              </Tooltip>
            </Form.Item>
            
            <Form.Item 
              name="slider" 
              label={<strong>Poisoning Rate</strong>}
              style={{ marginBottom: 16 }}
            >
              <Slider
                marks={ATTACKS_SLIDER_MARKS}
                min={0} 
                max={100} 
                defaultValue={poisoningRate}
                value={poisoningRate}
                onChange={value => this.setState({ poisoningRate: value })}
              />
            </Form.Item>

            <Form.Item 
              name="attack" 
              label={<strong>Attack Type</strong>}
              style={{ marginBottom: 16 }}
              rules={[
                {
                  required: true,
                  message: 'Please select an attack!',
                },
              ]}
            >
              <Tooltip title="Select an adversarial attack to be performed against the model.">
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder="Select an attack ..."
                  onChange={this.handleChangeSelectedAttack}
                  onClear={() => this.setState({ csvDataPoisoned: [] })}
                  optionLabelProp="label"
                  options={ATTACK_OPTIONS}
                />
              </Tooltip>
            </Form.Item>
            
            <Form.Item 
              name="checkbox" 
              label={<strong>Target Class</strong>}
              valuePropName="checked"
              style={{ marginBottom: 24 }}
            >
              <Checkbox.Group 
                options={targetOptions}
                value={this.state.checkboxValues}
                disabled={this.state.selectedAttack !== 'tlf'}
                onChange={this.handleTargetClass}
              />
            </Form.Item>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Button 
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={isRunning}
                onClick={() => {
                  console.log({ modelId, selectedAttack, poisoningRate, targetClass });
                  this.handlePerformAttackClick(modelId, selectedAttack, poisoningRate, targetClass);
                }}
                disabled={ isRunning || !this.state.modelId || !this.state.selectedAttack || 
                  (this.state.selectedAttack === 'tlf' && this.state.targetClass === null) }
              >
                Perform Attack
              </Button>
            </div>
          </Form>
        </Card>

        {/* Results Section */}
        <Divider orientation="left">
          <h2 style={{ fontSize: '20px' }}>Results</h2>
        </Divider>
        {csvDataPoisoned && csvDataPoisoned.length > 0 && (
          <>
            {/* Attack Summary Statistics */}
            <Card 
            bordered={false} 
            style={{ marginBottom: 24 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>Attack Summary</strong>
            </div>
            <Row gutter={16}>
              <Col xs={24} sm={24} md={8}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <Statistic
                    title="Attack Type"
                    value={ATTACK_OPTIONS.find(a => a.value === selectedAttack)?.label || selectedAttack}
                    prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={24} md={8}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <Statistic
                    title="Poisoning Rate"
                    value={poisoningRate.toFixed(1)}
                    prefix={<PercentageOutlined />}
                    valueStyle={{ 
                      fontSize: 16, 
                      fontWeight: 'bold',
                      color: poisoningRate > 50 ? '#ff4d4f' : poisoningRate > 30 ? '#faad14' : '#52c41a' 
                    }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={24} md={8}>
                <Card hoverable style={{ textAlign: 'center' }}>
                  <Statistic
                    title="Poisoned Samples"
                    value={Math.round(csvDataOriginal.length * (poisoningRate / 100))}
                    suffix={`/ ${csvDataOriginal.length}`}
                    prefix={<ExperimentOutlined style={{ color: '#1890ff' }} />}
                    valueStyle={{ fontSize: 16, fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Dataset Comparison */}
          <Card
            bordered={false}
            style={{ marginBottom: 24 }}
          >
            <div style={{ color: '#666', marginBottom: 16, fontSize: '14px' }}>
              The plot displays the frequency of output labels before and after an attack, represented as percentages. It provides a visual comparison of the distribution of labels in the original and poisoned training datasets.
            </div>
            <Row gutter={24}>
              <Col xs={24} lg={16}>
                <div style={{ padding: '20px' }}>
                  <Column {...configLabelsColumn} />
                </div>
              </Col>
              <Col xs={24} lg={8}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Alert
                    message="Dataset Statistics"
                    description={
                      <div>
                        <p><strong>Original Dataset:</strong> {csvDataOriginal.length} samples</p>
                        <p><strong>Poisoned Dataset:</strong> {csvDataPoisoned.length} samples</p>
                        <p><strong>Modified Samples:</strong> {Math.round(csvDataOriginal.length * (poisoningRate / 100))} samples</p>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </Space>
              </Col>
            </Row>
          </Card>
          </>
        )}
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, attacksStatus }) => ({
  app, models, attacksStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchAttacksStatus: () => dispatch(requestAttacksStatus()),
  fetchPerformAttack: (modelId, selectedAttack, poisoningRate, targetClass) =>
    dispatch(requestPerformAttack({ modelId, selectedAttack, poisoningRate, targetClass })),
});

export default connect(mapPropsToStates, mapDispatchToProps)(AttacksPage);