import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
class DummyPage extends Component {
  componentDidMount() {
    const tool = getLastPath();
    const logFile = getQuery('logFile');
    console.log(tool, logFile);
  }

  render() {
    const {message} = this.props;
    return (
      <LayoutPage pageTitle="Dummy Page" pageSubTitle="This is a dummy page">
        <div> Hello from Dummy Page: {message}</div>
      </LayoutPage>
    );
  }
}

export default DummyPage;
