import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";

class PredictPage extends Component {
  componentDidMount() {
    const tool = getLastPath();
    const logFile = getQuery('logFile');
    console.log(tool, logFile);
  }

  render() {
    const {message} = this.props;
    return (
      <LayoutPage pageTitle="Predict Page" pageSubTitle="This is a dummy page">
      </LayoutPage>
    );
  }
}

export default PredictPage;
