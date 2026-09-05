import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import { convexClient } from "./convexClient";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convexClient}>
      <ConvexAuthProvider client={convexClient}>
        <App />
      </ConvexAuthProvider>
    </ConvexProvider>
  </React.StrictMode>,
);
