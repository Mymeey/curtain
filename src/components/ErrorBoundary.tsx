'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Check if it's a hydration error (caused by browser extensions)
    const isHydrationError = 
      error.message?.includes('insertBefore') || 
      error.message?.includes('removeChild') ||
      error.message?.includes('hydrat');
    
    if (isHydrationError) {
      console.warn('Hydration error detected - this is often caused by browser extensions');
      // Force reload on hydration error - cleanest recovery method
      if (typeof window !== 'undefined' && !sessionStorage.getItem('hydration_reload')) {
        sessionStorage.setItem('hydration_reload', 'true');
        window.location.reload();
        return;
      }
      // Clear the flag for next visit
      sessionStorage.removeItem('hydration_reload');
    }
  }

  render() {
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
              onClick={() => {
                sessionStorage.removeItem('hydration_reload');
                window.location.reload();
              }}
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
