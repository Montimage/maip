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
import { Col, Row, Table, Card, Statistic } from 'antd';
import { ClockCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import Papa from "papaparse";
import FeatureCharts from '../components/FeatureCharts';
import FeatureDescriptions from '../components/FeatureDescriptions';

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

        {/* Dataset Summary */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 16 }}>Dataset Summary</strong>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Total Samples"
                  value={csvData.length.toLocaleString()}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card hoverable size="small" style={{ textAlign: 'center', backgroundColor: '#fff' }}>
                <Statistic
                  title="Total Features"
                  value={numberFeatures}
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Dataset Table */}    
        <Card style={{ marginBottom: 16 }} id="data">
          <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Dataset</h3>
          <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
            Complete dataset with all features and samples
          </div>
          <div style={{ overflow: 'auto' }}>
            <Table 
              columns={columns} 
              dataSource={csvData} 
              size="small" 
              scroll={{ x: 'max-content' }}
              pagination={{ 
                pageSize: 10, 
                showTotal: (total) => `Total ${total} records`,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100']
              }}
            />
          </div>
        </Card>

        {/* Feature Descriptions */}
        <Card style={{ marginBottom: 16 }} id="feature_descriptions">
          <h3 style={{ fontSize: '16px', marginBottom: 4, fontWeight: 600 }}>Feature Descriptions</h3>
          <div style={{ marginBottom: 12, fontSize: '13px', color: '#8c8c8c' }}>
            Detailed metadata and explanations for each extracted feature
          </div>
          <FeatureDescriptions data={csvData} showTitle={false} />
        </Card>

        {/* Feature Charts */}
        <FeatureCharts data={csvData} scatterConfigBuilder={scatterBuilder} showSectionTitle={false} />
        
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