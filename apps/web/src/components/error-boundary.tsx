import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ErrorPage } from './error-page';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorPage
          code="500"
          icon={AlertTriangle}
          title="예기치 않은 오류가 발생했습니다"
          description="일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
          primaryAction={{
            label: '다시 시도',
            onClick: this.handleRetry,
          }}
          secondaryAction={{
            label: '홈으로 이동',
            onClick: () => {
              window.location.href = '/';
            },
          }}
        />
      );
    }

    return this.props.children;
  }
}
