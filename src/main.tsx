import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker AFTER React has mounted, with iframe/preview
// guards. This prevents the "reload on resume" issue caused by autoUpdate.
registerServiceWorker();

