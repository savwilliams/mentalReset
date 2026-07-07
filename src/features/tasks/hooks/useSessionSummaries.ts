import { useEffect, useState } from 'react';

import { getAllSessionSummaries } from '@/lib/db/repositories/sessionSummaryRepository';
import type { SessionSummary } from '@/types/session';

interface UseSessionSummariesResult {
  summaries: SessionSummary[];
  isLoading: boolean;
}

export function useSessionSummaries(): UseSessionSummariesResult {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getAllSessionSummaries()
      .then((records) => {
        if (!cancelled) {
          setSummaries(records);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { summaries, isLoading };
}
