// Data hooks shared by the sidebar block and the settings page.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRealtime,
  useRpc,
  useSdk,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "@/server";
import {
  applyPatch,
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_CHANGED,
  type InboxSettings,
  type SettingsPatch,
} from "@/lib/settings";

/** Re-render once a minute so "5 min. ago" stays honest. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The plugin settings, live across windows. `update` applies a change at
 * once and rolls it back if the server refuses it.
 */
export function useInboxSettings() {
  const rpc = useRpc<typeof rpcContract>();
  const [settings, setSettings] = useState<InboxSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    rpc.call("settings_get").then(
      (next) => {
        setSettings(parseSettings(next));
        setIsLoaded(true);
        setError(null);
      },
      (cause: unknown) => setError(messageOf(cause)),
    );
  }, [rpc]);
  useEffect(refetch, [refetch]);
  useRealtime(SETTINGS_CHANGED, (payload) => {
    // Our own writes echo back here too; the queue on the server keeps them
    // in order, so the last echo is the current state.
    setSettings(parseSettings(payload));
    setIsLoaded(true);
  });

  // Only the newest answer may replace the optimistic state; an older one
  // arriving late would flip a just-made change back.
  const latest = useRef(0);
  const update = useCallback(
    (patch: SettingsPatch) => {
      const request = ++latest.current;
      setSettings((current) => applyPatch(current, patch));
      rpc.call("settings_update", patch).then(
        (next) => {
          if (request !== latest.current) return;
          setSettings(parseSettings(next));
          setError(null);
        },
        (cause: unknown) => {
          setError(messageOf(cause));
          refetch();
        },
      );
    },
    [rpc, refetch],
  );
  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    rpc.call("settings_reset").then(
      (next) => setSettings(parseSettings(next)),
      (cause: unknown) => {
        setError(messageOf(cause));
        refetch();
      },
    );
  }, [rpc, refetch]);

  /** Writes a whole set of settings and resolves once the server has it. */
  const save = useCallback(
    async (next: InboxSettings) => {
      const request = ++latest.current;
      const result = await rpc.call("settings_update", next);
      if (request === latest.current) setSettings(parseSettings(result));
      setError(null);
      return parseSettings(result);
    },
    [rpc],
  );

  /** Applies an import; the result lists what was taken and skipped. */
  const importJson = useCallback(
    async (raw: unknown) => {
      const result = await rpc.call("settings_import", raw);
      setSettings(parseSettings(result.settings));
      setError(null);
      return result;
    },
    [rpc],
  );

  return { settings, isLoaded, error, update, reset, save, importJson };
}

/**
 * When each waiting thread asked its question. bb's `latestAttentionAt` only
 * moves on status changes, and a thread stays "active" while it waits on an
 * answer, so the question's own `createdAt` is the honest time.
 */
export function useQuestionTimes(
  threads: readonly PluginSidebarThread[],
): ReadonlyMap<string, number> {
  const sdk = useSdk();
  const [times, setTimes] = useState<ReadonlyMap<string, number>>(new Map());
  // Refetch when the set of waiting threads changes or one of them moves.
  const key = threads.map((thread) => `${thread.id}:${thread.updatedAt}`).join();
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  useEffect(() => {
    const ids = threadsRef.current.map((thread) => thread.id);
    if (ids.length === 0) {
      setTimes(new Map());
      return;
    }
    const controller = new AbortController();
    Promise.all(
      ids.map(async (threadId) => {
        try {
          const pending = await sdk.threads.interactions.list({
            threadId,
            signal: controller.signal,
          });
          const earliest = Math.min(...pending.map((item) => item.createdAt));
          return Number.isFinite(earliest) ? ([threadId, earliest] as const) : null;
        } catch {
          return null; // Fall back to latestAttentionAt for this row.
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setTimes(
        new Map(entries.filter((entry) => entry !== null)),
      );
    });
    return () => controller.abort();
  }, [sdk, key]);

  return times;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
