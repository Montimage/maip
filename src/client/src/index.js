import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import configStore from "../../client/src/store";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import "./index.css";
import { ClerkProvider } from '@clerk/clerk-react';

// ============================================================================
// COMPLETELY SUPPRESS RESIZEOBSERVER ERRORS (Harmless Ant Design timing issue)
// ============================================================================
// This is a known issue with Ant Design tables/charts and React
// The error is 100% safe to ignore - it doesn't affect functionality

// 1. Catch at window.error level
const resizeObserverErrorHandler = (event) => {
  if (
    event.message && (
      event.message.includes('ResizeObserver loop') ||
      event.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      event.message === 'ResizeObserver loop limit exceeded'
    )
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return false;
  }
};

window.addEventListener('error', resizeObserverErrorHandler);

// 2. Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    event.reason.message &&
    event.reason.message.includes('ResizeObserver loop')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

// 3. Override console.error to filter ResizeObserver messages
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ResizeObserver loop') || 
     args[0].includes('ResizeObserver loop completed with undelivered notifications'))
  ) {
    return; // Suppress completely
  }
  originalError.apply(console, args);
};

// 4. Debounce ResizeObserver to reduce frequency
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 5. Patch ResizeObserver constructor if available
if (typeof ResizeObserver !== 'undefined') {
  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback) {
      super(debounce(callback, 20)); // Debounce by 20ms
    }
  };
}

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
