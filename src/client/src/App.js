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
import ProtectedRoute from "./components/ProtectedRoute";
import ModelListPage from "./pages/ModelListPage";
import ModelsComparisonPage from "./pages/ModelsComparisonPage";
//import DatasetListPage from "./pages/DatasetListPage";
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
import AboutPage from "./pages/AboutPage";
import FeatureExtractionPage from "./pages/FeatureExtractionPage";
import EarlyPredictionPage from "./pages/EarlyPredictionPage";
import DPIPage from "./pages/DPIPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
//import MetricsTestPage from "./pages/MetricsTestPage";
//import ScatterPage from "./pages/ScatterPage";

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout className="layout" style={{ minHeight: "100vh", paddingBottom: 64 }}>
          <MAIPHeader />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/models/all" replace />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/about" element={<AboutPage />} />
            
            {/* Public read-only routes */}
            <Route path="/features" element={<FeatureExtractionPage />} />
            <Route path="/models/all" element={<ModelListPage />} />
            <Route path="/models/comparison" element={<ModelsComparisonPage />} />
            <Route path="/models/datasets/:modelId/:datasetType" element={<DatasetPage />} />
            <Route path="/dpi" element={<DPIPage />} />
            
            {/* Protected routes - require authentication */}
            <Route 
              path="/models/retrain" 
              element={<ProtectedRoute><RetrainPage /></ProtectedRoute>} 
            />
            <Route 
              path="/models/retrain/:modelId" 
              element={<ProtectedRoute><RetrainPage /></ProtectedRoute>} 
            />
            <Route 
              path="/build/ad" 
              element={<ProtectedRoute><BuildADPage app="ad" /></ProtectedRoute>} 
            />
            <Route 
              path="/build/ac" 
              element={<ProtectedRoute><BuildACPage app="ac" /></ProtectedRoute>} 
            />
            
            {/* XAI routes - protected */}
            <Route 
              path="/xai/shap" 
              element={<ProtectedRoute><XAIShapPage /></ProtectedRoute>} 
            />
            <Route 
              path="/xai/shap/:modelId" 
              element={<ProtectedRoute><XAIShapPage /></ProtectedRoute>} 
            />
            <Route 
              path="/xai/lime" 
              element={<ProtectedRoute><XAILimePage /></ProtectedRoute>} 
            />
            <Route 
              path="/xai/lime/:modelId" 
              element={<ProtectedRoute><XAILimePage /></ProtectedRoute>} 
            />
            
            {/* Metrics routes - protected */}
            <Route 
              path="/metrics/accountability" 
              element={<ProtectedRoute><AccountabilityMetricsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/metrics/accountability/:modelId" 
              element={<ProtectedRoute><AccountabilityMetricsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/metrics/resilience" 
              element={<ProtectedRoute><ResilienceMetricsPage /></ProtectedRoute>} 
            />
            <Route 
              path="/metrics/resilience/:modelId" 
              element={<ProtectedRoute><ResilienceMetricsPage /></ProtectedRoute>} 
            />
            
            {/* Attack routes - protected */}
            <Route 
              path="/attacks" 
              element={<ProtectedRoute><AttacksPage /></ProtectedRoute>} 
            />
            <Route 
              path="/attacks/:modelId" 
              element={<ProtectedRoute><AttacksPage /></ProtectedRoute>} 
            />
            
            {/* Prediction routes - public access (online mode restricted to admins within page) */}
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/predict/online" element={<PredictPage />} />
            <Route path="/predict/online/:modelId" element={<PredictPage />} />
            <Route path="/predict/offline" element={<PredictPage />} />
            <Route path="/predict/offline/:modelId" element={<PredictPage />} />
            <Route path="/predict/rule-based" element={<PredictRuleBasedPage />} />
            <Route path="/predict/early" element={<EarlyPredictionPage />} />
            <Route path="/predict/:modelId" element={<PredictPage />} />
          </Routes>
          <MAIPFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}


export default App;
