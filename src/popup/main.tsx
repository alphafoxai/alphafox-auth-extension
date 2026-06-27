import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";

import "./index.css";
import Popup from "./popup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Toaster position="top-right" duration={4500} richColors />
    <Popup />
  </React.StrictMode>
);
