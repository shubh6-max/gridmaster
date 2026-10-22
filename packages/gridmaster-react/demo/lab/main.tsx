import React from "react";
import ReactDOM from "react-dom/client";
import Lab from "./Lab";
import "./lab.css";

const root = document.getElementById("root");
if (!root) throw new Error("Feature Lab: #root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Lab />
  </React.StrictMode>
);
