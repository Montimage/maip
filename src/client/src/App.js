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
import ModelsComparisonPage from "./pages/ModelsComparisonPage";
//import DatasetListPage from "./pages/DatasetListPage";
import DatasetPage from "./pages/DatasetPage";
import BuildADPage from "./pages/BuildADPage";
import BuildACPage from "./pages/BuildACPage";
import RetrainPage from "./pages/RetrainPage";
import AttacksPage from "./pages/AttacksPage";
//import PredictPage from "./pages/PredictPage";
import PredictModelPage from "./pages/PredictModelPage";
import PredictOnlinePage from "./pages/PredictOnlinePage";
import PredictOfflinePage from "./pages/PredictOfflinePage";
import XAILimePage from "./pages/XAILimePage";
import XAIShapPage from "./pages/XAIShapPage";
import MetricsPage from "./pages/MetricsPage";
import AccountabilityMetricsPage from "./pages/AccountabilityMetricsPage";
import ResilienceMetricsPage from "./pages/ResilienceMetricsPage";
import AboutPage from "./pages/AboutPage";
//import MetricsTestPage from "./pages/MetricsTestPage";
//import ScatterPage from "./pages/ScatterPage";

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ height: "100%" }}>
          <MAIPHeader />
          <Routes>    
            <Route
              path="/"
              element={<Navigate to="/models/all" replace />}
            />     
            <Route path="/models/all" element={<ModelListPage />}/>
            <Route path="/models/comparison" element={<ModelsComparisonPage />}/>
            <Route path="/models/retrain" element={<RetrainPage />}/>
            <Route path="/models/retrain/:modelId" element={<RetrainPage />}/>
            <Route path="/build/ad" element={<BuildADPage app="ad" />} />
            <Route path="/build/ac" element={<BuildACPage app="ac" />} />
            <Route path="/models/datasets/:modelId/:datasetType" element={<DatasetPage />}/>
            <Route path="/xai/shap" element={<XAIShapPage />}/>
            <Route path="/xai/shap/:modelId" element={<XAIShapPage />}/>
            <Route path="/xai/lime" element={<XAILimePage />}/>
            <Route path="/xai/lime/:modelId" element={<XAILimePage />}/>
            <Route path="/metrics/:modelId" element={<MetricsPage />}/>
            <Route path="/metrics/accountability" element={<AccountabilityMetricsPage />}/>
            <Route path="/metrics/accountability/:modelId" element={<AccountabilityMetricsPage />}/>
            <Route path="/metrics/resilience" element={<ResilienceMetricsPage />}/>
            <Route path="/metrics/resilience/:modelId" element={<ResilienceMetricsPage />}/>
            <Route path="/attacks" element={<AttacksPage />}/>
            <Route path="/attacks/:modelId" element={<AttacksPage />}/>
            <Route path="/predict/online" element={<PredictOnlinePage />}/>
            <Route path="/predict/online/:modelId" element={<PredictOnlinePage />}/>
            <Route path="/predict/offline" element={<PredictOfflinePage />}/>
            <Route path="/predict/offline/:modelId" element={<PredictOfflinePage />}/>
            <Route path="/predict/:modelId" element={<PredictModelPage />}/>
            <Route path="/about" element={<AboutPage />}/>
          </Routes>
          <MAIPFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}


export default App;
