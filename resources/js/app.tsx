import "./bootstrap";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./doska/App";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app element");

createRoot(el).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
