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
  getLastPath,
} from "../utils";
import Papa from "papaparse";
import { Column, G2} from '@ant-design/plots';
import { message, Col, Row, Divider, Slider, Form, Button, Checkbox, Select, Tooltip } from 'antd';
import { QuestionOutlined } from "@ant-design/icons";
import {
  FORM_LAYOUT, BOX_STYLE,
  SERVER_URL,
  ATTACK_OPTIONS, ATTACKS_SLIDER_MARKS
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
      isRunning: props.attacksStatus.isRunning,
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

  handleTargetClass = (checkedValues) => {
    let targetClass = null;
    if (checkedValues.length > 1) {
      message.error('You can only select one option');
      this.setState({ targetClass: null, checkboxValues: [] });
    } else {
      if (checkedValues.length === 1) {
        if (checkedValues[0].includes('Malware')) {
          targetClass = 1;
        } else {
          targetClass = 0;
        }
      }
      this.setState({ targetClass, checkboxValues: checkedValues });
    }
  }

  displayPoisonedDataset(modelId, selectedAttack, poisoningRate, targetClass) {
    fetch(`${SERVER_URL}/api/attacks/poisoning/${selectedAttack}/${modelId}/view`)
      .then(response => response.text())
      .then(data => {
        Papa.parse(data, {
          header: true,
          skipEmptyLines: true,
          delimiter: ';',
          complete: (results) => {
            const csvDataPoisoned = results.data;
            const headers = Object.keys(csvDataPoisoned[0]);
            this.setState({
              csvDataPoisoned: csvDataPoisoned,
              headers: headers,
            });
          },
          error: () => {
            console.log('Error parsing CSV file');
          },
        });
      });
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId, selectedAttack, poisoningRate, targetClass } = this.state;
    const datasetType = "train";
    
    if (prevProps.attacksStatus.isRunning !== this.props.attacksStatus.isRunning) {
      console.log('State isRunning has been changed');
      this.setState({ isRunning: this.props.attacksStatus.isRunning });
      if (!this.props.attacksStatus.isRunning) {
        console.log('isRunning changed from True to False');
        this.displayPoisonedDataset(modelId, selectedAttack, poisoningRate, targetClass);
      }
    }

    if (prevState.modelId !== this.state.modelId) {
      fetch(`${SERVER_URL}/api/models/${modelId}/datasets/${datasetType}/view`)
      .then(response => response.text())
        .then(data => {
          Papa.parse(data, {
            header: true,
            skipEmptyLines: true,
            delimiter: ';',
            complete: (results) => {
              const csvDataOriginal = results.data;
              const headers = Object.keys(csvDataOriginal[0]);
              this.setState({
                csvDataOriginal: csvDataOriginal,
                headers: headers,
              });
            },
            error: () => {
              console.log('Error parsing CSV file');
            },
          });
        });
    }

    // Check if csvDataPoisoned state is updated and clear the interval if it is
    if (prevState.csvDataPoisoned !== this.state.csvDataPoisoned) {
      clearInterval(this.intervalId);
    }
  }

  async handlePerformAttackClick(modelId, selectedAttack, poisoningRate, targetClass) {
    const { isRunning } = this.state;
    if (!isRunning) {
      console.log("handlePerformAttackClick update isRunning state!");
      this.setState({ isRunning: true });        
      this.props.fetchPerformAttack(modelId, selectedAttack, poisoningRate, targetClass);
      this.intervalId = setInterval(() => { // start interval when button is clicked
        this.props.fetchAttacksStatus();
      }, 1000);
    }
  }

  handleChangeSelectedAttack = value => {
    this.setState({ selectedAttack: value });
    if (value !== 'tlf') {
      this.setState({ checkboxValues: [] });
    }
  }

  render() {
    const {
      modelId,
      csvDataOriginal,
      csvDataPoisoned,
      poisoningRate, 
      selectedAttack, 
      targetClass,
    } = this.state;
    const {
      app,
      models,
      attacksStatus, 
    } = this.props;
    console.log(models);
    console.log(`Attacks isRunning: ${attacksStatus.isRunning}`);

    let filteredModels = [];
    let targetOptions = [];
    if (app === 'ac') {
      filteredModels = models.filter(model => model.modelId.startsWith('ac-'));
      targetOptions = ['Web', 'Interaction', 'Video']; 
    } else if (app === 'ad') {
      filteredModels = models.filter(model => !model.modelId.startsWith('ac-'));
      targetOptions = ['Normal traffic', 'Malware traffic'];
    } else {
      // TODO: handle the RCA app
      targetOptions = ['Normal traffic', 'Malware traffic'];
    }
    const modelsOptions = filteredModels ? filteredModels.map(model => ({
      value: model.modelId,
      label: model.modelId,
    })) : [];
    console.log(modelsOptions);

    const labelsDataOriginal = csvDataOriginal.map((row) => row.malware);
    const labelsDataPoisoned = csvDataPoisoned.map((row) => parseInt(row.malware).toString());
    //console.log(labelsDataOriginal);
    //console.log(labelsDataPoisoned);
    const totalSamples = labelsDataOriginal.length;
    const groupedDataOriginal = labelsDataOriginal.reduce((acc, label) => {
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const groupedDataPoisoned = labelsDataPoisoned.reduce((acc, label) => {
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    console.log(groupedDataOriginal);
    console.log(groupedDataPoisoned);

    const dataLabelsColumn = [
      {
        "datasetType": "original",
        "class": "Normal traffic",
        "count": (groupedDataOriginal['0'] || 0),
        "value": ((groupedDataOriginal['0'] || 0) * 100) / totalSamples
      },
      {
        "datasetType": "original",
        "class": "Malware traffic",
        "count": (groupedDataOriginal['1'] || 0),
        "value": ((groupedDataOriginal['1'] || 0) * 100) / totalSamples
      },
      {
        "datasetType": "poisoned",
        "class": "Normal traffic",
        "count": (groupedDataPoisoned['0'] || 0),
        "value": ((groupedDataPoisoned['0'] || 0) * 100) / totalSamples
      },
      {
        "datasetType": "poisoned",
        "class": "Malware traffic",
        "count": (groupedDataPoisoned['1'] || 0),
        "value": ((groupedDataPoisoned['1'] || 0) * 100) / totalSamples
      },
    ];

    G2.registerInteraction('element-link', {
      start: [
        {
          trigger: 'interval:mouseenter',
          action: 'element-link-by-color:link',
        },
      ],
      end: [
        {
          trigger: 'interval:mouseleave',
          action: 'element-link-by-color:unlink',
        },
      ],
    });
    const configLabelsColumn = {
      data: dataLabelsColumn,
      xField: 'datasetType',
      yField: 'value',
      seriesField: 'class',
      isPercent: true,
      isStack: true,
      meta: {
        value: {
          min: 0,
          max: 1,
        },
      },
      label: {
        position: 'middle',
        content: (item) => {
          return `${item.count} (${(item.value * 100).toFixed(2)}%)`;
        },
        style: {
          fill: '#fff',
          fontSize: 16,
        },
      },
      tooltip: false,
      interactions: [
        {
          type: 'element-highlight-by-color',
        },
        {
          type: 'element-link',
        },
      ],
    };

    const subTitle = isModelIdPresent ? 
      `Adversarial attacks against model ${modelId}` : 
      'Adversarial attacks against models';

    return (
      <LayoutPage pageTitle="Adversarial Attacks" pageSubTitle={subTitle}>
        <Form {...FORM_LAYOUT} name="control-hooks" style={{ maxWidth: 700 }}>
          <Form.Item name="model" label="Model" 
            style={{ flex: 'none', marginBottom: 10 }}
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
                allowClear showSearch
                value={this.state.modelId}
                disabled={isModelIdPresent}
                onChange={(value) => {
                  this.setState({ modelId: value });
                  console.log(`Select model ${value}`);
                }}
                //optionLabelProp="label"
                options={modelsOptions}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item name="slider" label="Poisoning percentage"
            style={{ marginBottom: 0 }}
          >
            <Slider
              marks={ATTACKS_SLIDER_MARKS}
              min={0} max={100} defaultValue={poisoningRate}
              value={poisoningRate}
              onChange={value => this.setState({ poisoningRate: value })}
            />
          </Form.Item>

          <Form.Item name="attack" label="Adversarial attack" 
            style={{ flex: 'none', marginBottom: 10 }}
            rules={[
              {
                required: true,
                message: 'Please select an attack!',
              },
            ]}
          >
            <Tooltip title="Select an adversarial attack to be performed against the model.">
              <Select
                style={{
                  width: '100%',
                }}
                allowClear
                placeholder="Select an attack ..."
                onChange={this.handleChangeSelectedAttack}
                optionLabelProp="label"
                options={ATTACK_OPTIONS}
              />
            </Tooltip>
          </Form.Item>
          <Form.Item name="checkbox" label="Target class" 
            valuePropName="checked"
            style={{ flex: 'none', marginBottom: 10 }}
          >
            <Checkbox.Group 
              options={targetOptions}
              value={this.state.checkboxValues}
              disabled={this.state.selectedAttack !== 'tlf'}
              onChange={this.handleTargetClass}
            />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button type="primary" //>icon={<BugOutlined />}
              onClick={() => {
                console.log({ modelId, selectedAttack, poisoningRate, targetClass });
                this.handlePerformAttackClick(modelId, selectedAttack, poisoningRate, targetClass);
              }}
              disabled={ !this.state.modelId || !this.state.selectedAttack || 
                (this.state.selectedAttack === 'tlf' && this.state.targetClass === null) }
              >Perform Attack
            </Button>
          </div>
        </Form>

        {csvDataOriginal.length > 0 && csvDataPoisoned.length > 0 &&
          <>
            <Divider orientation="left">
              <h1 style={{ fontSize: '24px' }}>Compare Original and Poisoned Training Datasets</h1>
            </Divider>
            <Row gutter={24}>
              <Col className="gutter-row" span={12}>
                <div style={BOX_STYLE}>          
                  <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <Tooltip title="The plot displays the frequency of output labels before and after an attack, represented as percentages. It provides a visual comparison of the distribution of labels in the original and poisoned training datasets.">
                      <Button type="link" icon={<QuestionOutlined />} />
                    </Tooltip>
                  </div>
                  <Column {...configLabelsColumn} style={{ margin: '20px' }}/>
                </div>
              </Col>
            </Row>
          </>
        }
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