'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  isHydrationError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isHydrationError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a hydration error (caused by browser extensions)
    const isHydrationError = 
      error.message?.includes('insertBefore') || 
      error.message?.includes('removeChild') ||
      error.message?.includes('hydrat');
    
    return { hasError: true, error, isHydrationError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.state.isHydrationError) {
      console.warn('Hydration error detected - this is often caused by browser extensions');
      // For hydration errors, reset after a short delay to allow re-render
      setTimeout(() => {
        this.setState({ hasError: false, isHydrationError: false });
      }, 100);
    }
  }

  render() {
    // For hydration errors, try to render children anyway
    if (this.state.isHydrationError) {
      return this.props.children;
    }
    
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">Please try refreshing the page.</p>
            <p className="text-xs text-gray-500">
              If the error persists, try disabling browser extensions.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
