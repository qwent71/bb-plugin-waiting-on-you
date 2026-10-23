// Quick picks for each settings group: a few ready-made answers to that
// group's question, so the detailed controls stay folded away until wanted.
// A pick sets only its own group's fields; matching is exact on those fields.
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  type Category,
  type CategoryLook,
  type InboxSettings,
  type SettingsPatch,
} from "./settings.ts";

export type GroupId = "header" | "listed" | "rows" | "colors" | "empty" | "size";

export interface GroupPreset {
  id: string;
  label: string;
  /** One short line for the button's tooltip. */
  hint: string;
  patch: SettingsPatch;
}

/** The fields each group owns; a pick and its match look at these only. */
export const GROUP_FIELDS: Record<Exclude<GroupId, "colors">, (keyof InboxSettings)[]> = {
  header: [
    "countDecision",
    "countFailed",
    "countDone",
    "countWorking",
    "showZeroCounts",
    "counterStyle",
    "counterPlace",
  ],
  listed: ["showFailed", "showDone", "decisionsFirst"],
  rows: [
    "rowMarker",
    "density",
    "timeFormat",
    "projectPlace",
    "markerSide",
    "tagPlace",
    "timePlace",
    "alignColumns",
    "titleWrap",
  ],
  empty: ["emptyState", "emptyAlign", "emptySeparator"],
  size: ["separator", "maxItems", "overflow", "maxHeight"],
};

const pick = (keys: (keyof InboxSettings)[]) =>
  Object.fromEntries(keys.map((key) => [key, DEFAULT_SETTINGS[key]])) as Partial<InboxSettings>;

const looks = (
  colors: Record<Category, CategoryLook["color"]>,
  icons?: Partial<Record<Category, CategoryLook["icon"]>>,
): SettingsPatch => ({
  categories: Object.fromEntries(
    (Object.keys(colors) as Category[]).map((category) => [
      category,
      {
        color: colors[category],
        icon: icons?.[category] ?? DEFAULT_CATEGORIES[category].icon,
      },
    ]),
  ) as SettingsPatch["categories"],
});

