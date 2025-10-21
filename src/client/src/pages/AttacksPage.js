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
  requestQueueAttack,
  requestAttackJobStatus,
} from "../api";
import Papa from "papaparse";
import { Column } from '@ant-design/plots';
import { Spin, notification, Col, Row, Divider, Slider, Form, Button, Checkbox, Select, Tooltip, Card, Statistic, Space, Alert } from 'antd';
import { WarningOutlined, ExperimentOutlined, PercentageOutlined, PlayCircleOutlined, LineChartOutlined } from "@ant-design/icons";
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
      poisoningRate: 10,
      selectedAttack: null,
      targetClass: null,
      checkboxValues: [],
      isRunning: false,
      currentJobId: null,
      jobStatus: null,
      queuePosition: null,
      progress: 0,
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
      notification.error({
        message: 'Invalid Selection',
        description: 'You can only select one option',
        placement: 'topRight',
        duration: 4,
      });
      this.setState({ targetClass: null, checkboxValues: [] });
    } else {
      if (checkedValues.length === 1) {
        const labelMapping = isACModel(modelId) ? AC_CLASS_MAPPING : AD_CLASS_MAPPING;
        const targetClasses = Object.keys(labelMapping).filter(
                                key => labelMapping[key] === checkedValues[0]);
        
        if (targetClasses.length > 0) {
            targetClass = parseInt(targetClasses[0]);
        } else {
            notification.error({
              message: 'Invalid Option',
              description: `Invalid option for ${isACModel(modelId) ? 'AC' : 'AD'} model`,
              placement: 'topRight',
              duration: 4,
            });
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

    if (prevState.modelId !== this.state.modelId && modelId) {
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
      // Clear previous results
      this.setState({ 
        isRunning: true, 
        progress: 0, 
        queuePosition: null, 
        jobStatus: 'queuing',
        csvDataPoisoned: [] // Clear previous attack results
      });
      
      try {
        // Queue the attack
        const queueResponse = await requestQueueAttack(modelId, selectedAttack, poisoningRate, targetClass);
        const { jobId, position, estimatedTime } = queueResponse;
        
        console.log(`Attack queued: jobId=${jobId}, position=${position}, estimated=${estimatedTime}s`);
        
        this.setState({
          currentJobId: jobId,
          queuePosition: position,
          jobStatus: 'queued',
        });
        
        if (position > 1) {
          notification.info({
            message: 'Attack Queued',
            description: `Your attack is #${position} in queue. Estimated wait: ${estimatedTime}s`,
            placement: 'topRight',
            duration: 4,
          });
        }
        
        // Poll job status
        this.intervalId = setInterval(async () => {
          try {
            const jobStatus = await requestAttackJobStatus(this.state.currentJobId);
            console.log('Attack job status:', jobStatus.status, 'Progress:', jobStatus.progress, '%');
            
            this.setState({
              jobStatus: jobStatus.status,
              progress: jobStatus.progress || 0,
              queuePosition: jobStatus.queuePosition,
            });
            
            if (jobStatus.status === 'completed') {
              clearInterval(this.intervalId);
              this.intervalId = null;
              
              // Load results - use state values to ensure they're current
              console.log('Loading poisoned dataset...');
              const currentModelId = this.state.modelId;
              const currentAttack = this.state.selectedAttack;
              
              this.setState({ 
                isRunning: false, 
                progress: 100,
                jobStatus: 'completed',
                queuePosition: null,
              });
              
              notification.success({
                message: 'Attack Completed',
                description: `${currentAttack.toUpperCase()} attack completed successfully for model ${currentModelId}`,
                placement: 'topRight',
                duration: 5,
              });
              
              if (currentModelId && currentAttack) {
                await this.fetchCSVPoisonedDataset(currentModelId, currentAttack);
              }
              
            } else if (jobStatus.status === 'failed') {
              clearInterval(this.intervalId);
              this.intervalId = null;
              this.setState({ 
                isRunning: false,
                jobStatus: 'failed',
                queuePosition: null,
              });
              console.error('Attack failed:', jobStatus.failedReason);
              notification.error({
                message: 'Attack Failed',
                description: jobStatus.failedReason || 'Unknown error occurred',
                placement: 'topRight',
                duration: 6,
              });
            }
          } catch (error) {
            console.error('Error polling attack job status:', error);
            // Don't stop polling on transient errors
          }
        }, 5000); // Poll every 5 seconds
        
      } catch (error) {
        console.error('Error queueing attack:', error);
        this.setState({ 
          isRunning: false,
          jobStatus: 'failed',
        });
        notification.error({
          message: 'Failed to Queue Attack',
          description: error.message,
          placement: 'topRight',
          duration: 6,
        });
      }
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
      jobStatus,
      queuePosition,
      progress,
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
              label={<strong><span style={{ color: 'red' }}>* </span>Model</strong>}
              style={{ marginBottom: 16 }}
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
              label={<strong><span style={{ color: 'red' }}>* </span>Attack Type</strong>}
              style={{ marginBottom: 16 }}
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
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: 24 }}>
              <Button 
                type="primary"
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
              
              <Button
                type="primary"
                onClick={() => {
                  window.location.href = `/metrics/resilience/${modelId}?attack_type=${selectedAttack}`;
                }}
                disabled={!csvDataPoisoned || csvDataPoisoned.length === 0}
              >
                Compute Impact
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
            <Card style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
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
            <Card style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 16 }}>Dataset Comparison</strong>
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