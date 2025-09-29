import React, { Component } from "react";
import LayoutPage from "./LayoutPage";
import { connect } from "react-redux";
// import { QuestionOutlined } from "@ant-design/icons";
import { 
  getBeforeLastPath,
  getLastPath,
  getNumberFeaturesModel,
  getFilteredFeaturesModel,
  getConfigScatterPlot,
  isACModel,
} from "../utils";
import {
  requestViewModelDatasets,
} from "../api";
import {
  requestApp,
} from "../actions";
import { Menu, Button, Col, Row, Table, Divider } from 'antd';
import Papa from "papaparse";
import FeatureCharts from '../components/FeatureCharts';
import FeatureDescriptions from '../components/FeatureDescriptions';

const {
  BOX_STYLE,
  DATASET_MENU_ITEMS,
} = require('../constants');
// const { Option } = Select;

let featuresDescriptions = {};

class DatasetPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      csvData: [],
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
          this.setState({ csvData });
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
    console.log(isACModel(modelId));
    const datasetType = getLastPath();
    const { 
      csvData, 
    } = this.state;

    const numberFeatures = getNumberFeaturesModel(modelId);
    featuresDescriptions = getFilteredFeaturesModel(modelId);
    const features = Object.keys(featuresDescriptions); 
    
    const allFeatures = features.map((feature, index) => {
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

    const scatterBuilder = (data, x, y) => getConfigScatterPlot(modelId, data, x, y);

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
          <Divider orientation="left" style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: '24px' }}>Dataset</h1>
          </Divider>
          <Col className="gutter-row" span={24}>
          <div style={{ ...BOX_STYLE, marginTop: '20px' }} >
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
          <Divider orientation="left" style={{ marginTop: 24 }}>
            <h1 style={{ fontSize: '24px' }}>Feature Descriptions</h1>
          </Divider>
          <Col className="gutter-row" span={24}>
            <FeatureDescriptions data={csvData} showTitle={false} />
          </Col>
        </Row>

        <Row gutter={24} style={{ marginTop: '20px' }}>
          <Col className="gutter-row" span={24}>
            <FeatureCharts data={csvData} scatterConfigBuilder={scatterBuilder} sectionTitle="Feature Extraction" />
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