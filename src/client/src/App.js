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
import MAIPSidebar from "./components/MAIPSidebar";
import MAIPFooter from "./components/MAIPFooter";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ModelListPage from "./pages/ModelListPage";
import ModelsComparisonPage from "./pages/ModelsComparisonPage";
import DatasetPage from "./pages/DatasetPage";
import BuildADPage from "./pages/BuildADPage";
import BuildACPage from "./pages/BuildACPage";
import RetrainPage from "./pages/RetrainPage";
import AttacksPage from "./pages/AttacksPage";
import PredictRuleBasedPage from "./pages/PredictRuleBasedPage";
import PredictPage from "./pages/PredictPage";
import XAILimePage from "./pages/XAILimePage";
import XAIShapPage from "./pages/XAIShapPage";
import AccountabilityMetricsPage from "./pages/AccountabilityMetricsPage";
import ResilienceMetricsPage from "./pages/ResilienceMetricsPage";
import LandingPage from "./pages/LandingPage";
import FeatureExtractionPage from "./pages/FeatureExtractionPage";
import EarlyPredictionPage from "./pages/EarlyPredictionPage";
import DPIPage from "./pages/DPIPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ minHeight: "100vh" }}>
          <MAIPHeader />
          <Layout style={{ paddingTop: 64 }}>
            <MAIPSidebar />
            <Layout style={{ marginLeft: 250, background: '#fff' }}>
              <Layout.Content style={{ padding: '24px', minHeight: 'calc(100vh - 64px - 64px)', background: '#fff' }}>
                <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/about" element={<LandingPage />} />
            
            {/* Public read-only routes */}
            <Route path="/features" element={<FeatureExtractionPage />} />
            <Route path="/models/all" element={<ModelListPage />} />
            <Route path="/models/comparison" element={<ModelsComparisonPage />} />
            <Route path="/models/datasets/:modelId/:datasetType" element={<DatasetPage />} />
            <Route path="/dpi" element={<DPIPage />} />
            
            {/* Build and Retrain routes - accessible to all (pages have frozen overlays for non-admins) */}
            <Route 
              path="/models/retrain" 
              element={<RetrainPage />} 
            />
            <Route 
              path="/models/retrain/:modelId" 
              element={<RetrainPage />} 
            />
            <Route 
              path="/build/ad" 
              element={<BuildADPage app="ad" />} 
            />
            <Route 
              path="/build/ac" 
              element={<BuildACPage app="ac" />} 
            />
            
            {/* XAI routes - public */}
            <Route 
              path="/xai/shap" 
              element={<XAIShapPage />} 
            />
            <Route 
              path="/xai/shap/:modelId" 
              element={<XAIShapPage />} 
            />
            <Route 
              path="/xai/lime" 
              element={<XAILimePage />} 
            />
            <Route 
              path="/xai/lime/:modelId" 
              element={<XAILimePage />} 
            />
            
            {/* Metrics routes - public */}
            <Route 
              path="/metrics/accountability" 
              element={<AccountabilityMetricsPage />} 
            />
            <Route 
              path="/metrics/accountability/:modelId" 
              element={<AccountabilityMetricsPage />} 
            />
            <Route 
              path="/metrics/resilience" 
              element={<ResilienceMetricsPage />} 
            />
            <Route 
              path="/metrics/resilience/:modelId" 
              element={<ResilienceMetricsPage />} 
            />
            
            {/* Attack routes - public */}
            <Route 
              path="/attacks" 
              element={<AttacksPage />} 
            />
            <Route 
              path="/attacks/:modelId" 
              element={<AttacksPage />} 
            />
            
            {/* Prediction routes - public access (online mode restricted to admins within page) */}
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/predict/online" element={<PredictPage />} />
            <Route path="/predict/online/:modelId" element={<PredictPage />} />
            <Route path="/predict/offline" element={<PredictPage />} />
            <Route path="/predict/offline/:modelId" element={<PredictPage />} />
            <Route path="/predict/rule-based" element={<PredictRuleBasedPage />} />
            <Route path="/predict/:modelId" element={<PredictPage />} />
            
            {/* Early Prediction route - accessible to all (page has frozen overlay for non-admins) */}
            <Route 
              path="/predict/early" 
              element={<EarlyPredictionPage />} 
            />
                </Routes>
              </Layout.Content>
              <MAIPFooter />
            </Layout>
          </Layout>
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}


export default App;
