import React, { Component, Fragment, useMemo } from "react";
import { connect } from "react-redux";
import { Table, Button } from "antd";
import LayoutPage from "./LayoutPage";
import JSONView from "../components/JSONView";
import {
  requestModel,
} from "../actions";
import { getLastPath } from "../utils";

class ModelPage extends Component {
  
  componentDidMount() {
    let modelId = getLastPath();
    this.props.requestModel(modelId);
  }

  render() {
    const {
      model,
    } = this.props;
    console.log(model);
    let modelId = getLastPath();
    // TODO: pretty print the json buildConfig
    /* <div><pre>{JSON.stringify(model, null, 2) }</pre></div> */
    /* {<JSONView value={JSON.stringify(model)} />}; */
    return (
      <LayoutPage pageTitle="Model" pageSubTitle={`Build config of model ${modelId}`}>
        <div><pre>{model}</pre></div>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ model }) => ({
  model,
});

const mapDispatchToProps = (dispatch) => ({
  requestModel: (modelId) => dispatch(requestModel(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelPage);
