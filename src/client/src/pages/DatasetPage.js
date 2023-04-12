import React, { Component } from "react";
import { connect } from "react-redux";
import LayoutPage from "./LayoutPage";
import {
  requestDownloadDatasetModel,
} from "../actions";
import { 
  getBeforeLastPath,
  getLastPath,
} from "../utils";
import { CSVReader } from 'react-papaparse';
import { Select, Col, Row } from 'antd';
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

const { Option } = Select;

class DatasetPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      csvData: [],
      headers: [],
      isLoading: false,
      selectedFeature: '',
      chartData: [],
    };
    this.fileInputRef = React.createRef();
    this.handleFileUpload = this.handleFileUpload.bind(this);
    this.handleSelectChange = this.handleSelectChange.bind(this);
  }

  handleFileUpload(event) {
    event.preventDefault();
    const file = this.fileInputRef.current.files[0];
    if (file) {
      this.setState({ isLoading: true });
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const csvData = results.data;
          const headers = Object.keys(csvData[0]);
          this.setState({
            csvData: csvData,
            headers: headers,
            isLoading: false,
          });
        },
        error: () => {
          console.log('Error parsing CSV file');
          this.setState({ isLoading: false });
        },
      });
    }
  }

  handleSelectChange(value) {
    this.setState({ selectedFeature: value });
    const chartData = this.getChartData(value);
    this.setState({ chartData: chartData });
  }

  getChartData(feature) {
    const { csvData } = this.state;
    let chartData = [];

    if (csvData.length > 0) {
      chartData = csvData.map(row => ({ value: parseFloat(row[feature]) }));
      console.log(JSON.stringify(chartData));
    }
    return chartData;
  }

  render() {
    const { csvData, headers, isLoading, selectedFeature, chartData } = this.state;
    console.log(JSON.stringify(chartData));
    const displayedCsvData = csvData.slice(0, 10);
    const values = chartData.map((d) => d.value);
    const histogramData = values.reduce((acc, value) => {
      const bin = acc.find((bin) => bin.x0 === value || (bin.x0 < value && value < bin.x1));
      if (bin) {
        bin.count += 1;
      } else {
        acc.push({ x0: value, x1: value + 1, count: 1 });
      }
      return acc;
    }, []);
    console.log(JSON.stringify(histogramData));

    return (
      <LayoutPage pageTitle="Dataset" pageSubTitle="">
        <div>
          <form onSubmit={this.handleFileUpload}>
            <input type="file" ref={this.fileInputRef} />
            <button type="submit" disabled={isLoading}>
              Load CSV
            </button>
          </form>
          {isLoading && <div>Loading...</div>}
          {displayedCsvData.length > 0 && (
            <div style={{ overflow: 'auto', width: '100%' }}>
              <table style={{ borderCollapse: 'collapse', border: '1px solid black' }}>
                <thead>
                  <tr>
                    {headers.map((header) => (
                      <th style={{ border: '1px solid black' }} 
                        key={header}>{header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedCsvData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {headers.map((header, colIndex) => (
                        <td key={`${rowIndex}-${colIndex}`} 
                          style={{ border: '1px solid black' }}>
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Row gutter={24}>
            <Col className="gutter-row" span={12}>
              {headers.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ marginRight: '0.5rem' }}>Select feature:</span>
                  <Select value={selectedFeature} style={{ width: 'fit-content' }}
                    onChange={this.handleSelectChange}>
                    {headers.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                  <h2>Histogram feature {selectedFeature}</h2> 
                  <div style={{ width: "100%", height: 400 }}>
                    <BarChart width={800} height={300} data={histogramData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x0" />
                      <YAxis type="number" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" barSize={30} />
                    </BarChart>
                  </div>
                </div>
              )}
            </Col>
          </Row>
        </div>
      </LayoutPage>
    );
  }
}

export default DatasetPage;
