import React, { Component } from 'react';
import LayoutPage from './LayoutPage';

class AboutPage extends Component {
  render() {
    return (
      <LayoutPage pageTitle="About" pageSubTitle="About Montimage AI Platform (MAIP)">
        <p style={{ fontSize: 16 }}>
          Montimage AI Platform (MAIP) provides users with easy access to AI services developed by Montimage.
          It offers a friendly and intuitive interface for interacting with the APIs. MAIP delivers a wide range of ML services,
          including features extraction, model building and retraining, adversarial attack injection, explanations production, and
          model evaluation using various metrics. Currently it supports two AI-based cybersecurity applications:
        </p>

        <ul style={{ fontSize: 16 }}>
          <li>
            <a href="https://github.com/Montimage/activity-classification">Activity Classification </a>
            classifies network traffic based on user activity, such as web browsing, chatting or watching videos.
          </li>
          <li>
            <a href="https://github.com/Montimage/acas">Anomaly Detection </a>
            detects whether network traffic is harmless or contains malicious activity.
          </li>
        </ul>

        <h2 style={{ fontSize: 20, marginTop: 30, marginBottom: 15 }}>Useful Links</h2>
        <ul style={{ fontSize: 16 }}>
          <li><a href="https://maip.montimage.com">Website</a></li>
          <li><a href="https://maip-docs.montimage.com">Documentation</a></li>
          <li><a href="https://github.com/Montimage/maip">Source code</a></li>
          <li><a href="https://hub.docker.com/repository/docker/montimage/maip/general">Docker</a></li>
        </ul>

        <p style={{ fontSize: 16 }}>
          This work has been funded by the European Union's H2020 Programme under grant agreement N° 101021808 for the SPATIAL project.
        </p>
        <a href="https://spatial-h2020.eu/">
          <img
            src={'/img/spatial.png'}
            className="logo"
            alt="Logo"
            style={{ width: "400px", height: '200px' }}
          />
        </a>
      </LayoutPage>
    );
  }
}

export default AboutPage;