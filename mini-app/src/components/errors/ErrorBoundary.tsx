import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getErrorReporter } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    getErrorReporter().captureException(error, { componentStack: errorInfo.componentStack ?? 'unknown' });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-crash-red/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-crash-red" />
          </div>
          <h2 className="text-xl font-bold text-tg-text mb-2">Something went wrong</h2>
          <p className="text-sm text-tg-hint mb-6 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={this.handleReset}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
