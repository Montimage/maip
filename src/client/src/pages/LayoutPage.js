import React, { Component } from "react";
import { connect } from "react-redux";
import { notification, Spin, Layout, Typography } from "antd";
import { resetNotification } from "../actions";
import MAIPFooter from "../components/MAIPFooter";
import "./styles.css";
const { Title, Text } = Typography;

const { Content } = Layout;

class LayoutPage extends Component {

  render() {
    const {
      requesting,
      notify,
      resetNotification,
      pageTitle,
      pageSubTitle,
    } = this.props;
    return (
      <Layout style={{backgroundColor: 'white'}}>
        {notify &&
          notification[notify.type]({
            message: notify.type.toUpperCase(),
            description:
              typeof notify.message === "object"
                ? JSON.stringify(notify.message)
                : notify.message,
            onClose: () => resetNotification(),
          })}
        <Layout style={{ padding: "0px 48px 48px", margin: "30px 50px 50px" }}>
          <Content>
            {pageTitle && <Title level={2}>{pageTitle}</Title>}
            {pageSubTitle && <Text type="secondary">{pageSubTitle}</Text>}
            <div style={{ paddingTop: "30px" }} className="site-layout-content">
              {requesting ? <div style={{textAlign: "center", marginTop: 30}}><Spin tip="Loading..." /></div> : this.props.children}
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }
}

const mapPropsToStates = ({ requesting, notify }) => ({
  notify,
  requesting,
});

const mapDispatchToProps = (dispatch) => ({
  resetNotification: () => dispatch(resetNotification()),
});

export default connect(mapPropsToStates, mapDispatchToProps)(LayoutPage);
