import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { Select, Menu, Form, Slider, Table, Col, Row, Button, Tooltip } from 'antd';
import { QuestionOutlined } from "@ant-design/icons";
import { Line, Heatmap, Column } from '@ant-design/plots';
import {
  requestApp,
  requestAllModels,
  requestModel,
  requestMetricCurrentness,
} from "../actions";
import {
  BOX_STYLE,
  ACC_METRICS_MENU_ITEMS, COLUMNS_CURRENTNESS_METRICS,
} from "../constants";
import {
  getFilteredModelsOptions,
  getLastPath,
  getConfigConfusionMatrix,
  updateConfusionMatrix,
  getColumnsPerfStats,
  getTablePerformanceStats,
  getConfigClassification,
  computeCutoff,
} from "../utils";
import {
  requestBuildConfigModel,
  requestPredictionsModel,
} from "../api";

let isModelIdPresent = getLastPath() !== "accountability";

class AccountabilityMetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modelId: null,
      stats: [],
      predictions: [],
      confusionMatrix: [],
      classificationData: [],
      cutoffProb: 0.5,
      cutoffPercentile: 0.5,
      fprs: [], 
      tprs: [], 
      auc: 0,
      dataPrecision: null,
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    if (isModelIdPresent) {
      this.setState({ modelId });
    }
    this.props.fetchApp();
    this.props.fetchAllModels();
  }

  async componentDidUpdate(prevProps, prevState) {
    const { modelId } = this.state;  
    // reset states once app is changed
    if (this.props.app !== prevProps.app && !isModelIdPresent) {
      this.setState({ 
        modelId: null,
        stats: [],
        predictions: [],
        confusionMatrix: [],
        classificationData: [],
        cutoffProb: 0.5,
        cutoffPercentile: 0.5,
        fprs: [], 
        tprs: [], 
        auc: 0,
        dataPrecision: null,
      });
    }
    if (modelId !== prevState.modelId) {
      if (modelId) {
        this.props.fetchModel(modelId);
        this.loadPredictions(modelId);
        this.props.fetchMetricCurrentness(modelId);
        const buildConfig = await requestBuildConfigModel(modelId);
        console.log(buildConfig);
      } else {
        // reset states once modelId is cleared
        this.setState({ 
          modelId: null,
          stats: [],
          predictions: [],
          confusionMatrix: [],
          classificationData: [],
          cutoffProb: 0.5,
          cutoffPercentile: 0.5,
          fprs: [], 
          tprs: [], 
          auc: 0,
          dataPrecision: null,
        });
      }
    }
  }

  async loadPredictions(modelId) {
    const predictionsValues = await requestPredictionsModel(modelId);
    //console.log(predictionsValues);
    const predictions = predictionsValues.split('\n').map((d) => ({
      prediction: parseFloat(d.split(',')[0]),
      trueLabel: parseInt(d.split(',')[1]),
    }));

    this.setState({ predictions }, this.updateConfusionMatrix);
    this.updateROCAUC();
    this.updatePrecisionPlot();
  }

  updateConfusionMatrix() {
    const { predictions, cutoffProb } = this.state;
    const cm = updateConfusionMatrix(this.props.app, predictions, cutoffProb);
    const confusionMatrix = cm.confusionMatrix; 
    const stats = cm.stats;
    this.setState({ 
      predictions,
      stats, 
      confusionMatrix,
      classificationData: cm.classificationData
    });
  }

  // TODO: recheck this function, it works but looks weird, probably due to the given data
  updateROCAUC() {
    /*const { predictions, cutoffProb } = this.state;
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

    this.setState({ fprs, tprs, auc });*/

    const { predictions, cutoffProb } = this.state;
    /*console.log(predictions);
    console.log(cutoffProb);
    const rocData = [];

    const tprs = [];
    const fprs = [];
    const stepSize = 0.01;
    for (let cutoffProb = 0; cutoffProb <= 1; cutoffProb += stepSize) {
      const TP = predictions.filter((d) => d.trueLabel === 1 && d.prediction >= cutoffProb).length;
      const FP = predictions.filter((d) => d.trueLabel === 0 && d.prediction >= cutoffProb).length;
      const TN = predictions.filter((d) => d.trueLabel === 0 && d.prediction < cutoffProb).length;
      const FN = predictions.filter((d) => d.trueLabel === 1 && d.prediction < cutoffProb).length;

      const tpr = TP / (TP + FN);
      const fpr = FP / (FP + TN);
      tprs.push(tpr);
      fprs.push(fpr);
      rocData.push({ fpr, tpr });
    }*/

    const tprArray = []; // Array to store True Positive Rate (TPR)
    const fprArray = []; // Array to store False Positive Rate (FPR)

    for (let cutoffProb = 0; cutoffProb <= 1; cutoffProb += 0.01) {
      let tp = 0; // True Positives
      let fp = 0; // False Positives
      let tn = 0; // True Negatives
      let fn = 0; // False Negatives

      for (const { prediction, trueLabel } of predictions) {
        if (prediction >= cutoffProb) {
          if (trueLabel === 1) {
            tp++;
          } else {
            fp++;
          }
        } else {
          if (trueLabel === 1) {
            fn++;
          } else {
            tn++;
          }
        }
      }

      // Calculate True Positive Rate (TPR) and False Positive Rate (FPR)
      const tpr = tp / (tp + fn);
      const fpr = fp / (fp + tn);

      // Add TPR and FPR to arrays
      tprArray.push(tpr);
      fprArray.push(fpr);
    }

    // Prepare data for the Line chart
    const rocData = tprArray.map((tpr, index) => ({
      fpr: fprArray[index],
      tpr,
    }));

    this.setState({ rocData });
    //console.log(rocData);
  }

  // updatePrecisionPlot() {
  //   const { predictions, cutoffProb } = this.state;
  //   const binSize = 0.1; // Size of each bin
  //   const binThresholds = []; // Array to store the bin thresholds
  //   const precisionArray = []; // Array to store the precision values

  //   for (let binStart = 0; binStart <= 1; binStart += binSize) {
  //     const binEnd = binStart + binSize;

  //     let tp = 0;
  //     let fp = 0;

  //     for (const { prediction, trueLabel } of predictions) {
  //       if (prediction >= binStart && prediction < binEnd) {
  //         if (trueLabel === 1) {
  //           tp++;
  //         } else {
  //           fp++;
  //         }
  //       }
  //     }

  //     // Calculate Precision only if the cutoffProb is within the bin range
  //     const precision = (cutoffProb >= binStart && cutoffProb < binEnd) ? tp / (tp + fp) : NaN;

  //     // Add bin threshold and precision to arrays
  //     binThresholds.push(binStart);
  //     precisionArray.push(precision);
  //   }

  //   // Prepare data for the Line chart
  //   const dataPrecision = binThresholds.map((threshold, index) => ({
  //     threshold: threshold.toFixed(1),
  //     precision: isNaN(precisionArray[index],) ? 0 : precisionArray[index],
  //   }));

  //   //console.log(dataPrecision);
  //   this.setState({ dataPrecision: dataPrecision });
  // }

  // TODO: recheck the precision plot
  updatePrecisionPlot() {
    const { predictions } = this.state;

    let labelCounts = {};
    let correctCounts = {};

    for (let i = 1; i <= 3; i++) {
      labelCounts[i] = 0;
      correctCounts[i] = 0;
    }

    for (const predObj of Object.values(predictions)) {
      const { prediction, trueLabel } = predObj;

      labelCounts[prediction]++;
      if (prediction === trueLabel) {
          correctCounts[prediction]++;
      }
    }

    const precisionArray = [];
    for (let i = 1; i <= 3; i++) {
      const precision = (labelCounts[i] === 0) 
          ? 0 
          : correctCounts[i] / labelCounts[i];
      precisionArray.push(precision);
    }

    const dataPrecision = precisionArray.map((precision, index) => ({
      label: (index + 1).toString(),
      precision: precision
    }));

    console.log(dataPrecision);
    this.setState({ dataPrecision: dataPrecision });
  }

  handleCutoffProbChange(value) {
    this.setState({ cutoffProb: value }, () => {
      this.updateConfusionMatrix();
      this.updateROCAUC();
      this.updatePrecisionPlot();
    });
  }

  handleCutoffPercentileChange(value) {
    const { predictions } = this.state;
    const cutoffProb = computeCutoff(predictions);
    this.setState({ cutoffPercentile: value, cutoffProb: cutoffProb });
    this.handleCutoffProbChange(cutoffProb);
  }

  render() {
    const { app, models, metrics } = this.props;

    const { 
      modelId, 
      cutoffProb,
      cutoffPercentile,
      predictions,
      confusionMatrix,
      stats,
      classificationData,
      fprs, tprs, auc, rocData,
      dataPrecision,
    } = this.state;

    const modelsOptions = getFilteredModelsOptions(app, models);
    const columnsPerfStats = getColumnsPerfStats(app);
    const dataStats = getTablePerformanceStats(modelId, stats, confusionMatrix); 
    const configCM = getConfigConfusionMatrix(modelId, confusionMatrix);
    const configClassification = getConfigClassification(classificationData);

    const dataROC = [
        { fpr: 0, tpr: 0 },
        ...fprs.map((fpr, i) => ({ fpr, tpr: tprs[i] })),
        { fpr: 1, tpr: 1 },
      ];
    //console.log(dataROC);


    /*const configROCAUC = {
      data: dataROC,
      xField: 'fpr',
      yField: 'tpr',
      //seriesField: 'index',
    };

    const configROCAUC1 = {
      data: rocData,
      xField: 'fpr',
      yField: 'tpr',
      xAxis: {
        min: 0,
        max: 1,
      },
      yAxis: {
        min: 0,
        max: 1,
      },
      seriesField: [],
      smooth: true,
      lineStyle: {
        lineWidth: 2,
      },
      point: {
        shape: 'circle',
        size: 3,
        style: {
          fill: '#ffffff',
          stroke: '#1890ff',
          lineWidth: 2,
        },
      },
    };*/

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

    const configPrecision = dataPrecision
    ? {
        data: dataPrecision,
        //xField: 'threshold',
        xField: 'label',
        yField: 'precision',
        smooth: true,
        lineStyle: {
          lineWidth: 2,
        },
        point: {
          size: 3,
          shape: 'circle',
          style: {
            fill: '#ffffff',
            stroke: '#1890ff',
            lineWidth: 2,
          },
        },
      }
    : null;

    const dataCurrentnessMetric = metrics.map((item) => {
      const [method, score] = item.split(': ');
      return { method: method, score: parseFloat(score).toFixed(2) };
    });

    const subTitle = isModelIdPresent ? 
      `Accountability metrics of the model ${modelId}` : 
      'Accountability metrics of models';

    return (
      <LayoutPage pageTitle="Accountability Metrics" pageSubTitle={subTitle}>
        <Menu mode="horizontal" style={{ backgroundColor: 'transparent', fontSize: '18px' }}>
          {ACC_METRICS_MENU_ITEMS.map(item => (
            <Menu.Item key={item.key}>
              <a href={item.link}>{item.label}</a>
            </Menu.Item>
          ))}
        </Menu>
        <Row type="flex" justify="center">
          <Col>
            <Form name="control-hooks" style={{ maxWidth: 700 }}>
              <Form.Item name="model" label="Model" 
                style={{ flex: 'none', marginTop: 20, marginBottom: 10 }}
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
                    style={{ width: '350px' }}
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
            </Form>
          </Col>
        </Row>
        
        <div style={{ padding: '0 0', marginTop: '20px' }}>
          <div style={{ top: 1 }}>
            <Tooltip title={"Cutoff prediction probability is a fixed probability value above which the model will classify a sample as positive. For example, if the cutoff prediction probability is set to 0.5, the model will classify any sample with a predicted probability of belonging to the positive class greater than 0.5 as positive. Cutoff percentile is defined as the point on the predicted probability distribution above which the model will classify a sample as positive. For example, if the cutoff percentile is set to 90%, the model will classify any sample with a predicted probability of belonging to the positive class greater than the 90th percentile as positive."}>
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
          <Col className="gutter-row" span={12} id="performance">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title={`Shows a list of various model performance metrics for each class.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              {dataStats && <Table columns={columnsPerfStats} dataSource={dataStats} pagination={false}
                style={{ marginTop: '20px' }} />}
            </div>
          </Col>
          <Col className="gutter-row" span={12} id="confusion_matrix">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Confusion Matrix</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title="The confusion matrix shows the number of True Negatives (predicted negative, observed negative), True Positives (predicted positive, observed positive), False Negatives (predicted negative, but observed positive) and False Positives (predicted positive, but observed negative). For different cutoff values, you will get a different number of False Positives and False Negatives. This plot allows you to find the optimal cutoff.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap', marginTop: '20px' }}>
                <div style={{ position: 'relative', height: '300px', width: '100%', maxWidth: '340px' }}>
                  <Heatmap {...configCM} />
                </div>
              </div>
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }} id="classification_plot">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Classification Plot</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title="This plot shows the fraction of each class above and below the cutoff.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Column {...configClassification} style={{ margin: '20px', marginTop: '40px' }}/>
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }} id="precision_plot">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Precision Plot</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title={"The precision plot shows the precision values binned by equal prediction probabilities. It provides an overview of how precision changes as the prediction probability increases."}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              {configPrecision && <Line {...configPrecision} style={{ margin: '20px', marginTop: '40px' }}/>}
            </div>
          </Col>
          <Col className="gutter-row" span={12} style={{ marginTop: "24px" }} id="currentness">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Currentness Metric</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title="Currentness metric measures the time of executing different XAI methods compared to the time of executing AI models.">
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table columns={COLUMNS_CURRENTNESS_METRICS} dataSource={dataCurrentnessMetric} 
                pagination={false} style={{ marginTop: '20px' }}/>
            </div>
          </Col>
        </Row>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app, models, model, metrics, }) => ({
  app, models, model, metrics,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
  fetchAllModels: () => dispatch(requestAllModels()),
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
  fetchMetricCurrentness: (modelId) => dispatch(requestMetricCurrentness(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(AccountabilityMetricsPage);