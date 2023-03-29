import React, { Component, Fragment, useMemo } from "react";
import { connect } from "react-redux";
import { Table, Button } from "antd";
import LayoutPage from "./LayoutPage";
import {
  requestAllModels,
} from "../actions";

class ModelListPage extends Component {
  componentDidMount() {
    this.props.fetchAllModels();
  }

  render() {
    const {
      allModels,
    } = this.props;
    console.log(allModels);
    if (!allModels) {
      console.error("No models")
      return null;
    }
    const dataSource = allModels.map((model, index) => {
      return {
        modelId: model.replace(".h5", ""),
        key: index,
      };
    });
    const columns = [
      {
        title: "Name",
        key: "data",
        render: (model) => (
          <a href={`/models/${model.modelId}`}>
            {model.modelId}
          </a>
        ),
      },
    ];
    return (
      <LayoutPage pageTitle="Models" pageSubTitle="All the models">
        <Table columns={columns} dataSource={dataSource} />
      </LayoutPage>
    );
  }
}

const mapPropsToStates = ({ allModels }) => ({
  allModels,
});

const mapDispatchToProps = (dispatch) => ({
  fetchAllModels: () => dispatch(requestAllModels()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(ModelListPage);
