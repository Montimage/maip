import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Divider, Form, Slider, Switch, Table, Col, Row, Button, Tooltip } from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Heatmap } from '@ant-design/plots';
import Papa from "papaparse";
import {
  requestModel,
} from "../actions";
import {
  SERVER_URL,
} from "../constants";

const style = {
  //background: '#0092ff',
  padding: '10px 0',
  border: '1px solid black',
};

const layout = {
  labelCol: {
    span: 8,
  },
  wrapperCol: {
    span: 16,
  },
};

class MetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      stats: "",
      predictions: [],
      confusionMatrix: [],
      cutoff: 0.5,
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    this.props.fetchModel(modelId);
    this.loadPredictions();
  }

  async loadPredictions() {
    const modelId = getLastPath();

    const predictionsResponse = await fetch(`${SERVER_URL}/api/models/${modelId}/predictions`, {
      method: 'GET',
    });
    const predictionsData = await predictionsResponse.json();
    const predictionsValues = predictionsData.predictions;
    //console.log(predictionsData);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));
    //console.log(predictions);
    this.setState({ predictions }, this.updateConfusionMatrix);
  }

  updateConfusionMatrix() {
    const { predictions, cutoff } = this.state;
    const truePositives = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoff).length;
    const falsePositives = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoff).length;
    const trueNegatives = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoff).length;
    const falseNegatives = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoff).length;
    const confusionMatrix = [
      [truePositives, falsePositives],
      [falseNegatives, trueNegatives],
    ];

    this.setState({ confusionMatrix });
  }

  handleCutoffChange(value) {
    this.setState({ cutoff: value }, () => {
      this.updateConfusionMatrix();
    });
  }

  render() {
    const {
      model,
    } = this.props;
    //console.log(model);
    let modelId = getLastPath();

    const { stats, buildConfig, trainingSamples, testingSamples } = model;

    const { 
      cutoff,
      predictions,
      confusionMatrix,
    } = this.state;
    console.log(`cutoff: ${cutoff}`);

    const columnsTableStats = [
      {
        title: 'Metric',
        dataIndex: 'metric',
        key: 'metric',
      },
      {
        title: 'Normal traffic',
        dataIndex: 'class0',
        key: 'class0',
      },
      {
        title: 'Malware traffic',
        dataIndex: 'class1',
        key: 'class1',
      },
    ];

    // Check if the stats have been loaded
    if (!stats) {
      return <div>Loading...</div>;
    }

    const rowsStats = stats.trim().split('\n').map(row => row.split(','));
    const headerStats = rowsStats[0].slice(1);
    const accuracy = parseFloat(rowsStats[rowsStats.length - 3][1]);
    const dataStats = headerStats.map((metric, i) => ({
      key: (i+1).toString(),
      metric,
      class0: +rowsStats[1][i+1],
      class1: +rowsStats[2][i+1],
    }));
    dataStats.push({
      key: '5',
      metric: 'accuracy',
      class0: accuracy,
      class1: accuracy,
    });
    console.log(dataStats);

    const highlightPercentage = true;
    //console.log(confusionMatrix);
    const cmStr = confusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
    console.log(cmStr);
    const headers = ["Normal traffic", "Malware traffic"];
    const rows = cmStr.trim().split('\n');
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      return cols.slice(1).map((val, j) => ({
        actual: headers[i],
        predicted: headers[j],
        count: Number(val),
        percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
      }));
    });

    const config = {
      data: data,
      forceFit: true,
      xField: 'predicted',
      yField: 'actual',
      colorField: 'count',
      shape: 'square',
      // TODO: percentage of label is undefined, not necessary ?
      /*tooltip: {
        formatter: (datum) => {
          return {
            name: `${datum.actual} -> ${datum.predicted}`,
            
            value: `Count: ${datum.count}, Percentage: ${datum.percentage}`,
          };
        },
      },*/
      tooltip: false,
      xAxis: { title: { style: { fontSize: 20 }, text: 'Predicted', } },
      yAxis: { title: { style: { fontSize: 20 }, text: 'Observed', } },
      label: {
        visible: true,
        position: 'middle',
        style: {
          fontSize: '18',
        },
        formatter: (datum) => {
          return `${datum.count}\n(${datum.percentage})`;
        },
      },
      heatmapStyle: {
        padding: 0,  
        stroke: '#fff',
        lineWidth: 1,
      },
    };

    return (
      <LayoutPage pageTitle="Accountability & Resilience Metrics" pageSubTitle={`Model ${modelId}`}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Accountability Metrics</h1>
        </Divider>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={`Shows a list of various model performance metrics for each class.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table columns={columnsTableStats} dataSource={dataStats} pagination={false}
               style={{marginTop: '20px'}} />
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Confusion Matrix</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title="The confusion matrix shows the number of True Negatives (predicted negative, observed negative), True Positives (predicted positive, observed positive), False Negatives (predicted negative, but observed positive) and False Positives (predicted positive, but observed negative). For different cutoff values, you will get a different number of False Positives and False Negatives. This plot allows you to find the optimal cutoff.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Form.Item name="slider" label="Cutoff" style={{ marginLeft: '50px', marginRight: '50px', marginBottom: '10px' }}>
                  <div style={{ width: '100%', display: 'inline-block', alignItems: 'center' }}>
                    <Tooltip title="Download plot as png">
                      <Slider
                        marks={{
                          0.01: '0.01',
                          0.25: '0.25',
                          0.50: '0.50',
                          0.75: '0.75',
                          0.99: '0.99',
                        }}
                        min={0.01}
                        max={0.99}
                        step={0.01}
                        value={cutoff}
                        defaultValue={cutoff}
                        onChange={(value) => this.handleCutoffChange(value)}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', height: '410px', width: '100%', maxWidth: '480px' }}>
                    <Heatmap {...config} />
                  </div>
                </div>
              </div>
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Currentness Metric</h2>
            </div>
          </Col>
        </Row>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Resilience Metrics</h1>
        </Divider>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Impact Metric</h2>
            </div>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ model }) => ({
  model
});

const mapDispatchToProps = (dispatch) => ({
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(MetricsPage);