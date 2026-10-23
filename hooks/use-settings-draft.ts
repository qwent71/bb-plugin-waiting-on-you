// The settings page edits a draft: previews follow it at once, the sidebar
// only after Save. The draft survives leaving the page (sessionStorage), so
// unsaved work is never lost to a click elsewhere.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPatch,
  parseSettings,
  type InboxSettings,
  type SettingsPatch,
} from "@/lib/settings";

/** Dotted paths of every setting that differs, e.g. "categories.failed.color". */
export function changedPaths(a: InboxSettings, b: InboxSettings): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(a) as (keyof InboxSettings)[]) {
    if (key === "categories") {
      for (const category of Object.keys(a.categories) as (keyof InboxSettings["categories"])[]) {
        for (const field of Object.keys(a.categories[category]) as (keyof InboxSettings["categories"]["decision"])[]) {
          if (a.categories[category][field] !== b.categories[category][field]) {
            paths.push(`categories.${category}.${field}`);
          }
        }
      }
    } else if (a[key] !== b[key]) {
      paths.push(key);
    }
  }
  return paths;
}

export function useSettingsDraft(
  storageKey: string,
  saved: InboxSettings,
  save: (next: InboxSettings) => Promise<InboxSettings>,
) {
  const [draft, setDraft] = useState<InboxSettings | null>(() => {
    const stored = window.sessionStorage.getItem(storageKey);
    return stored === null ? null : parseSettings(JSON.parse(stored));
  });
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    if (draft === null) window.sessionStorage.removeItem(storageKey);
    else window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey]);

  const current = draft ?? saved;
  const changes = useMemo(
    () => (draft === null ? [] : changedPaths(draft, saved)),
    [draft, saved],
  );
  const dirty = changes.length > 0;

  const edit = useCallback((patch: SettingsPatch) => {
    setDraft((previous) => applyPatch(previous ?? savedRef.current, patch));
  }, []);
  const replace = useCallback((next: InboxSettings) => setDraft(next), []);
  const discard = useCallback(() => setDraft(null), []);
  const commit = useCallback(async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      await save(draft);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }, [draft, save]);

  return { current, dirty, changes, saving, edit, replace, discard, commit };
}