export const GROUP_PRESETS: Record<GroupId, GroupPreset[]> = {
  header: [
    {
      id: "counts",
      label: "Dots",
      hint: "Waiting and failed counts with a colored dot.",
      patch: pick(GROUP_FIELDS.header),
    },
    {
      id: "icons",
      label: "Icons",
      hint: "Every count, each with its icon.",
      patch: {
        countDecision: true,
        countFailed: true,
        countDone: true,
        countWorking: true,
        showZeroCounts: false,
        counterStyle: "icon",
        counterPlace: "end",
      },
    },
    {
      id: "pills",
      label: "Pills",
      hint: "Tinted pills, zeros included, so nothing jumps.",
      patch: {
        countDecision: true,
        countFailed: true,
        countDone: false,
        countWorking: true,
        showZeroCounts: true,
        counterStyle: "pill",
        counterPlace: "end",
      },
    },
    {
      id: "total",
      label: "Just a total",
      hint: "One plain number next to the title.",
      patch: {
        countDecision: false,
        countFailed: false,
        countDone: false,
        countWorking: false,
        showZeroCounts: false,
        counterStyle: "dot",
        counterPlace: "title",
      },
    },
  ],
  listed: [
    {
      id: "questions",
      label: "Questions only",
      hint: "Only threads waiting on your reply.",
      patch: { showFailed: false, showDone: false, decisionsFirst: true },
    },
    {
      id: "default",
      label: "Questions & failures",
      hint: "Waiting on you, then threads that failed.",
      patch: pick(GROUP_FIELDS.listed),
    },
    {
      id: "everything",
      label: "Everything",
      hint: "Also finished threads you haven't opened.",
      patch: { showFailed: true, showDone: true, decisionsFirst: true },
    },
    {
      id: "by-time",
      label: "By time",
      hint: "Everything, newest first, whatever the kind.",
      patch: { showFailed: true, showDone: true, decisionsFirst: false },
    },
  ],
  rows: [
    {
      id: "compact",
      label: "Compact",
      hint: "Tight single lines: dot, title, short time.",
      patch: {
        rowMarker: "dot",
        density: "compact",
        timeFormat: "short",
        projectPlace: "off",
        markerSide: "start",
        tagPlace: "end",
        timePlace: "end",
        alignColumns: true,
        titleWrap: "truncate",
      },
    },
    {
      id: "standard",
      label: "Standard",
      hint: "One line with project and time.",
      patch: pick(GROUP_FIELDS.rows),
    },
    {
      id: "detailed",
      label: "Detailed",
      hint: "Icons, with project and time on a second line.",
      patch: {
        rowMarker: "icon",
        density: "normal",
        timeFormat: "relative",
        projectPlace: "below",
        markerSide: "start",
        tagPlace: "end",
        timePlace: "below",
        alignColumns: true,
        titleWrap: "truncate",
      },
    },
    {
      id: "tags",
      label: "Tags",
      hint: "A word tag per kind, in a straight column.",
      patch: {
        rowMarker: "tag",
        density: "normal",
        timeFormat: "short",
        projectPlace: "inline",
        markerSide: "start",
        tagPlace: "end",
        timePlace: "end",
        alignColumns: true,
        titleWrap: "truncate",
      },
    },
    {
      id: "tinted",
      label: "Tinted",
      hint: "Colored rows with the clock time.",
      patch: {
        rowMarker: "tint",
        density: "normal",
        timeFormat: "clock",
        projectPlace: "inline",
        markerSide: "start",
        tagPlace: "end",
        timePlace: "end",
        alignColumns: true,
        titleWrap: "truncate",
      },
    },
  ],
  colors: [
    {
      id: "classic",
      label: "Classic",
      hint: "Amber, red, sky, and green.",
      patch: looks({ decision: "amber", failed: "red", done: "sky", working: "emerald" }),
    },
    {
      id: "vivid",
      label: "Vivid",
      hint: "Orange, rose, violet, and green.",
      patch: looks({ decision: "orange", failed: "rose", done: "violet", working: "emerald" }),
    },
    {
      id: "cool",
      label: "Cool",
      hint: "Sky, violet, green, and grey.",
      patch: looks({ decision: "sky", failed: "violet", done: "emerald", working: "gray" }),
    },
    {
      id: "mono",
      label: "Mono",
      hint: "All grey; the icons tell kinds apart.",
      patch: looks(
        { decision: "gray", failed: "gray", done: "gray", working: "gray" },
        { decision: "MessageQuestion", failed: "AlertTriangle", done: "Check", working: "Loading" },
      ),
    },
  ],
  empty: [
    {
      id: "clear",
      label: "All clear",
      hint: "A quiet check mark and a line.",
      patch: pick(GROUP_FIELDS.empty),
    },
    {
      id: "zero",
      label: "Zero",
      hint: "The title with a 0.",
      patch: { emptyState: "zero", emptyAlign: "start", emptySeparator: true },
    },
    {
      id: "counters",
      label: "Grey counters",
      hint: "The counters, greyed out at 0.",
      patch: { emptyState: "dots", emptyAlign: "start", emptySeparator: true },
    },
    {
      id: "hidden",
      label: "Hidden",
      hint: "No block at all when nothing needs you.",
      patch: { emptyState: "hidden", emptyAlign: "start", emptySeparator: false },
    },
  ],
  size: [
    {
      id: "all",
      label: "Show all",
      hint: "Every row, up to 40% of the window.",
      patch: pick(GROUP_FIELDS.size),
    },
    {
      id: "top5",
      label: "Top 5",
      hint: "Five rows, then “+N more”.",
      patch: { separator: true, maxItems: 5, overflow: "more", maxHeight: 40 },
    },
    {
      id: "top3",
      label: "Top 3",
      hint: "Three rows, then “+N more”.",
      patch: { separator: true, maxItems: 3, overflow: "more", maxHeight: 40 },
    },
    {
      id: "tight",
      label: "Tight",
      hint: "Three rows, the rest hidden, at most a quarter of the window.",
      patch: { separator: false, maxItems: 3, overflow: "hidden", maxHeight: 25 },
    },
  ],
};

/** The quick pick the group's settings match exactly, or null for custom. */
export function matchGroupPreset(group: GroupId, settings: InboxSettings): GroupPreset | null {
  return (
    GROUP_PRESETS[group].find((preset) => {
      const { categories, ...fields } = preset.patch;
      const fieldsMatch = (Object.keys(fields) as (keyof InboxSettings)[]).every(
        (key) => settings[key] === (fields as Partial<InboxSettings>)[key],
      );
      const categoriesMatch =
        categories === undefined ||
        (Object.keys(categories) as Category[]).every((category) => {
          const look = categories[category] ?? {};
          return (Object.keys(look) as (keyof CategoryLook)[]).every(
            (field) => settings.categories[category][field] === look[field],
          );
        });
      return fieldsMatch && categoriesMatch;
    }) ?? null
  );
}
