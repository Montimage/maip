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
import DatasetListPage from "./pages/DatasetListPage";
import DatasetPage from "./pages/DatasetPage";
import BuildPage from "./pages/BuildPage";
import RetrainPage from "./pages/RetrainPage";
//import DummyPage from "./pages/DummyPage";
import XAIPage from "./pages/XAIPage";
import XAIModelPage from "./pages/XAIModelPage";
import XAIShapPage from "./pages/XAIShapPage";
import XAILimePage from "./pages/XAILimePage";

import HistogramPage from "./pages/HistogramPage";
import TablePage from "./pages/TablePage";

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
            <Route path="/models/:modelId/download" element={<ModelListPage />}/>
            <Route path="/models/:modelId" element={<ModelPage />}/> 
            <Route path="/models/:modelId/build-config" element={<ModelPage />}/>
            <Route path="/build" element={<BuildPage />}/>
            <Route path="/retrain/:modelId" element={<RetrainPage />}/>
            <Route path="/models/:modelId/confusion-matrix" element={<ModelPage />}/>
            <Route path="/datasets" element={<DatasetListPage />}/>
            <Route path="/datasets/:modelId/:datasetType" element={<DatasetPage />}/>
            <Route path="/xai/" element={<XAIPage />}/>
            <Route path="/xai/:modelId" element={<XAIModelPage />}/>
            <Route path="/xai/shap/:modelId" element={<XAIShapPage />}/>
            <Route path="/xai/lime/:modelId" element={<XAILimePage />}/>
            <Route path="/dumb" element={<HistogramPage />}/>
            <Route path="/table" element={<TablePage />}/>
          </Routes>
          <MAIPFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}


export default App;
