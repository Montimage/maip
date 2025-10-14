import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import configStore from "../../client/src/store";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import "./index.css";
import { ClerkProvider } from '@clerk/clerk-react';

// CRA exposes only REACT_APP_* vars at build time, but support VITE_* fallback if present
const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;

const store = configStore();
const rootEl = document.getElementById("root");
if (!PUBLISHABLE_KEY) {
  // Fallback: run without Clerk if key is not provided
  // Tip: set REACT_APP_CLERK_PUBLISHABLE_KEY in src/client/.env or project .env
  console.warn('[Clerk] Missing publishable key. Running without authentication.');
  ReactDOM.render(
    <Provider store={store}>
      <App />
    </Provider>,
    rootEl
  );
} else {
  ReactDOM.render(
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Provider store={store}>
        <App />
      </Provider>
    </ClerkProvider>,
    rootEl
  );
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
