import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** Prev/next pager for server-paginated lists (Phase 8). */
export function Pagination({ page, totalPages, onPageChange, disabled }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <nav className="flex items-center gap-2" aria-label="Pagination">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        <ChevronLeftIcon aria-hidden /> Previous
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums" aria-current="page">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Next <ChevronRightIcon aria-hidden />
      </Button>
    </nav>
  );
}
