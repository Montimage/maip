import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Slider, Switch, Table, Col, Row, Button} from 'antd';
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

  render() {
    const {
      model,
    } = this.props;
    console.log(model);
    let modelId = getLastPath();

    const { stats, buildConfig, confusionMatrix, trainingSamples, testingSamples } = model;

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
    console.log(data);

    const config = {
      data,
      forceFit: true,
      xField: 'predicted',
      yField: 'actual',
      colorField: 'count',
      shape: 'square',
      tooltip: {
        formatter: (datum) => {
          return {
            name: `${datum.actual} -> ${datum.predicted}`,
            value: `Count: ${datum.count}\nPercentage: ${datum.percentage}`,
          };
        },
      },
      xAxis: {
        title: { 
          style: { fontSize: 20 }, 
          text: 'Predicted' 
        }
      },
      yAxis: {
        title: { 
          style: { fontSize: 20 }, 
          text: 'Observed' 
        }
      },
      label: {
        visible: true,
        position: 'middle',
        style: {
          fontSize: '16',
        },
        formatter: (datum) => {
          return `${datum.count}\n(${datum.percentage})`;
        },
      },
    };

    return (
      <LayoutPage pageTitle="Metrics Page" pageSubTitle={`Model ${modelId}`}>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
              <Table columns={columnsTableStats} dataSource={dataStats} pagination={false} />
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Confusion Matrix</h2>
              <div style={{ width: '400px', alignItems: 'center' }}>
                &nbsp;&nbsp;&nbsp;
                Cutoff:
                <Slider
                  marks={{
                    0.01: '0.01',
                    0.25: '0.25',
                    0.50: '0.50',
                    0.75: '0.75',
                    0.99: '0.99',
                  }}
                  min={0.01} max={0.99} step={0.01} 
                  /*value={cutoff} defaultValue={cutoff}*/
                  /*onChange={(value) => this.handleCutoffChange(value)}*/
                  /*style={{ marginLeft: '100px' }}*/
                />    
              </div>
              <div style={{position: 'relative',height:'450px',width:'450px',marginLeft:'50px'}}>
                <Heatmap {...config} />
              </div>
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