import { initSentry } from "@/lib/sentry";

// Initialize Sentry before anything else — catches errors from initial render
// and installs global unhandledrejection + error handlers via the SDK
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
