import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ProfePlus could not render the current view.", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-page" id="main-content">
          <section role="alert" aria-labelledby="fatal-error-title">
            <h1 id="fatal-error-title">No se pudo mostrar ProfePlus</h1>
            <p>Recarga la aplicación. Tus datos locales no se han eliminado.</p>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
