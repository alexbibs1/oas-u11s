import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function QueryError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-semibold text-destructive">
        {message ?? "Something went wrong"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Please check your connection and try again.
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
