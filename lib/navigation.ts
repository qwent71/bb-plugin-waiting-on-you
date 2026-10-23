// Opening a page of bb's own settings in place. The SDK navigates to threads,
// projects, and plugin panels, not to bb's settings pages, and a plain link
// would reload the whole app. bb's router follows the browser history, so a
// pushed entry plus a popstate event moves it there like any in-app link.

export type BbSettingsSection = "keyboard" | "appearance" | "general";

export function bbSettingsHref(section: BbSettingsSection): string {
  return `/settings/${section}`;
}

export function openBbSettings(section: BbSettingsSection): void {
  const href = bbSettingsHref(section);
  if (window.location.pathname === href) return;
  window.history.pushState(window.history.state, "", href);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}
