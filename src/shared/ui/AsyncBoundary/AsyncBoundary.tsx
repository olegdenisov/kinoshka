import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorState } from "../ErrorState";
import { Spinner } from "../Spinner";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function AsyncBoundary({
  children,
  fallback = <Spinner />,
}: Props) {
  return (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <ErrorState title="Something went wrong" description={error?.message || "Please try again later"} onRetry={reset} />
      )}
    >
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}