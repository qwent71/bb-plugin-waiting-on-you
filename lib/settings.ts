// The plugin's settings: shared type, option lists, defaults, a lenient
// parser, and migration from older versions. The server builds its zod
// schema from the same option lists, so the two can't drift; the app parses
// whatever arrives over RPC or realtime, so every field falls back to its
// default.

/** Realtime channel the server publishes the new settings on. */
export const SETTINGS_CHANGED = "settings-changed";

/** Thread categories the block knows. Each has its own color, icon, label. */
export const CATEGORIES = ["decision", "failed", "done", "working"] as const;
export type Category = (typeof CATEGORIES)[number];

export const COLORS = [
  "amber",
  "orange",
  "red",
  "rose",
  "violet",
  "sky",
  "emerald",
  "gray",
] as const;
export type ColorName = (typeof COLORS)[number];

/** bb's built-in icon names that read well as a status. */
export const ICONS = [
  "CircleQuestion",
  "MessageQuestion",
  "AlertTriangle",
  "AlertCircle",
  "CircleX",
  "CircleCheck",
  "Check",
  "Info",
  "Bot",
  "Loading",
  "Circle",
  "Star",
] as const;
export type IconName = (typeof ICONS)[number];

export const ROW_MARKERS = [
  "dot",
  "glyph",
  "icon",
  "stripe",
  "tint",
  "tag",
  "none",
] as const;
export type RowMarker = (typeof ROW_MARKERS)[number];

export const COUNTER_STYLES = ["dot", "glyph", "icon", "number", "pill"] as const;
export type CounterStyle = (typeof COUNTER_STYLES)[number];

export const DENSITIES = ["compact", "normal"] as const;
export type Density = (typeof DENSITIES)[number];

