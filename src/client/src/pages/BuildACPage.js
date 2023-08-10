import React, { Component } from 'react';
import LayoutPage from './LayoutPage';
import { getLastPath, getQuery } from "../utils";
import {
  requestApp,
} from "../actions";
import { connect } from 'react-redux';

class BuildACPage extends Component {
  componentDidMount() {
    this.props.fetchApp();
  }

  render() {
    return (
      <LayoutPage pageTitle="Build Models" pageSubTitle="Build a new AI model for activity classification">
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

export default connect(mapPropsToStates, mapDispatchToProps)(BuildACPage);
