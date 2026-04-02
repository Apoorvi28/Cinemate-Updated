import React from "react";
import ReactDOM from "react-dom/client"; // for Vite 3.x and later
import App from "./App";
import "./styles.css";  // Import the CSS file here

// Create a root element for rendering the app
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