export const TIME_FORMATS = ["relative", "short", "clock", "off"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const PROJECT_PLACES = ["inline", "below", "off"] as const;
export type ProjectPlace = (typeof PROJECT_PLACES)[number];

export const SIDES = ["start", "end"] as const;
export type Side = (typeof SIDES)[number];

export const TAG_PLACES = ["title", "end"] as const;
export type TagPlace = (typeof TAG_PLACES)[number];

export const TIME_PLACES = ["end", "below"] as const;
export type TimePlace = (typeof TIME_PLACES)[number];

export const TITLE_WRAPS = ["truncate", "wrap"] as const;
export type TitleWrap = (typeof TITLE_WRAPS)[number];

export const COUNTER_PLACES = ["end", "title"] as const;
export type CounterPlace = (typeof COUNTER_PLACES)[number];

export const ALIGNS = ["start", "center"] as const;
export type Align = (typeof ALIGNS)[number];

/** Held with 1–9 to open that thread of the block; "off" turns it off. */
export const JUMP_MODIFIERS = [
  "off",
  "mod-alt",
  "mod-shift",
  "control",
  "control-alt",
  "alt",
] as const;
export type JumpModifier = (typeof JUMP_MODIFIERS)[number];

export const EMPTY_STATES = ["calm", "zero", "dots", "hidden"] as const;
export type EmptyState = (typeof EMPTY_STATES)[number];

/** Row limits offered in settings; 0 means no limit. */
export const MAX_ITEMS_OPTIONS = [0, 3, 5, 8, 10] as const;
export const MAX_ITEMS_LIMIT = 50;

export const OVERFLOW_STYLES = ["more", "hidden"] as const;
export type OverflowStyle = (typeof OVERFLOW_STYLES)[number];
export interface CategoryLook {
  color: ColorName;
  icon: IconName;
  /** Short word for row tags: "reply", "error". */
  label: string;
}

export const LABEL_MAX = 16;
export const TEXT_MAX = 40;

export interface InboxSettings {
  // Header
  title: string;
  /** Which counters the header shows, one switch each. */
  countDecision: boolean;
  countFailed: boolean;
  countDone: boolean;
  countWorking: boolean;
  /** Show a counter at 0, or hide it until there is something to count. */
  showZeroCounts: boolean;
  counterStyle: CounterStyle;
  /** Counters at the right edge, or right after the title. */
  counterPlace: CounterPlace;
  // What the list holds
  showFailed: boolean;
  showDone: boolean;
  decisionsFirst: boolean;
  // Rows
  rowMarker: RowMarker;
  density: Density;
  timeFormat: TimeFormat;
  projectPlace: ProjectPlace;
  // Row layout
  /** Dot, icon, or bb status before the title, or at the right. */
  markerSide: Side;
  /** A tag right after the title, or at the right. */
  tagPlace: TagPlace;
  /** Time at the right, or on a second line under the title. */
  timePlace: TimePlace;
  /** Give the time a fixed-width column so everything at the right lines up. */
  alignColumns: boolean;
  /** Long titles: cut with an ellipsis, or wrap onto two lines. */
  titleWrap: TitleWrap;
  // Categories
  categories: Record<Category, CategoryLook>;
  // Empty state
  emptyState: EmptyState;
  calmText: string;
  /** The empty-state line on the left, or centered. */
  emptyAlign: Align;
  /** Divider under the empty-state line, separate from the list's. */
  emptySeparator: boolean;
  // Size and place
  /** Divider under the block while it lists threads. */
  separator: boolean;
  maxHeight: number;
  /** Rows shown before the rest is cut; 0 shows every row. */
  maxItems: number;
  /** What the cut rows turn into: a "+N more" row, or nothing. */
  overflow: OverflowStyle;
  // Behavior
  /** List only threads of the project in view (all projects when none is). */
  currentProjectOnly: boolean;
  /** Clicking the header folds the list away; counters stay visible. */
  collapsible: boolean;
  /** Key pills while ⌘ is held, if bb's own hints are on too. */
  keyHints: boolean;
  /** The keys held with 1–9 to open the block's threads by number. */
  jumpModifier: JumpModifier;
}

export const DEFAULT_CATEGORIES: Record<Category, CategoryLook> = {
  decision: { color: "amber", icon: "CircleQuestion", label: "reply" },
  failed: { color: "red", icon: "CircleX", label: "error" },
  done: { color: "sky", icon: "CircleCheck", label: "done" },
  working: { color: "emerald", icon: "Loading", label: "working" },
};

export const DEFAULT_SETTINGS: InboxSettings = {
  title: "Needs you",
  countDecision: true,
  countFailed: true,
  countDone: false,
  countWorking: false,
  showZeroCounts: false,
  counterStyle: "dot",
  counterPlace: "end",
  showFailed: true,
  showDone: false,
  decisionsFirst: true,
  rowMarker: "dot",
  density: "normal",
  timeFormat: "relative",
  projectPlace: "inline",
  markerSide: "start",
  tagPlace: "end",
  timePlace: "end",
  alignColumns: true,
  titleWrap: "truncate",
  categories: DEFAULT_CATEGORIES,
  emptyState: "calm",
  calmText: "All clear",
  emptyAlign: "start",
  emptySeparator: true,
  separator: true,
  maxHeight: 40,
  maxItems: 0,
  overflow: "more",
  currentProjectOnly: false,
  collapsible: true,
  keyHints: true,
  jumpModifier: "mod-alt",
};

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function text(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" &&
    value.trim() !== "" &&
    value.trim().length <= max
    ? value.trim()
    : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseCategory(value: unknown, fallback: CategoryLook): CategoryLook {
  const v = record(value);
  return {
    color: pick(v.color, COLORS, fallback.color),
    icon: pick(v.icon, ICONS, fallback.icon),
    label: text(v.label, fallback.label, LABEL_MAX),
  };
}

export function parseSettings(values: unknown): InboxSettings {
  const v = record(values);
  const d = DEFAULT_SETTINGS;
  const categories = record(v.categories);
  const maxHeight =
    typeof v.maxHeight === "number" && Number.isFinite(v.maxHeight)
      ? Math.min(90, Math.max(10, Math.round(v.maxHeight)))
      : d.maxHeight;
  return {
    title: text(v.title, d.title, TEXT_MAX),
    countDecision: flag(v.countDecision, d.countDecision),
    countFailed: flag(v.countFailed, d.countFailed),
    countDone: flag(v.countDone, d.countDone),
    countWorking: flag(v.countWorking, d.countWorking),
    showZeroCounts: flag(v.showZeroCounts, d.showZeroCounts),
    counterStyle: pick(v.counterStyle, COUNTER_STYLES, d.counterStyle),
    counterPlace: pick(v.counterPlace, COUNTER_PLACES, d.counterPlace),
    showFailed: flag(v.showFailed, d.showFailed),
    showDone: flag(v.showDone, d.showDone),
    decisionsFirst: flag(v.decisionsFirst, d.decisionsFirst),
    rowMarker: pick(v.rowMarker, ROW_MARKERS, d.rowMarker),
    density: pick(v.density, DENSITIES, d.density),
    timeFormat: pick(v.timeFormat, TIME_FORMATS, d.timeFormat),
    projectPlace: pick(v.projectPlace, PROJECT_PLACES, d.projectPlace),
    markerSide: pick(v.markerSide, SIDES, d.markerSide),
    tagPlace: pick(v.tagPlace, TAG_PLACES, d.tagPlace),
    timePlace: pick(v.timePlace, TIME_PLACES, d.timePlace),
    alignColumns: flag(v.alignColumns, d.alignColumns),
    titleWrap: pick(v.titleWrap, TITLE_WRAPS, d.titleWrap),
    categories: {
      decision: parseCategory(categories.decision, d.categories.decision),
      failed: parseCategory(categories.failed, d.categories.failed),
      done: parseCategory(categories.done, d.categories.done),
      working: parseCategory(categories.working, d.categories.working),
    },
    emptyState: pick(v.emptyState, EMPTY_STATES, d.emptyState),
    calmText: text(v.calmText, d.calmText, TEXT_MAX),
    emptyAlign: pick(v.emptyAlign, ALIGNS, d.emptyAlign),
    emptySeparator: flag(v.emptySeparator, d.emptySeparator),
    separator: flag(v.separator, d.separator),
    maxHeight,
    maxItems:
      typeof v.maxItems === "number" &&
      Number.isInteger(v.maxItems) &&
      v.maxItems >= 0 &&
      v.maxItems <= MAX_ITEMS_LIMIT
        ? v.maxItems
        : d.maxItems,
    overflow: pick(v.overflow, OVERFLOW_STYLES, d.overflow),
    currentProjectOnly: flag(v.currentProjectOnly, d.currentProjectOnly),
    collapsible: flag(v.collapsible, d.collapsible),
    keyHints: flag(v.keyHints, d.keyHints),
    jumpModifier: pick(v.jumpModifier, JUMP_MODIFIERS, d.jumpModifier),
  };
}

/** A settings change: any top-level fields, and any fields of a category. */
export type SettingsPatch = Partial<Omit<InboxSettings, "categories">> & {
  categories?: Partial<Record<Category, Partial<CategoryLook>>>;
};

export function applyPatch(
  current: InboxSettings,
  patch: SettingsPatch,
): InboxSettings {
  const { categories: categoryPatch, ...rest } = patch;
  const categories = { ...current.categories };
  for (const category of CATEGORIES) {
    const change = categoryPatch?.[category];
    if (change !== undefined) {
      categories[category] = { ...categories[category], ...change };
    }
  }
  return { ...current, ...rest, categories };
}

/**
 * Maps settings saved by older versions onto the current fields. Current
 * fields win when both are present.
 */
export function migrateSettings(
  stored: Record<string, unknown>,
  { fillMissing = true }: { fillMissing?: boolean } = {},
) {
  const next: Record<string, unknown> = { ...stored };
  // One switch for every counter, plus a separate working badge.
  if (stored.headerCounts === false) {
    next.countDecision ??= false;
    next.countFailed ??= false;
  }
  if (typeof stored.showWorking === "boolean") {
    next.countWorking ??= stored.showWorking;
  }
  // rowStyle + showStatusGlyph became one row marker.
  if (next.rowMarker === undefined) {
    if (stored.showStatusGlyph === true && (stored.rowStyle ?? "dot") === "dot") {
      next.rowMarker = "glyph";
    } else if (typeof stored.rowStyle === "string") {
      next.rowMarker = stored.rowStyle;
    }
  }
  // The UI went from Russian to English: untouched Russian defaults follow,
  // while text the user typed stays as it is.
  if (stored.calmText === "Нигде не нужны") delete next.calmText;
  const categories = record(stored.categories);
  const oldLabels: Record<string, string> = {
    decision: "ответ",
    failed: "ошибка",
    done: "готово",
    working: "работает",
  };
  if (Object.keys(categories).length > 0) {
    const relabeled: Record<string, unknown> = {};
    for (const [category, look] of Object.entries(categories)) {
      const fields = { ...record(look) };
      if (fields.label === oldLabels[category]) delete fields.label;
      relabeled[category] = fields;
    }
    next.categories = relabeled;
  }
  // One divider became two: the empty state starts from the list's choice.
  if (
    fillMissing &&
    stored.emptySeparator === undefined &&
    typeof stored.separator === "boolean"
  ) {
    next.emptySeparator = stored.separator;
  }
  // On/off switches became formats with an "off" choice.
  if (stored.showTime === false) next.timeFormat ??= "off";
  if (stored.showProject === false) next.projectPlace ??= "off";
  for (const old of [
    "headerCounts",
    "showWorking",
    "rowStyle",
    "showStatusGlyph",
    "showTime",
    "showProject",
  ]) {
    delete next[old];
  }
  return next;
}

/** Marks an exported file so an import can tell it apart from other JSON. */
export const EXPORT_FORMAT = "bb-plugin-waiting-on-you/settings";
export const EXPORT_VERSION = 1;

export interface SettingsExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  settings: InboxSettings;
}

export function exportDocument(settings: InboxSettings): SettingsExport {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, settings };
}

