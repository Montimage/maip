import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Divider, Form, Slider, Switch, Table, Col, Row, Button, Tooltip } from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Heatmap, Column } from '@ant-design/plots';
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
      stats: [],
      predictions: [],
      confusionMatrix: [],
      classificationData: [],
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
    const TP = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoff).length;
    const FP = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoff).length;
    const TN = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoff).length;
    const FN = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoff).length;
    const confusionMatrix = [
      [TP, FP],
      [FN, TN],
    ];

    this.setState({ confusionMatrix });

    const accuracy = (TP + TN) / (TP + TN + FP + FN);
    const precision = TP / (TP + FP);
    const recall = TP / (TP + FN);
    const f1Score = (2 * precision * recall) / (precision + recall);

    const precisionPositive = TP / (TP + FP);
    const recallPositive = TP / (TP + FN);
    const f1ScorePositive = (2 * precisionPositive * recallPositive) / (precisionPositive + recallPositive);
    const supportPositive = TP + FN;

    const precisionNegative = TN / (TN + FN);
    const recallNegative = TN / (TN + FP);
    const f1ScoreNegative = (2 * precisionNegative * recallNegative) / (precisionNegative + recallNegative);
    const supportNegative = TN + FP;

    //console.log({accuracy, precision, recall, f1Score});
    //console.log({precisionPositive, recallPositive, f1ScorePositive, supportPositive});
    //console.log({precisionNegative, recallNegative, f1ScoreNegative, supportNegative});

    const stats = [
      [precisionPositive, recallPositive, f1ScorePositive, supportPositive],
      [precisionNegative, recallNegative, f1ScoreNegative, supportNegative],
      [accuracy],
    ];

    this.setState({ stats: stats });

    const classificationData = [
      {
        "cutoff": "Below cutoff",
        "class": "Normal traffic",
        "value": TN
      },
      {
        "cutoff": "Below cutoff",
        "class": "Malware traffic",
        "value": FP
      },
      {
        "cutoff": "Above cutoff",
        "class": "Normal traffic",
        "value": FN
      },
      {
        "cutoff": "Above cutoff",
        "class": "Malware traffic",
        "value": TP
      },
      {
        "cutoff": "Total",
        "class": "Normal traffic",
        "value": (TN + FN)
      },
      {
        "cutoff": "Total",
        "class": "Malware traffic",
        "value": (TP + FP)
      },
    ];    

    this.setState({ classificationData: classificationData });
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

    const { 
      cutoff,
      predictions,
      confusionMatrix,
      stats,
      classificationData,
    } = this.state;
    console.log(`cutoff: ${cutoff}`);
    console.log(stats);
    console.log(classificationData);

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

    const statsStr = stats.map((row, i) => `${i},${row.join(',')}`).join('\n');
    const rowsStats = statsStr.split('\n').map(row => row.split(','));
    const headerStats = ["precision", "recall", "f1score", "support"];
    let dataStats = [];
    if(rowsStats.length == 3) {
      const accuracy = parseFloat(rowsStats[2][1]);
      dataStats = headerStats.map((metric, i) => ({
        key: (i).toString(),
        metric,
        class0: +rowsStats[0][i+1],
        class1: +rowsStats[1][i+1],
      }));
      dataStats.push({
        key: '5',
        metric: 'accuracy',
        class0: accuracy,
        class1: accuracy,
      });
    }

    const cmStr = confusionMatrix.map((row, i) => `${i},${row.join(',')}`).join('\n');
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

    const configClassification = {
      data: classificationData,
      xField: 'cutoff',
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
          return `${(item.value * 100).toFixed(2)}%`;
        },
        style: {
          fill: '#fff',
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

    return (
      <LayoutPage pageTitle="Accountability & Resilience Metrics" pageSubTitle={`Model ${modelId}`}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Accountability Metrics</h1>
        </Divider>
        <Form.Item name="slider" label="Cutoff prediction probability" style={{ marginLeft: '50px', marginRight: '50px', marginBottom: '10px' }}>
          <div style={{ width: '100%', display: 'inline-block', alignItems: 'center' }}>
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
          </div>
        </Form.Item>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={`Shows a list of various model performance metrics for each class.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              {dataStats && <Table columns={columnsTableStats} dataSource={dataStats} pagination={false}
               style={{marginTop: '11px'}} />}
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
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                <div style={{ position: 'relative', height: '320px', width: '100%', maxWidth: '390px' }}>
                  <Heatmap {...config} />
                </div>
              </div>
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Classification Plot</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title="This plot shows the fraction of each class above and below the cutoff.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Column {...configClassification} style={{ margin: '20px' }}/>
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