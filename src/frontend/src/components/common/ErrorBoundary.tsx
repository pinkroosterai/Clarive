import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    resetError: () => void;
    eventId: string;
  }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId: eventId ?? null });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            resetError={this.resetError}
            eventId={this.state.eventId ?? ""}
          />
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="mx-auto max-w-md text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-foreground-muted">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            {this.state.eventId && (
              <p className="text-xs text-foreground-muted font-mono">
                Reference: {this.state.eventId.slice(0, 8)}
              </p>
            )}
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function PageErrorFallback({
  error,
  resetError,
  eventId,
}: {
  error: Error;
  resetError: () => void;
  eventId: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h2 className="text-lg font-semibold text-foreground">
        This page encountered an error
      </h2>
      <p className="text-sm text-foreground-muted max-w-sm">{error.message}</p>
      {eventId && (
        <p className="text-xs text-foreground-muted font-mono">
          Reference: {eventId.slice(0, 8)}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={resetError}>
          Try Again
        </Button>
        <Button asChild variant="outline">
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    </div>
  );
}
