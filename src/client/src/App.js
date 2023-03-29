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
          </Routes>
          <MAIPFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
