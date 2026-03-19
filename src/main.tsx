import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { I18nProvider } from "./shared/i18n/I18nProvider";
import "./shared/design/tokens.css";
import "./shared/design/theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
