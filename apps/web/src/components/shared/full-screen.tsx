import { RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function FullScreenLoading() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6"
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

export function FullScreenError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-sm font-medium text-destructive" role="alert">
        Something went wrong while loading your session.
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        <RotateCcwIcon /> Try again
      </Button>
    </div>
  );
}
