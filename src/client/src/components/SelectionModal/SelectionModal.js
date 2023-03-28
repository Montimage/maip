import React from "react";
import MAIPModal from "../MAIPModal";
import { Checkbox, List } from "antd";

const SelectionModal = ({
  onCancel,
  onChange,
  enable,
  options,
  defaultValue,
  title
}) => (
  <MAIPModal
    title={title}
    visible={enable}
    onCancel={() => onCancel()}
    footer={[]}
  >
    <Checkbox.Group
      style={{ width: "100%" }}
      defaultValue={defaultValue}
      onChange={(values) => onChange(values)}
    >
      <List
        size="small"
        dataSource={options}
        renderItem={(item) => (
          <List.Item>
            <Checkbox value={item.id}>{item.id}</Checkbox>
          </List.Item>
        )}
      />
    </Checkbox.Group>
  </MAIPModal>
);
export default SelectionModal;
