// bb-plugin-waiting-on-you — backend entry. The block reads threads from the sidebar's
// live view in app.tsx. The server only keeps the plugin's settings.
//
// Settings live in plugin storage rather than bb.settings: bb renders its
// declarative form above every plugin section, and the settings page needs
// the live preview on top. A realtime signal keeps every open window current.
import {
  cliCommand,
  defineCli,
  defineRpcContract,
  PluginCliError,
  type BbPluginApi,
} from "@get-bb/plugin-sdk";
import { z } from "zod";
import {
  ALIGNS,
  applyPatch,
  COLORS,
  COUNTER_PLACES,
  COUNTER_STYLES,
  DEFAULT_SETTINGS,
  DENSITIES,
  EMPTY_STATES,
  ICONS,
  JUMP_MODIFIERS,
  LABEL_MAX,
  MAX_ITEMS_LIMIT,
  migrateSettings,
  OVERFLOW_STYLES,
  parseSettings,
  PROJECT_PLACES,
  ROW_MARKERS,
  SETTINGS_CHANGED,
  SIDES,
  TAG_PLACES,
  TEXT_MAX,
  TIME_FORMATS,
  TIME_PLACES,
  TITLE_WRAPS,
  exportDocument,
  unwrapImport,
  type InboxSettings,
  type SettingsPatch,
} from "./lib/settings";

const shortText = (max: number) => z.string().trim().min(1).max(max);

const categorySchema = z.object({
  color: z.enum(COLORS),
  icon: z.enum(ICONS),
  label: shortText(LABEL_MAX),
});

const categoriesSchema = z.object({
  decision: categorySchema,
  failed: categorySchema,
  done: categorySchema,
  working: categorySchema,
});

export const settingsSchema = z.object({
  title: shortText(TEXT_MAX),
  countDecision: z.boolean(),
  countFailed: z.boolean(),
  countDone: z.boolean(),
  countWorking: z.boolean(),
  showZeroCounts: z.boolean(),
  counterStyle: z.enum(COUNTER_STYLES),
  counterPlace: z.enum(COUNTER_PLACES),
  showFailed: z.boolean(),
  showDone: z.boolean(),
  decisionsFirst: z.boolean(),
  rowMarker: z.enum(ROW_MARKERS),
  density: z.enum(DENSITIES),
  timeFormat: z.enum(TIME_FORMATS),
  projectPlace: z.enum(PROJECT_PLACES),
  markerSide: z.enum(SIDES),
  tagPlace: z.enum(TAG_PLACES),
  timePlace: z.enum(TIME_PLACES),
  alignColumns: z.boolean(),
  titleWrap: z.enum(TITLE_WRAPS),
  categories: categoriesSchema,
  emptyState: z.enum(EMPTY_STATES),
  calmText: shortText(TEXT_MAX),
  emptyAlign: z.enum(ALIGNS),
  emptySeparator: z.boolean(),
  separator: z.boolean(),
  maxHeight: z.number().int().min(10).max(90),
  maxItems: z.number().int().min(0).max(MAX_ITEMS_LIMIT),
  overflow: z.enum(OVERFLOW_STYLES),
  currentProjectOnly: z.boolean(),
  collapsible: z.boolean(),
  keyHints: z.boolean(),
  jumpModifier: z.enum(JUMP_MODIFIERS),
});
// Compile-time check that the schema and the shared type agree.
const _schemaMatchesType: z.ZodType<InboxSettings> = settingsSchema;
void _schemaMatchesType;

const patchSchema = settingsSchema.omit({ categories: true }).partial().extend({
  categories: z
    .object({
      decision: categorySchema.partial(),
      failed: categorySchema.partial(),
      done: categorySchema.partial(),
      working: categorySchema.partial(),
    })
    .partial()
    .optional(),
});

