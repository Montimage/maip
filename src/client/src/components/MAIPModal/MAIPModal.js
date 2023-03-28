import React from "react";
import { Modal } from "antd";
import "./style.css";

const MAIPModal = ({ visible, title, footer, onCancel, children }) => (
  <Modal visible={visible} title={title} footer={footer} onCancel={onCancel}>
    {children}
  </Modal>
);

export default MAIPModal;
