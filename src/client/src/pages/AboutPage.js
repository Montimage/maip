import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";

class AboutPage extends Component {
  render() {
    return (
      <LayoutPage pageTitle="About" pageSubTitle="About Montimage AI Platform (MAIP)">
        <p style={{ fontSize: 16 }}>
          Montimage AI Platform (MAIP) provides users with easy access to AI services developed by Montimage. 
          It offers a friendly and intuitive interface for interacting with the APIs. MAIP delivers a wide range of ML services, 
          including features extraction, model building and retraining, adversarial attack injection, explanations production, and 
          model evaluation using various metrics. Each of these services is exposed through dedicated APIs that can be accessed via the server. 
          This makes it easy to integrate with other applications and systems.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 30, marginBottom: 15 }}>Useful Links</h2>
        <ul style={{ fontSize: 16 }}>
          <li><a href="https://maip.montimage.com">Website</a></li>
          <li><a href="https://maip-docs.montimage.com">Documentation</a></li>
          <li><a href="https://github.com/Montimage/maip">Github</a></li>
          <li><a href="https://hub.docker.com/repository/docker/montimage/maip/general">Docker</a></li>
        </ul>
      </LayoutPage>
    );
  }
}

export default AboutPage;