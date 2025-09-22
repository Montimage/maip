import React, { Component } from 'react';
import LayoutPage from './LayoutPage';

class AboutPage extends Component {
  render() {
    return (
      <LayoutPage pageTitle="About" pageSubTitle="About Network Detection and Response (NDR)">
        <p style={{ fontSize: 16 }}>
          Network Detection and Response (NDR) component provides an anomaly detection and response capability for (encrypted) network traffic. NDR includes an Explainable AI (XAI) capability to enable root cause analysis (RCA) of detected anomalies. 
          Responses can be automatically triggered through the Mitigation Manager.
        </p>
        
        <p style={{ fontSize: 16 }}>
          This work has been funded by the European Union's H2020 Programme under grant agreement N° 101119681 for the ResilMesh project.
        </p>
        <a href="https://resilmesh.eu/">
          <img
            src={'/img/logo-resilmesh.png'}
            className="logo"
            alt="Logo"
            style={{ width: "400px", height: '150px' }}
          />
        </a>
      </LayoutPage>
    );
  }
}

export default AboutPage;