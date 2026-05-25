import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Wystąpił błąd w interfejsie:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDynamicImportError = this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('error loading dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed');

      const errorTitle = isDynamicImportError
        ? "Aplikacja została zaktualizowana"
        : "Coś poszło nie tak";
      const errorDesc = isDynamicImportError
        ? "Aplikacja została zaktualizowana. Odśwież stronę, aby pobrać najnowszą wersję."
        : "Niestety wystąpił nieoczekiwany błąd aplikacji. Przepraszamy za utrudnienia.";

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)] p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="omni-heading-3 text-slate-900 mb-3">
              {errorTitle}
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
              {errorDesc}
            </p>
            {this.state.error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs text-left overflow-auto mb-6 max-h-32">
                <code>{this.state.error.message}</code>
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full omni-btn-primary flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Odśwież stronę
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
