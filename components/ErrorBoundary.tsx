import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-100 p-8">
          <div className="bg-white p-8 rounded-xl shadow-xl max-w-2xl w-full border border-red-100">
            <div className="flex items-center gap-4 mb-6">
               <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="text-red-600" size={32} />
               </div>
               <div>
                  <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
                  <p className="text-gray-500">The application encountered an unexpected error.</p>
               </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-auto max-h-64 mb-6 text-sm font-mono text-gray-700">
                <p className="font-bold text-red-600">{this.state.error?.message}</p>
                <pre className="whitespace-pre-wrap text-xs text-gray-500">
                    {this.state.errorInfo?.componentStack}
                </pre>
            </div>

            <button 
               onClick={() => window.location.reload()}
               className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all"
            >
               <RefreshCw size={20} />
               Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;