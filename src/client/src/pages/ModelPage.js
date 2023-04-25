import React, { Component } from "react";
import { connect } from "react-redux";
import LayoutPage from "./LayoutPage";
import JSONView from "../components/JSONView";
import {
  requestModel,
} from "../actions";
import { 
  getLastPath,
} from "../utils";

class ModelPage extends Component {

  componentDidMount() {
    let modelId = getLastPath();
    this.props.fetchModel(modelId);
  }

  render() {
    const {
      model,
    } = this.props;
    console.log(model);
    let modelId = getLastPath();

    const { stats, buildConfig, confusionMatrix, trainingSamples, testingSamples, predictedProbs } = model;

    return (
      <LayoutPage pageTitle="Model" pageSubTitle={`Model ${modelId}`}>
        <div>
          {Object.entries(model).map(([key, value]) => (
            <div key={key}>
              <h3>{key}</h3>
              <pre>{JSON.stringify(value, null, 2)}</pre>
            </div>
          ))}
        </div>
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ model }) => ({
  model
});

const mapDispatchToProps = (dispatch) => ({
  fetchModel: (modelId) => dispatch(requestModel(modelId)),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelPage);
