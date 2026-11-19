import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Top-level React Error Boundary — prevents a white screen of death
 * on unexpected runtime UI errors and provides graceful Arabic recovery actions.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'حدث خطأ غير متوقع في واجهة النظام.',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught UI Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans"
          dir="rtl"
        >
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <AlertTriangle size={28} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              واجهت الصفحة مشكلة تقنية مفاجئة. يمكنك إعادة تحميل الصفحة أو العودة إلى لوحة التحكم للمتابعة بأمان.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw size={16} />
                إعادة التحميل
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Home size={16} />
                الرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
