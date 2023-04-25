import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Form, Slider, Switch, Table, Col, Row, Button, Tooltip } from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Heatmap } from '@ant-design/plots';
import {
  requestModel,
} from "../actions";

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
      confusionMatrix: "",
      cutoff: 0.5,
    }
  }

  componentDidMount() {
    let modelId = getLastPath();
    this.props.fetchModel(modelId);
  }

  componentDidUpdate(prevProps) {
    // Check if the model data has been updated
    if (this.props.model !== prevProps.model) {
      const { stats, confusionMatrix } = this.props.model;
      this.setState({ stats, confusionMatrix });
    }
  }

  handleCutoffChange = (value) => {
    this.setState({ cutoff: value });
  }

  render() {
    const {
      model,
    } = this.props;
    console.log(model);
    let modelId = getLastPath();

    const { stats, buildConfig, confusionMatrix, trainingSamples, testingSamples } = model;

    const { 
      cutoff,
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

    // Check if the stats and confusionMatrix have been loaded
    if (!stats || !confusionMatrix) {
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
    console.log(confusionMatrix);

    const rows = confusionMatrix.trim().split('\n');
    const headers = rows.shift().split(',');
    headers[1] = "Normal traffic";
    headers[2] = "Malware traffic";
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      return cols.slice(1).map((val, j) => ({
        actual: headers[i+1],
        predicted: headers[j+1],
        count: Number(val),
        percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
      }));
    });

    /*// TODO: code related to cutoff does not work
    const filteredData = data.filter(d => d.predicted === 'Malware traffic' && d.percentage.slice(0, -1) >= cutoff);
    const totalMalwareTrafficCount = data.filter(d => d.predicted === 'Malware traffic').reduce((acc, d) => acc + d.count, 0);
    const totalFilteredMalwareTrafficCount = filteredData.reduce((acc, d) => acc + d.count, 0);
    const percentageOfFilteredMalwareTraffic = (totalFilteredMalwareTrafficCount / totalMalwareTrafficCount * 100).toFixed(2);
    const updatedData = data.map(d => {
      if (d.predicted === 'Malware traffic') {
        if (d.percentage.slice(0, -1) >= cutoff) {
          d.count = `${d.count} (${d.percentage})`;
          d.percentage = `${((d.count / totalFilteredMalwareTrafficCount) * 100).toFixed(2)}%`;
        } else {
          d.count = 0;
          d.percentage = '0%';
        }
      }
      return d;
    });
    console.log(updatedData);*/

    /*const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      const total = rows.map((r) => r.split(',')[i+1]).reduce((acc, val) => acc + Number(val), 0);
      if (total / rows.length < cutoff) {
        return [];
      }
      return cols.slice(1).map((val, j) => {
        if (cols[0] / rowTotal < cutoff || headers[j+1] === 'Total') {
          return null;
        }
        return {
          actual: headers[i+1],
          predicted: headers[j+1],
          count: Number(val),
          percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
        };
      }).filter((val) => val !== null);
    }).filter((val) => val !== null);*/

    console.log(data);

    const config = {
      data,
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
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
              <div style={{ position: 'absolute', top: 10, right: 10 }}>
                <Tooltip title="Shows a list of various model performance metrics for each class.">
                  <Button style={{ fontSize: '15px', border: 'none' }} type="link">
                    <QuestionOutlined style={{ opacity: 0.5 }} />
                  </Button>
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
                <Tooltip title="The confusion matrix shows the number of True Negatives (predicted negative, observed negative), True Positives (predicted positive, observed positive), False Negatives (predicted negative, but observed positive) and False Positives (predicted positive, but observed negative).">
                  <Button style={{ fontSize: '15px', border: 'none' }} type="link">
                    <QuestionOutlined style={{ opacity: 0.5 }} />
                  </Button>
                </Tooltip>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Form.Item name="slider" label="Cutoff" style={{ marginLeft: '50px', marginRight: '50px', marginBottom: '10px' }}>
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
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', flex: 1, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', height: '410px', width: '100%', maxWidth: '480px' }}>
                    <Heatmap {...config} />
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Predict</h2>
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