const importResultSchema = z.object({
  settings: settingsSchema,
  /** Fields the import set. */
  applied: z.array(z.string()),
  /** Fields it ignored, as dotted paths: unknown, or not a valid value. */
  skipped: z.array(z.string()),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export const rpcContract = defineRpcContract({
  settings_get: {
    input: z.null(),
    output: settingsSchema,
  },
  settings_update: {
    input: patchSchema,
    output: settingsSchema,
  },
  settings_reset: {
    input: z.null(),
    output: settingsSchema,
  },
  settings_import: {
    // Anything parsed from a file; the handler sorts good fields from bad.
    input: z.unknown(),
    output: importResultSchema,
  },
});

type TopLevelField = Exclude<keyof typeof settingsSchema.shape, "categories">;
type CategoryField = keyof typeof categorySchema.shape;

/**
 * Turns an imported object into a settings patch, field by field: a valid
 * value is taken, anything else is listed as skipped. Older formats are
 * migrated first, like stored settings.
 */
function importPatch(raw: unknown): {
  patch: SettingsPatch;
  applied: string[];
  skipped: string[];
} {
  const unwrapped = unwrapImport(raw);
  if (unwrapped === null) return { patch: {}, applied: [], skipped: ["(file)"] };
  // An import changes only what the file lists, so it skips the migration
  // step that fills a missing field from another one.
  const source = migrateSettings(unwrapped, { fillMissing: false });
  const patch: Record<string, unknown> = {};
  const categories: Record<string, Record<string, unknown>> = {};
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (key === "categories") {
      const given =
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      if (given === null) {
        skipped.push("categories");
        continue;
      }
      for (const [category, look] of Object.entries(given)) {
        if (!(category in categoriesSchema.shape)) {
          skipped.push(`categories.${category}`);
          continue;
        }
        const fields =
          look !== null && typeof look === "object" && !Array.isArray(look)
            ? (look as Record<string, unknown>)
            : null;
        if (fields === null) {
          skipped.push(`categories.${category}`);
          continue;
        }
        for (const [field, fieldValue] of Object.entries(fields)) {
          const path = `categories.${category}.${field}`;
          const schema = categorySchema.shape[field as CategoryField];
          const parsed = schema?.safeParse(fieldValue);
          if (parsed?.success) {
            (categories[category] ??= {})[field] = parsed.data;
            applied.push(path);
          } else {
            skipped.push(path);
          }
        }
      }
      continue;
    }
    const schema = settingsSchema.shape[key as TopLevelField];
    const parsed = schema?.safeParse(value);
    if (parsed?.success) {
      patch[key] = parsed.data;
      applied.push(key);
    } else {
      skipped.push(key);
    }
  }
  if (Object.keys(categories).length > 0) patch.categories = categories;
  return { patch: patch as SettingsPatch, applied, skipped };
}

const SETTINGS_KEY = "settings";

export default async function plugin(bb: BbPluginApi) {
  async function readSettings(): Promise<InboxSettings> {
    const stored = await bb.storage.kv.get<unknown>(SETTINGS_KEY);
    // parseSettings falls back field by field, so a value from an older
    // version, or one that no longer validates, resets alone.
    const current =
      stored !== null && typeof stored === "object" && !Array.isArray(stored)
        ? migrateSettings(stored as Record<string, unknown>)
        : {};
    return parseSettings(current);
  }

  async function writeSettings(next: InboxSettings): Promise<InboxSettings> {
    const valid = settingsSchema.parse(next);
    await bb.storage.kv.set(SETTINGS_KEY, valid);
    bb.realtime.publish(SETTINGS_CHANGED, valid);
    return valid;
  }

  /** Applies the valid part of an import on top of the current settings. */
  async function importSettings(raw: unknown): Promise<ImportResult> {
    const { patch, applied, skipped } = importPatch(raw);
    const current = await readSettings();
    const settings =
      applied.length === 0 ? current : await writeSettings(applyPatch(current, patch));
    return { settings, applied, skipped };
  }

  // Every change reads, merges, and writes. Two quick clicks must not both
  // read the same old value, or the second write drops the first change, so
  // changes run one at a time.
  let queue: Promise<unknown> = Promise.resolve();
  function serially<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  bb.rpc.register(rpcContract, {
    settings_get: () => readSettings(),
    settings_update: (patch) =>
      serially(async () => writeSettings(applyPatch(await readSettings(), patch))),
    settings_reset: () => serially(() => writeSettings(DEFAULT_SETTINGS)),
    settings_import: (raw) => serially(() => importSettings(raw)),
  });

  // `bb waiting-on-you …`: the same import and export from a terminal. run executes on
  // the bb server, so JSON travels as text, never as a path on some disk.
  bb.cli.register(
    defineCli({
      name: "waiting-on-you",
      summary: "Export, import, or reset the Waiting On You plugin's settings",
      commands: {
        export: cliCommand({
          summary: "Print the settings as JSON (redirect it to a file to keep it)",
          options: {},
          async run() {
            const document = exportDocument(await readSettings());
            return { exitCode: 0, stdout: `${JSON.stringify(document, null, 2)}\n` };
          },
        }),
        import: cliCommand({
          summary:
            'Apply settings from JSON, whole or partial: bb waiting-on-you import --json "$(cat waiting-on-you.json)"',
          options: {
            json: {
              type: "string",
              required: true,
              description:
                "The settings as JSON text: an exported file or any subset of its fields",
            },
          },
          async run(input) {
            let parsed: unknown;
            try {
              parsed = JSON.parse(input.options.json);
            } catch (cause) {
              throw new PluginCliError(
                `not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
                {
                  code: "invalid_json",
                  hint: 'Pass the file contents: bb waiting-on-you import --json "$(cat waiting-on-you.json)"',
                },
              );
            }
            const result = await serially(() => importSettings(parsed));
            if (result.applied.length === 0) {
              throw new PluginCliError("nothing to import", {
                code: "nothing_imported",
                hint:
                  result.skipped.length === 0
                    ? "The JSON holds no settings."
                    : `Skipped: ${result.skipped.join(", ")}`,
              });
            }
            const lines = [`Imported ${result.applied.length} setting(s).`];
            if (result.skipped.length > 0) {
              lines.push(`Skipped: ${result.skipped.join(", ")}`);
            }
            return { exitCode: 0, stdout: `${lines.join("\n")}\n` };
          },
        }),
        reset: cliCommand({
          summary: "Put every setting back to its default",
          options: {},
          async run() {
            await serially(() => writeSettings(DEFAULT_SETTINGS));
            return { exitCode: 0, stdout: "Settings reset to defaults.\n" };
          },
        }),
      },
    }),
  );

  bb.log.info("loaded");
}
