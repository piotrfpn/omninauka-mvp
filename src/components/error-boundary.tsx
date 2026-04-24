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
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)] p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="omni-heading-3 text-[var(--omni-text)] mb-3">
              Coś poszło nie tak
            </h2>
            <p className="text-[var(--omni-text-muted)] mb-6 text-sm">
              Niestety wystąpił nieoczekiwany błąd aplikacji. Przepraszamy za utrudnienia.
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
