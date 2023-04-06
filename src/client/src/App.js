import React from "react";
import { Layout } from 'antd';
import "antd/dist/reset.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import MAIPHeader from "./components/MAIPHeader";
import MAIPFooter from "./components/MAIPFooter";
import ModelListPage from "./pages/ModelListPage";
import ModelPage from "./pages/ModelPage";
import DatasetPage from "./pages/DatasetPage";
import BuildPage from "./pages/BuildPage";
import RetrainPage from "./pages/RetrainPage";
import DummyPage from "./pages/DummyPage";
import XAIPage from "./pages/XAIPage";

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ height: "100%" }}>
          <MAIPHeader />
          <Routes>
            <Route
              exact
              path="/"
              render={() => <Navigate to="/build" />}
            />          
            <Route path="/models" element={<ModelListPage />}/>
            <Route path="/models/:modelId" element={<ModelPage />}/> 
            <Route path="/models/:modelId/build-config" element={<ModelPage />}/>
            <Route path="/build" element={<BuildPage />}/>
            <Route path="/models/:modelId/download" element={<ModelPage />}/>
            <Route path="/models/:modelId/confusion-matrix" element={<ModelPage />}/>
            <Route path="/models/:modelId/datasets/training" element={<DatasetPage />}/>
            <Route path="/models/:modelId/datasets/testing" element={<DatasetPage />}/>
            <Route path="/xai/:modelId" element={<XAIPage />}/>
          </Routes>
          <MAIPFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

/* 
<Route path="/models/:modelId" element={<ModelPage />}/>
<Route path="/models/:modelId/build-config" element={<ModelPage />}/>
<Route path="/models/:modelId/download" element={<ModelPage />}/>
<Route path="/models/:modelId/confusion-matrix" element={<ModelPage />}/>
<Route path="/build" element={<BuildPage />}/>
<Route path="/retrain" element={<RetrainPage />}/> 
<Route path="/models/:modelId/datasets/training" element={<DatasetPage />}/>
<Route path="/models/:modelId/datasets/testing" element={<DatasetPage />}/>
*/

export default App;
