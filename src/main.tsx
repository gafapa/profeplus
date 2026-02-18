import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { store } from "./app/store";
import "./styles.css";

registerSW({ immediate: true });

function resolveRouterBase(): string {
  const rawBase = import.meta.env.BASE_URL || "/";
  const normalized = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
  return normalized.length > 0 ? normalized : "/";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={resolveRouterBase()}>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
