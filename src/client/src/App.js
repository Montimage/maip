import React from "react";
//import "antd/dist/antd.css";
import { Layout } from "antd";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import ErrorBoundary from "antd/lib/alert/ErrorBoundary";
import MAIPHeader from "./components/MAIPHeader";
import MAIPFooter from "./components/MAIPFooter";
import DummyPage from "./pages/DummyPage";
import DataGeneratorPage from "./pages/DataGeneratorPage";

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
              render={() => <Navigate to="/datasets" />}
            />
          </Routes>
          <MAIPFooter />
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
