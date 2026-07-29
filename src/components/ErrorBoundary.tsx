import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Application error:", error, info);
  }

  handleReload = () => {
    if ("caches" in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">
              The page couldn't load. This is often fixed by clearing the cache and reloading.
            </p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Reload and clear cache
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
