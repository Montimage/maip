import React, { Component } from 'react';
import { connect } from "react-redux";
import LayoutPage from './LayoutPage';
import { getLastPath } from "../utils";
import { Slider, Switch, Table, Col, Row, Button} from 'antd';
import { QuestionOutlined, CameraOutlined } from "@ant-design/icons";
import { Heatmap } from '@ant-design/plots';

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

const dataText = `,0,1
0,1402,98
1,628,10`;

class MetricsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      data: [],
      cutoff: 0.25,
    };
  }

  handleCutoffChange = (cutoff) => {
    this.setState({ cutoff }, this.updateData);
  };

  componentDidMount() {
    this.updateData();
  }

  updateData = () => {
    const { cutoff } = this.state;

    const rows = dataText.trim().split('\n');
    const headers = rows.shift().split(',');
    headers[1] = "Normal traffic";
    headers[2] = "Malware traffic";
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      const newRow = cols.slice(1).map((val, j) => ({
        actual: headers[i+1],
        predicted: headers[j+1],
        count: Number(val),
        percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
      }));
      const rowTotalAboveCutoff = newRow.filter(({ percentage }) => percentage >= cutoff)
        .reduce((acc, { count }) => acc + count, 0);
      const rowTotalBelowCutoff = newRow.filter(({ percentage }) => percentage < cutoff)
        .reduce((acc, { count }) => acc + count, 0);
      const newRowWithLabel = newRow.map(({ actual, predicted, count, percentage }) => ({
        actual,
        predicted,
        count,
        percentage,
        label: percentage >= cutoff ? count : percentage < 100 ? '' : count,
      }));
      newRowWithLabel[0].label += ` (${rowTotalAboveCutoff}/${rowTotal})`;
      newRowWithLabel[1].label += ` (${rowTotalBelowCutoff}/${rowTotal})`;
      console.log(newRowWithLabel);
      return newRowWithLabel;
    });
    console.log(data);
    this.setState({ data });
  };

  render() {
    const modelId = getLastPath();
    const highlightPercentage = true;
    const { data, cutoff } = this.state;
    console.log(cutoff);

    /* const rows = dataText.trim().split('\n');
    const headers = rows.shift().split(',');
    headers[1] = "Normal traffic";
    headers[2] = "Malware traffic";
    const data = rows.flatMap((row, i) => {
      const cols = row.split(',');
      const rowTotal = cols.slice(1).reduce((acc, val) => acc + Number(val), 0);
      console.log(rowTotal);
      return cols.slice(1).map((val, j) => ({
        actual: headers[i+1],
        predicted: headers[j+1],
        count: Number(val),
        percentage: `${((Number(val) / rowTotal) * 100).toFixed(2)}%`,
      }));
    }); */

    console.log(data);

    /* const labelFormatter = (datum) => (
      <div style={{ fontSize: 12 }}>
        <div>{`Count: ${datum.count}`}</div>
        <div>{`Percentage: ${datum.percentage}`}</div>
      </div>
    ); */

    const config = {
      data,
      forceFit: true,
      xField: 'predicted',
      yField: 'actual',
      colorField: 'count',
      shape: 'square',
      tooltip: {
        formatter: (datum) => {
          /* TODO: percentage is shown undefined ? */
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
      legend: {
        position: 'bottom'
      },
      heatmapStyle: {
        padding: 0,  
        stroke: '#fff',
        lineWidth: 1,
      },
      label: {
        visible: true,
        position: 'middle',
        style: {
          fontSize: '16',
          //fontWeight: 'bold',
          //fill: '#fff',
        },
        formatter: (datum) => {
          const countStyle = {
            fontSize: highlightPercentage ? '12px' : '16px',
            fontWeight: highlightPercentage ? 'normal' : 'bold',
          };
          const percentageStyle = {
            fontSize: highlightPercentage ? '16px' : '12px',
            fontWeight: highlightPercentage ? 'bold' : 'normal',
          };
          /* TODO: how to modify labels' style depending on hightlightPercentage */
          //return <div>`${datum.count}\n(${datum.percentage})`</div>;
          return `${datum.count}\n(${datum.percentage})`;
          /* return (
            <>
              <div style={{countStyle}}>{Count: `${datum.count}`}</div>
              <div style={{percentageStyle}}>{Percentage:`${datum.percentage}`}</div>
            </>
          ); */
        },
      },
    };

    return (
      <LayoutPage pageTitle="Metrics Page" pageSubTitle={`Model ${modelId}`}>
        <Row gutter={24}>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2>&nbsp;&nbsp;&nbsp;Model Performance</h2>
                {/* TODO: make position of buttons are flexible */}
                <Button type="button" icon={<CameraOutlined />}
                  style={{ marginLeft: '20rem' }}
                  titleDelay={50}
                  title="Download plot as png" 
                  //onClick={downloadShapImage} 
                />
                <Button type="button" icon={<QuestionOutlined />}
                  titleDelay={50}
                  title="???"
                />
              </div>
              &nbsp;&nbsp;&nbsp;
            </div>
          </Col>
          <Col className="gutter-row" span={12}>
            <div style={style}>
              <h2>&nbsp;&nbsp;&nbsp;Confusion Matrix</h2>
              <div style={{ width: '500px', alignItems: 'center' }}>
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
                  min={0.01} max={0.99} step={0.01} defaultValue={cutoff}
                  value={cutoff}
                  onChange={(value) => this.handleCutoffChange(value)}
                  style={{ marginLeft: '100px' }}
                />    
              </div>
              <div style={{position: 'relative',height:'300px',width:'300px'}}>
                <Heatmap {...config} />
              </div>
            </div>
          </Col>
        </Row>
      </LayoutPage>
    );
  }


}

export default MetricsPage;

/* const mapPropsToStates = ({ shapValues, xaiStatus }) => ({
  shapValues, xaiStatus,
});

const mapDispatchToProps = (dispatch) => ({
  fetchXAIStatus: () => dispatch(requestXAIStatus()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(XAIPage); */
