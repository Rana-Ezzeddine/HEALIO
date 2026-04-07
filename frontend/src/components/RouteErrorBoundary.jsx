import React from "react";

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Something went wrong while loading this page.",
    };
  }

  componentDidCatch(error) {
    console.error("RouteErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 px-6 py-24">
          <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">This page could not load</h1>
            <p className="mt-3 text-sm text-slate-600">
              The medication page hit a runtime error. Refresh once after restarting the frontend dev server.
            </p>
            <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {this.state.message}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
