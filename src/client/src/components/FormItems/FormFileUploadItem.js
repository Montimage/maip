import React, { Component } from "react";
import {
  UploadOutlined,
} from "@ant-design/icons";
import { Button, Form, message } from "antd";

class FormFileUploadItem extends Component {
  constructor(props) {
    super(props);
  }
  onUpload(files) {
    const fileReader = new FileReader();
    fileReader.onloadend = () => {
      try {
        this.props.onUpload(fileReader.result);
      } catch (error) {
        console.error(error);
        message.error(`Failed to upload file: ${JSON.stringify(error)}`);
      }
    };
    fileReader.readAsText(files[0]);
  }

  render() {
    const {
      label,
      uploadButtonLabel = "Upload",
      fileType = "*",
      extra = null,
    } = this.props;
    return (
      <Form.Item name="upload" label={label} extra={extra}>
        <Button onClick={() => this.inputFileDOM.click()}>
          <UploadOutlined /> {uploadButtonLabel}
          <input
            type="file"
            onChange={(event) => this.onUpload(event.target.files)}
            ref={(input) => {
              this.inputFileDOM = input;
            }}
            style={{ display: "none" }}
            accept={fileType}
            multiple={false}
          />
        </Button>
      </Form.Item>
    );
  }
}

export default FormFileUploadItem;
