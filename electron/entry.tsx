import React from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css";
import { DashboardPage } from "../src/routes/index";

const el = document.getElementById("root")!;
createRoot(el).render(
  <React.StrictMode>
    <DashboardPage />
  </React.StrictMode>
);
