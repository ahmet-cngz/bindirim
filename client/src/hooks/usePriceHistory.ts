import { useCallback, useEffect, useState } from "react";
import { Observation } from "../types/models";
import { listAll } from "../utils/api";
import { errorMessage } from "../utils/watch";
import { useAuth } from "./useAuth";

export function usePriceHistory(
  watchId: number | undefined,
  lastChecked: string | null | undefined,
) {
  const { token } = useAuth();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    if (!watchId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    listAll<Observation>(`watches/${watchId}/history/`, token)
      .then((items) => {
        if (active) setObservations(items);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [watchId, lastChecked, token, attempt]);
  return { observations, loading, error, retry };
}
