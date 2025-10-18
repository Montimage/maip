import React, { useState, useEffect } from 'react';
import { Layout, Button, Row, Col, Card, Typography, Space, Divider } from 'antd';
import { 
  SafetyOutlined, 
  ThunderboltOutlined, 
  EyeOutlined, 
  ApiOutlined,
  RobotOutlined,
  LineChartOutlined,
  AuditOutlined,
  AlertOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  InteractionOutlined,
  RadarChartOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const LandingPage = () => {
  const navigate = useNavigate();
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);

  const projects = [
    {
      name: 'SPATIAL',
      grantNumber: '101021808',
      description: 'Achieving trustworthy, transparent and explainable AI for cybersecurity solutions through data privacy, resilience engineering, and legal-ethical accountability.',
      logo: '/img/logo-spatial.png',
      website: 'https://spatial-h2020.eu/'
    },
    {
      name: 'CyberSuite',
      grantNumber: '101145861',
      description: 'Uptake of Innovative Security-as-a-Service Solutions for SMEs, providing an easily accessible marketplace for cybersecurity services with seamless integration.',
      logo: '/img/logo-cybersuite.png',
      website: 'https://cybersuiteproject.eu/'
    },
    {
      name: 'PUZZLE',
      grantNumber: '883540',
      description: 'Pluggable Social Platform focusing on cybersecurity analytics, blockchain technologies, threat intelligence, and distributed machine learning for SMEs.',
      logo: '/img/logo-puzzle.svg',
      website: 'https://puzzle-h2020.com/'
    },
    {
      name: 'ResilMesh',
      grantNumber: '101119681',
      description: 'Situation Aware Enabled Cyber Resilience for Dispersed, Heterogeneous Cyber Systems, securing critical infrastructure and smart systems.',
      logo: '/img/logo-resilmesh.png',
      website: 'https://resilmesh.eu/'
    },
    {
      name: 'NATWORK',
      grantNumber: '101139285',
      description: 'Net-Zero self-adaptive activation of distributed self-resilient augmented services - a bio-inspired cybersecurity framework for 6G networks with AI integration.',
      logo: '/img/logo-natwork.png',
      website: 'https://natwork-project.eu/'
    }
  ];

  // Auto-slide projects every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogoIndex((prevIndex) => 
        (prevIndex + 1) % projects.length
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [projects.length]);

  const features = [
    {
      icon: <ApiOutlined style={{ fontSize: 40, color: '#1890ff' }} />,
      title: 'Deep Packet Inspection (DPI)',
      description: 'Analyze encrypted network traffic without decryption using advanced DPI techniques and protocol analysis.'
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 40, color: '#52c41a' }} />,
      title: 'Real-Time Detection',
      description: 'Advanced ML models detect network anomalies and security threats in real-time with high accuracy and minimal false positives.'
    },
    {
      icon: <ExperimentOutlined style={{ fontSize: 40, color: '#eb2f96' }} />,
      title: 'Rule-Based Detection',
      description: 'Flexible rule engine for custom detection logic, threshold-based alerts, and compliance monitoring.'
    },
    {
      icon: <FileSearchOutlined style={{ fontSize: 40, color: '#722ed1' }} />,
      title: 'Root Cause Analysis',
      description: 'SHAP and LIME explanations provide comprehensive root cause analysis and feature importance for every detection.'
    },
    {
      icon: <ThunderboltOutlined style={{ fontSize: 40, color: '#faad14' }} />,
      title: 'Early Prediction',
      description: 'LSTM-based deep learning models predict attacks 1-20 minutes in advance with continuous risk scoring and confidence levels.'
    },
    {
      icon: <InteractionOutlined style={{ fontSize: 40, color: '#13c2c2' }} />,
      title: 'Automated Response with SOAR',
      description: 'Integrate with SOAR platforms for automated incident response, threat mitigation, and orchestrated security workflows.'
    },
    {
      icon: <BulbOutlined style={{ fontSize: 40, color: '#fa8c16' }} />,
      title: 'LLM-Powered Insights',
      description: 'Leverage Large Language Models for intelligent threat analysis, natural language queries, and automated report generation.'
    },
    {
      icon: <LineChartOutlined style={{ fontSize: 40, color: '#9254de' }} />,
      title: 'Model Monitoring',
      description: 'Track model performance with accountability and resilience metrics, drift detection, and production monitoring.'
    },
    {
      icon: <EyeOutlined style={{ fontSize: 40, color: '#722ed1' }} />,
      title: 'Explainable AI (XAI)',
      description: 'Transparent AI decisions with SHAP, LIME, and feature attribution for compliance and trust.'
    }
  ];

  return (
    <Layout style={{ backgroundColor: '#fff' }}>
      <Content>
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <Title level={1} className="hero-title">
              Network Detection & Response
            </Title>
            <Title level={3} className="hero-subtitle" style={{ fontWeight: 400, color: '#595959' }}>
              AI-Powered Network Anomaly Detection with Explainable Intelligence
            </Title>
            <Paragraph className="hero-description" style={{ fontSize: 18, marginTop: 24, maxWidth: 700, margin: '24px auto' }}>
              Protect your network infrastructure with advanced machine learning models that detect and respond to 
              network threats and anomalies in real-time. Get early warnings, understand root causes, and automate responses.
            </Paragraph>
            <Space size="large" style={{ marginTop: 32 }} wrap>
              <Button 
                size="large" 
                onClick={() => navigate('/dpi')}
                style={{ height: 48, padding: '0 32px', fontSize: 16, background: '#fff', color: '#1890ff', border: '1px solid #1890ff' }}
              >
                Try Traffic Analysis
              </Button>
              <Button 
                size="large" 
                onClick={() => navigate('/models/all')}
                style={{ height: 48, padding: '0 32px', fontSize: 16, background: '#fff', color: '#1890ff', border: '1px solid #1890ff' }}
              >
                Explore Models
              </Button>
              <Button 
                size="large" 
                onClick={() => navigate('/predict')}
                style={{ height: 48, padding: '0 32px', fontSize: 16, background: '#fff', color: '#1890ff', border: '1px solid #1890ff' }}
              >
                Try Prediction
              </Button>
              <Button 
                size="large" 
                onClick={() => navigate('/sign-in')}
                style={{ height: 48, padding: '0 32px', fontSize: 16, background: '#fff', color: '#1890ff', border: '1px solid #1890ff' }}
              >
                Login
              </Button>
            </Space>
          </div>
        </div>

        {/* Features Section */}
        <div className="features-section">
          <div className="section-container">
            <Title level={2} style={{ textAlign: 'center', marginBottom: 16 }}>
              Key Features
            </Title>
            <Paragraph style={{ textAlign: 'center', fontSize: 16, color: '#8c8c8c', marginBottom: 48 }}>
              Comprehensive network security powered by cutting-edge AI technology
            </Paragraph>
            <Row gutter={[32, 32]}>
              {features.map((feature, index) => (
                <Col xs={24} sm={12} lg={8} key={index}>
                  <Card 
                    hoverable 
                    className="feature-card"
                    style={{ height: '100%', textAlign: 'center', minHeight: 300 }}
                  >
                    <div style={{ marginBottom: 16 }}>
                      {feature.icon}
                    </div>
                    <Title level={4}>{feature.title}</Title>
                    <Paragraph style={{ color: '#595959' }}>
                      {feature.description}
                    </Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </div>

        {/* About This Project - Projects Carousel */}
        <div className="projects-section">
          <div className="section-container">
            <Title level={2} style={{ textAlign: 'center', marginBottom: 16 }}>
              About This Project
            </Title>
            <Paragraph style={{ textAlign: 'center', fontSize: 16, color: '#8c8c8c', marginBottom: 48, maxWidth: 800, margin: '0 auto 48px' }}>
              Network Detection and Response (NDR) provides an anomaly detection and response capability 
              for encrypted network traffic. This work has been funded by the European Union's Horizon 
              Programme through multiple research projects.
            </Paragraph>

            {/* Projects Carousel */}
            <div className="projects-carousel">
              <div className="projects-slider">
                {projects.map((project, index) => (
                  <div
                    key={index}
                    className={`project-slide ${index === currentLogoIndex ? 'active' : ''}`}
                  >
                    <Card 
                      className="project-card"
                      hoverable
                    >
                      <Row gutter={[24, 24]} align="middle">
                        <Col xs={24} md={10}>
                          <div className="project-logo-container">
                            {project.logo ? (
                              project.website ? (
                                <a href={project.website} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={project.logo}
                                    alt={`${project.name} Logo`}
                                    className="project-card-logo"
                                  />
                                </a>
                              ) : (
                                <img
                                  src={project.logo}
                                  alt={`${project.name} Logo`}
                                  className="project-card-logo"
                                />
                              )
                            ) : (
                              <div className="project-placeholder-logo">
                                <Title level={3} style={{ color: '#1890ff', margin: 0 }}>
                                  {project.name}
                                </Title>
                              </div>
                            )}
                          </div>
                        </Col>
                        <Col xs={24} md={14}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Title level={3} style={{ marginBottom: 8 }}>
                              {project.name}
                            </Title>
                            <Text type="secondary" style={{ fontSize: 15 }}>
                              Grant N° {project.grantNumber}
                            </Text>
                            <Paragraph style={{ fontSize: 15, marginTop: 16, marginBottom: 16 }}>
                              {project.description}
                            </Paragraph>
                            {project.website && (
                              <Button 
                                type="primary"
                                href={project.website} 
                                target="_blank"
                              >
                                Visit Project Website →
                              </Button>
                            )}
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  </div>
                ))}
              </div>
              
              {/* Carousel indicators */}
              <div className="carousel-indicators">
                {projects.map((_, index) => (
                  <span
                    key={index}
                    className={`indicator ${index === currentLogoIndex ? 'active' : ''}`}
                    onClick={() => setCurrentLogoIndex(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default LandingPage;