/**
 * What an import file holds: an exported document, or a bare settings
 * object (whole or partial) someone wrote by hand.
 */
export function unwrapImport(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.format === EXPORT_FORMAT || "settings" in value) {
    const inner = record(value.settings);
    return Object.keys(inner).length === 0 ? null : inner;
  }
  return value;
}

/** How a row's lines are arranged, read from the detailed layout settings. */
export type RowLayout = "one-line" | "two-lines" | "custom";

export function rowLayoutOf(settings: InboxSettings): RowLayout {
  // Wrapped titles make the line count depend on the title; call it custom.
  if (settings.titleWrap !== "truncate") return "custom";
  const secondLine =
    settings.timePlace === "below" || settings.projectPlace === "below";
  return secondLine ? "two-lines" : "one-line";
}

/** The detailed settings behind a row layout; keeps a hidden project hidden. */
export function rowLayoutPatch(
  layout: Exclude<RowLayout, "custom">,
  settings: InboxSettings,
): Partial<InboxSettings> {
  const projectOff = settings.projectPlace === "off";
  return layout === "one-line"
    ? {
        timePlace: "end",
        projectPlace: projectOff ? "off" : "inline",
        titleWrap: "truncate",
      }
    : {
        timePlace: "below",
        projectPlace: projectOff ? "off" : "below",
        titleWrap: "truncate",
      };
}
