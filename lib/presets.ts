// Ready-made looks for the top of the settings page. A preset sets how the
// block looks, how a row is laid out, and what it lists; it leaves texts,
// behavior, and the colors and icons of each category alone, so one click
// never erases manual work.
import { DEFAULT_SETTINGS, type InboxSettings } from "./settings.ts";

export type PresetFields = Pick<
  InboxSettings,
  | "countDecision"
  | "countFailed"
  | "countDone"
  | "countWorking"
  | "showZeroCounts"
  | "counterStyle"
  | "showFailed"
  | "showDone"
  | "decisionsFirst"
  | "rowMarker"
  | "density"
  | "timeFormat"
  | "projectPlace"
  | "emptyState"
  | "separator"
  | "timePlace"
  | "titleWrap"
>;

export interface Preset {
  id: "minimal" | "default" | "detailed" | "loud";
  label: string;
  description: string;
  fields: PresetFields;
}

function presetFields(settings: InboxSettings): PresetFields {
  return {
    countDecision: settings.countDecision,
    countFailed: settings.countFailed,
    countDone: settings.countDone,
    countWorking: settings.countWorking,
    showZeroCounts: settings.showZeroCounts,
    counterStyle: settings.counterStyle,
    showFailed: settings.showFailed,
    showDone: settings.showDone,
    decisionsFirst: settings.decisionsFirst,
    rowMarker: settings.rowMarker,
    density: settings.density,
    timeFormat: settings.timeFormat,
    projectPlace: settings.projectPlace,
    emptyState: settings.emptyState,
    separator: settings.separator,
    timePlace: settings.timePlace,
    titleWrap: settings.titleWrap,
  };
}

export const PRESETS: Preset[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "One tight line per thread. Hidden when nothing needs you.",
    fields: {
      countDecision: true,
      countFailed: true,
      countDone: false,
      countWorking: false,
      showZeroCounts: false,
      counterStyle: "dot",
      showFailed: true,
      showDone: false,
      decisionsFirst: true,
      rowMarker: "dot",
      density: "compact",
      timeFormat: "off",
      projectPlace: "off",
      emptyState: "hidden",
      separator: false,
      timePlace: "end",
      titleWrap: "truncate",
    },
  },
  {
    id: "default",
    label: "Default",
    description: "Dots, time, and project. Says “All clear” when empty.",
    fields: presetFields(DEFAULT_SETTINGS),
  },
  {
    id: "detailed",
    label: "Detailed",
    description: "Icons, every counter, two-line rows.",
    fields: {
      countDecision: true,
      countFailed: true,
      countDone: true,
      countWorking: true,
      showZeroCounts: false,
      counterStyle: "icon",
      showFailed: true,
      showDone: true,
      decisionsFirst: true,
      rowMarker: "icon",
      density: "normal",
      timeFormat: "relative",
      projectPlace: "below",
      emptyState: "dots",
      separator: true,
      timePlace: "below",
      titleWrap: "truncate",
    },
  },
  {
    id: "loud",
    label: "Loud",
    description: "Tinted rows and pills. Hard to miss.",
    fields: {
      countDecision: true,
      countFailed: true,
      countDone: false,
      countWorking: true,
      showZeroCounts: true,
      counterStyle: "pill",
      showFailed: true,
      showDone: false,
      decisionsFirst: true,
      rowMarker: "tint",
      density: "normal",
      timeFormat: "clock",
      projectPlace: "inline",
      emptyState: "calm",
      separator: true,
      timePlace: "end",
      titleWrap: "truncate",
    },
  },
];

/** The preset the settings match exactly, or null for a custom mix. */
export function matchPreset(settings: InboxSettings): Preset | null {
  const current = presetFields(settings);
  return (
    PRESETS.find((preset) =>
      (Object.keys(preset.fields) as (keyof PresetFields)[]).every(
        (key) => preset.fields[key] === current[key],
      ),
    ) ?? null
  );
}
