import React from "react";
import ReactDOM from "react-dom/client";
import BetaLobbyApp from "./BetaLobbyApp";
import { AppProviders } from "./providers/AppProviders";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProviders>
      <BetaLobbyApp />
    </AppProviders>
  </React.StrictMode>,
);
