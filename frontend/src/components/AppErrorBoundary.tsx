import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  message: string;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { message: "" };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message || "Error inesperado al cargar la aplicacion." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render error", error, info);
  }

  render() {
    if (this.state.message) {
      return (
        <main className="min-h-screen bg-[#eef3f8] px-4 py-8">
          <section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Error de carga</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">No se pudo abrir la aplicacion</h1>
            <p className="mt-3 rounded-lg bg-red-50 p-3 font-semibold text-red-700">{this.state.message}</p>
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Recarga la pagina. Si sigue fallando, revisa que el ultimo deploy de Vercel haya terminado correctamente.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
