import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Divider, Form, Slider, Switch, Table, Col, Row, Button, Tooltip } from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Line, Heatmap, Column } from '@ant-design/plots';
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
      cutoffProb: 0.5,
      cutoffPercentile: 0.5,
      fprs: [], 
      tprs: [], 
      auc: 0,
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
    this.updateROCAUC();
  }

  updateROCAUC() {
    const { predictions, cutoffProb } = this.state;
    // Calculate true positive rate (TPR) and false positive rate (FPR) for different cutoff probabilities
    const tprs = [];
    const fprs = [];
    const stepSize = 0.01;
    for (let cutoffProb = 0; cutoffProb <= 1; cutoffProb += stepSize) {
      const TP = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoffProb).length;
      const FP = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoffProb).length;
      const TN = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoffProb).length;
      const FN = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoffProb).length;

      const TPR = TP / (TP + FN);
      const FPR = FP / (FP + TN);
      tprs.push(TPR);
      fprs.push(FPR);
    }

    // Compute AUC by numerical integration of the ROC curve using trapezoidal rule
    let auc = 0;
    for (let i = 0; i < tprs.length - 1; i++) {
      auc += (fprs[i + 1] - fprs[i]) * (tprs[i + 1] + tprs[i]) / 2;
    }

    this.setState({ fprs, tprs, auc });
  }

  updateConfusionMatrix() {
    const { predictions, cutoffProb } = this.state;
    const TP = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoffProb).length;
    const FP = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoffProb).length;
    const TN = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoffProb).length;
    const FN = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoffProb).length;
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
        "cutoffProb": "Below cutoff",
        "class": "Normal traffic",
        "value": TN
      },
      {
        "cutoffProb": "Below cutoff",
        "class": "Malware traffic",
        "value": FP
      },
      {
        "cutoffProb": "Above cutoff",
        "class": "Normal traffic",
        "value": FN
      },
      {
        "cutoffProb": "Above cutoff",
        "class": "Malware traffic",
        "value": TP
      },
      {
        "cutoffProb": "Total",
        "class": "Normal traffic",
        "value": (TN + FN)
      },
      {
        "cutoffProb": "Total",
        "class": "Malware traffic",
        "value": (TP + FP)
      },
    ];    

    this.setState({ classificationData: classificationData });
  }

  handleCutoffProbChange(value) {
    this.setState({ cutoffProb: value }, () => {
      this.updateConfusionMatrix();
    });
  }

  computeCutoff(predictions) {
    const { cutoffPercentile } = this.state;

    // Sort the predictions array based on the prediction values in ascending order
    predictions.sort((a, b) => a.prediction - b.prediction);

    // Determine the index corresponding to the cutoff percentile
    const cutoffIndex = Math.floor(predictions.length * cutoffPercentile);

    // Retrieve the prediction value at the cutoff index
    const cutoffProb = predictions[cutoffIndex].prediction;

    console.log('Cutoff Percentile of samples:', cutoffPercentile);
    console.log('Cutoff Prediction Probability:', cutoffProb);

    return cutoffProb;
  }

  handleCutoffPercentileChange(value) {
    const { predictions } = this.state;
    const cutoffProb = this.computeCutoff(predictions);
    this.setState({ cutoffPercentile: value, cutoffProb: cutoffProb });
    this.handleCutoffProbChange(cutoffProb);
  }

  render() {
    const {
      model,
    } = this.props;
    //console.log(model);
    let modelId = getLastPath();

    const { 
      cutoffProb,
      cutoffPercentile,
      predictions,
      confusionMatrix,
      stats,
      classificationData,
      fprs, tprs, auc,
    } = this.state;
    console.log(`cutoffProb: ${cutoffProb}`);
    console.log(`cutoffPercentile: ${cutoffPercentile}`);
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
      xField: 'cutoffProb',
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


    const dataROC = [
        { fpr: 0, tpr: 0 },
        ...fprs.map((fpr, i) => ({ fpr, tpr: tprs[i] })),
        { fpr: 1, tpr: 1 },
      ];
    console.log(dataROC);


    const configROCAUC = {
      data: dataROC,
      xField: 'fpr',
      yField: 'tpr',
      //seriesField: 'index',
    };

    // Create the ROC AUC plot configuration object
    /*const configROCAUC = {
      data: dataROC,
      xField: 'fpr',
      yField: 'tpr',
      label: {
        formatter: (datum) => `cutoff = ${(datum.data.fpr * 100).toFixed(2)}%`,
      },
      xAxis: {
        title: 'False Positive Rate (FPR)',
      },
      yAxis: {
        title: 'True Positive Rate (TPR)',
      },
      annotations: [
        {
          type: 'text',
          position: ['min', 'max'],
          offsetY: 10,
          style: { textBaseline: 'top' },
          content: `AUC = ${auc.toFixed(2)}`,
        },
      ],
    };*/

    //console.log(fprs);
    //console.log(tprs);
    //console.log(auc);

    

    return (
      <LayoutPage pageTitle="Accountability & Resilience Metrics" pageSubTitle={`Model ${modelId}`}>
        <Divider orientation="left">
          <h1 style={{ fontSize: '24px' }}>Accountability Metrics</h1>
        </Divider>
        <div style={{ padding: '0 0' }}>
          <div style={{ top: 1 }}>
            <Tooltip title={"???"}>
              <Button type="link" icon={<QuestionOutlined />} />
            </Tooltip>
          </div>
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
                value={cutoffProb}
                defaultValue={cutoffProb}
                onChange={(value) => this.handleCutoffProbChange(value)}
              />
            </div>
          </Form.Item>
          <Form.Item name="slider" label="Cutoff percentile of samples" style={{ marginLeft: '50px', marginRight: '50px', marginBottom: '10px' }}>
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
                value={cutoffPercentile}
                defaultValue={cutoffPercentile}
                onChange={(value) => this.handleCutoffPercentileChange(value)}
              />
            </div>
          </Form.Item>
        </div>
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
              <h2>&nbsp;&nbsp;&nbsp;ROC AUC Plot</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={"???"}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Line {...configROCAUC} />
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Currentness Metric</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title="???">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>

            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;???</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title={"???"}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>

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

/*<Line {...configROCAUC} />;*/

const mapPropsToStates = ({ model }) => ({
  model
});

const mapDispatchToProps = (dispatch) => ({
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(MetricsPage);