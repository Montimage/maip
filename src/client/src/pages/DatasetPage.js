import React, { Component } from "react";
import LayoutPage from "./LayoutPage";
import { connect } from "react-redux";
import { QuestionOutlined } from "@ant-design/icons";
import { 
  getBeforeLastPath,
  getLastPath,
  getNumberFeatures,
  getFilteredFeatures,
  getConfigScatterPlot,
  getConfigBarPlot,
  getConfigHistogram,
  getTableDatasetsStats,
} from "../utils";
import {
  requestViewModelDatasets,
} from "../api";
import {
  requestApp,
} from "../actions";
import { Menu, Button, Tooltip, Select, Col, Row, Table } from 'antd';
import Papa from "papaparse";
import { Bar, Scatter, Histogram } from '@ant-design/plots';

const {
  BOX_STYLE,
  BIN_CHOICES, DATASET_TABLE_STATS, DATASET_MENU_ITEMS,
  COLUMNS_ALL_FEATURES,
} = require('../constants');
const { Option } = Select;

let featuresDescriptions = {};

// TODO: scatter plot is a straight line if features on the x-axis and y-axis are similar ???

class DatasetPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      csvData: [],
      headers: [],
      selectedFeature: null,
      binWidthChoice: 'square-root',
      xScatterFeature: null,
      yScatterFeature: null,
      barFeature: null,
    };
  }

  async fetchCSVData(modelId, datasetType) {
    try {
      const csvDataString = await requestViewModelDatasets(modelId, datasetType);
  
      Papa.parse(csvDataString, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
        complete: (results) => {
          const csvData = results.data;
          const headers = Object.keys(featuresDescriptions);
          console.log(headers);
          this.setState({
            csvData: csvData,
            headers: headers,
          });
        },
        error: () => {
          console.log('Error parsing CSV file');
        },
      });
    } catch (error) {
      console.error("Failed to fetch model dataset:", error);
    }
  }

  componentDidMount() {
    this.props.fetchApp();
    const modelId = getBeforeLastPath(2);
    const datasetType = getLastPath();
    this.fetchCSVData(modelId, datasetType);
  }

  componentDidUpdate(prevProps) {
    const modelId = getBeforeLastPath(2);
    const datasetType = getLastPath(); 
 
    const shouldFetchData = 
      (this.props.app === 'ac' && modelId.startsWith('ac-')) || 
      (this.props.app === 'ad' && !modelId.startsWith('ac-'));

    if (this.props.app !== prevProps.app) {
      const commonStateUpdate = {
        headers: Object.keys(featuresDescriptions),
        selectedFeature: null,
        xScatterFeature: null,
        yScatterFeature: null,
        barFeature: null,
      };
  
      if (shouldFetchData) {
        this.setState(commonStateUpdate, () => {
          this.fetchCSVData(modelId, datasetType);
        });
      } else {
        this.setState({
          ...commonStateUpdate,
          csvData: [],
        });
      }
    }
  }

  render() {
    const modelId = getBeforeLastPath(2);
    const datasetType = getLastPath();
    const { 
      csvData, 
      headers, 
      selectedFeature, 
      binWidthChoice,
      xScatterFeature,
      yScatterFeature,
      barFeature,
    } = this.state;

    const numberFeatures = getNumberFeatures(this.props.app);
    featuresDescriptions = getFilteredFeatures(this.props.app);
    
    const allFeatures = Object.keys(featuresDescriptions).map((feature, index) => {
      return {
        key: index + 1,
        name: feature,
        description: featuresDescriptions[feature].description,
        type: featuresDescriptions[feature].type,
      };
    });
    const categoricalFeatures = Object.entries(featuresDescriptions)
      .filter(([key, value]) => value.type === 'categorical')
      .map(([key, value]) => key);
    //console.log(categoricalFeatures);

    const columns = csvData.length > 0 ? Object.keys(csvData[0]).map(key => ({
      title: key,
      dataIndex: key,
      sorter: (a, b) => {
        const aVal = parseFloat(a[key]);
        const bVal = parseFloat(b[key]);
        if (!isNaN(aVal) && !isNaN(bVal)) {
          return aVal - bVal;
        } else {
          return a[key].localeCompare(b[key]);
        }
      },
    })) : [];

    const binWidthOptions = BIN_CHOICES.map(choice => ({
      value: choice,
      label: choice,
    }));

    const dataDatasetsStats = getTableDatasetsStats(csvData, selectedFeature);
    const configHistogram = getConfigHistogram(csvData, selectedFeature, binWidthChoice);
    const configScatter = getConfigScatterPlot(this.props.app, csvData, xScatterFeature, yScatterFeature);
    const configBar = getConfigBarPlot(csvData, barFeature);

    return (
      <LayoutPage pageTitle="Dataset" 
        pageSubTitle={`${datasetType.charAt(0).toUpperCase() + datasetType.slice(1)}ing dataset of the model ${modelId}`}>

        <Menu mode="horizontal" style={{ backgroundColor: 'transparent', fontSize: '18px' }}>
          {DATASET_MENU_ITEMS.map(item => (
            <Menu.Item key={item.key}>
              <a href={item.link}>{item.label}</a>
            </Menu.Item>
          ))}
        </Menu>

        {/* TODO: Fix "ResizeObserver loop limit exceeded", fixed header ? */}    
        <Row gutter={24} style={{ marginTop: '20px' }} id="data">
          <Col className="gutter-row" span={24}>
          <div style={{ ...BOX_STYLE, marginTop: '100px' }} >
            <h2>&nbsp;&nbsp;&nbsp;Data</h2>
            <div style={{ fontSize: '16px', marginTop: '20px' }}>
              &nbsp;&nbsp;&nbsp;Total number of samples: <strong>{csvData.length}</strong>;
              Total number of features: <strong>{numberFeatures}</strong>
            </div>
            <div style={{ maxWidth: '100vw', overflowX: 'auto', marginTop: '20px', height: 490 }}>
              <Table columns={columns} 
                dataSource={csvData} 
                size="small" bordered
                scroll={{ x: 'max-content', /* y: 400 */ }}
                pagination={{ pageSize: 10 }}
              />
            </div>
          </div>
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }} id="feature_descriptions">
          <Col className="gutter-row" span={24}>
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Feature Descriptions</h2>
              <div style={{ position: 'absolute', top: 110, right: 10 }}>
                <Tooltip title={`Displays all features with detailed description.`}>
                  <Button type="link" icon={<QuestionOutlined />} />
                </Tooltip>
              </div>
              <Table dataSource={allFeatures} columns={COLUMNS_ALL_FEATURES} 
                size="small" style={{ marginTop: '10px' }}
              />
            </div>
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }} id="histogram_plot">
          <Col className="gutter-row" span={24}>
            {headers.length > 0 && (
              <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
                <h2>&nbsp;&nbsp;&nbsp;Histogram Plot</h2>
                <div style={{ marginBottom: '30px', marginTop: '10px' }}>
                  <div style={{ position: 'absolute', top: 110, right: 10 }}>
                    <Tooltip title="A table contains different statistics of the feature, such as the number of unique values, number of missing values, mean, standard deviation, median, minimum, and maximum value. A histogram plot for each feature of the database shows the distribution of values in that feature.">
                      <Button type="link" icon={<QuestionOutlined />} />
                    </Tooltip>
                  </div>
                  &nbsp;&nbsp;&nbsp;
                  <Tooltip title="Select the feature to plot on the histogram">
                    <Select
                      showSearch allowClear
                      placeholder="Select a feature ..."
                      value={this.state.selectedFeature}
                      onChange={value => this.setState({ selectedFeature: value })}
                      optionFilterProp="children"
                      filterOption={(input, option) => (option?.value ?? '').includes(input)}
                      style={{ width: 300, marginTop: '10px' }}
                    >
                      {headers.map((header) => (
                        <Option key={header} value={header}>
                          {header}
                        </Option>
                      ))}
                    </Select>
                  </Tooltip>
                  &nbsp;&nbsp;&nbsp;
                  <Tooltip title="Select the bin selection algorithm">
                    <Select
                      showSearch allowClear
                      placeholder="Select bin width ..."
                      options={binWidthOptions}
                      defaultValue="square-root"
                      onChange={value => this.setState({ binWidthChoice: value })}
                      optionFilterProp="children"
                      filterOption={(input, option) => (option?.value ?? '').includes(input)}
                      style={{ width: 250 }}
                    >
                      {headers.map((header) => (
                        <Option key={header} value={header}>
                          {header}
                        </Option>
                      ))}
                    </Select>
                  </Tooltip>
                </div>
                {selectedFeature && (
                  <Table columns={DATASET_TABLE_STATS} dataSource={dataDatasetsStats} pagination={false}
                    style={{marginTop: '10px'}}
                  />
                )}
                {selectedFeature && binWidthChoice && (
                  <Histogram {...configHistogram} style={{ margin: '20px' }}/>
                )}
              </div>
            )}
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }} id="scatter_plot">
          <Col className="gutter-row" span={24}>
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Scatter Plot</h2>
              <div style={{ marginBottom: '30px', marginTop: '10px' }}>
                <div style={{ position: 'absolute', top: 110, right: 10 }}>
                  <Tooltip title="The scatter plot represents the relationship between two features of a dataset, each data point as a circle on a two-dimensional coordinate system. The color of each circle represents whether the traffic was Malware or Normal. Malware traffic is denoted with the color blue, while Normal traffic is denoted with the color red.">
                    <Button type="link" icon={<QuestionOutlined />} />
                  </Tooltip>
                </div>
                &nbsp;&nbsp;&nbsp;
                <Tooltip title="Select a feature displayed on x-axis">
                  <Select
                    showSearch allowClear
                    placeholder="Select a feature ..."
                    value={this.state.xScatterFeature}
                    onChange={value => this.setState({ xScatterFeature: value })}
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.value ?? '').includes(input)}
                    style={{ width: 300, marginTop: '10px' }}
                  >
                    {headers.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
                &nbsp;&nbsp;&nbsp;
                <Tooltip title="Select a feature displayed on y-axis">
                  <Select
                    showSearch allowClear
                    placeholder="Select a feature ..."
                    value={this.state.yScatterFeature}
                    onChange={value => this.setState({ yScatterFeature: value })}
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.value ?? '').includes(input)}
                    style={{ width: 300, marginTop: '10px' }}
                  >
                    {headers.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
              </div>
              {xScatterFeature && yScatterFeature &&
                <Scatter {...configScatter} style={{ margin: '20px' }}/>
              }
            </div>
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }} id="bar_plot">
          <Col className="gutter-row" span={12}>
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Bar Plot</h2>
              <div style={{ marginBottom: '30px', marginTop: '10px' }}>
                <div style={{ position: 'absolute', top: 110, right: 10 }}>
                  <Tooltip title="The bar plot displays the frequency or proportion of a categorical feature.">
                    <Button type="link" icon={<QuestionOutlined />} />
                  </Tooltip>
                </div>
                &nbsp;&nbsp;&nbsp;
                <Tooltip title="Select a categorical feature">
                  <Select
                    showSearch allowClear
                    value={this.state.barFeature}
                    placeholder="Select a feature ..."
                    onChange={value => this.setState({ barFeature: value })}
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.value ?? '').includes(input)}
                    style={{ width: 300, marginTop: '10px' }}
                  >
                    {categoricalFeatures.map((header) => (
                      <Option key={header} value={header}>
                        {header}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
              </div>
              {barFeature && <Bar {...configBar} style={{ margin: '10px' }} />}
            </div>
          </Col>

          <Col className="gutter-row" span={12} id="heatmap_plot">
            <div style={{ ...BOX_STYLE, marginTop: '100px' }}>
              <h2>&nbsp;&nbsp;&nbsp;Heatmap Plot</h2>
            </div>
          </Col>
        </Row>
        
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ app }) => ({
  app,
});

const mapDispatchToProps = (dispatch) => ({
  fetchApp: () => dispatch(requestApp()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(DatasetPage);