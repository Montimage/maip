import React from 'react';
import JsonEditor from './Editor';

import ace from 'brace';
import 'brace/mode/json';
import 'brace/theme/github';

import './style.css';

const JSONView = ({value, onChange}) => (
  <JsonEditor
    value={value}
    onChange={onChange}
    allowedModes={["tree", "code"]}
    ace={ace}
    theme="ace/theme/github"
  />
)

export default JSONView;