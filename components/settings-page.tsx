// The plugin's settings page: a live preview on top, grouped controls below.
// Each group has one live sample of the part of the block it changes; option
// buttons only carry a small mark of what they pick. Every sample is the real
// InboxBlock, so none of them can drift from the sidebar.
// Changes collect in a draft until Save; then they reach the sidebar in
// every window.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CATEGORY_NAMES,
  CategoryMark,
  InboxBlock,
  PALETTE,
} from "@/components/inbox-block";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  experimental_copyToClipboard as copyToClipboard,
  experimental_saveFile as saveFile,
  experimental_usePluginId as usePluginId,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { ImportResult } from "@/server";
import { useInboxSettings, useNow } from "@/hooks/use-inbox";
import { isMac, useCommandHints } from "@/hooks/use-keyboard-hints";
import { useSettingsDraft } from "@/hooks/use-settings-draft";
import { formatKeys, jumpKeys, type HeldKeys } from "@/lib/shortcuts";
import { bbSettingsHref, openBbSettings } from "@/lib/navigation";
import type { InboxView } from "@/lib/inbox";
import { emptySampleView, SAMPLE_PROJECTS, sampleView } from "@/lib/sample";
import { matchPreset, PRESETS } from "@/lib/presets";
import { GROUP_PRESETS, matchGroupPreset, type GroupId } from "@/lib/group-presets";
import {
  CATEGORIES,
  COLORS,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  exportDocument,
  rowLayoutOf,
  rowLayoutPatch,
  ICONS,
  JUMP_MODIFIERS,
  LABEL_MAX,
  MAX_ITEMS_OPTIONS,
  TEXT_MAX,
  type Align,
  type Category,
  type CategoryLook,
  type CounterPlace,
  type ColorName,
  type CounterStyle,
  type Density,
  type EmptyState,
  type InboxSettings,
  type JumpModifier,
  type OverflowStyle,
  type ProjectPlace,
  type RowMarker,
  type SettingsPatch,
  type Side,
  type TagPlace,
  type TimeFormat,
  type TimePlace,
  type TitleWrap,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

const NO_QUESTION_TIMES: ReadonlyMap<string, number> = new Map();

const ROW_MARKER_OPTIONS: { value: RowMarker; label: string }[] = [
  { value: "dot", label: "Dot" },
  { value: "glyph", label: "bb status" },
  { value: "icon", label: "Icon" },
  { value: "stripe", label: "Stripe" },
  { value: "tint", label: "Tint" },
  { value: "tag", label: "Tag" },
  { value: "none", label: "None" },
];

const COUNTER_STYLE_OPTIONS: { value: CounterStyle; label: string }[] = [
  { value: "dot", label: "Dot" },
  { value: "glyph", label: "bb status" },
  { value: "icon", label: "Icon" },
  { value: "number", label: "Number only" },
  { value: "pill", label: "Pill" },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Comfortable" },
];

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: "relative", label: "5 min. ago" },
  { value: "short", label: "5m" },
  { value: "clock", label: "14:32" },
  { value: "off", label: "Hidden" },
];

const PROJECT_OPTIONS: { value: ProjectPlace; label: string }[] = [
  { value: "inline", label: "After the title" },
  { value: "below", label: "Under the title" },
  { value: "off", label: "Hidden" },
];

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: "start", label: "Left" },
  { value: "end", label: "Right" },
];

const TAG_PLACE_OPTIONS: { value: TagPlace; label: string }[] = [
  { value: "title", label: "After the title" },
  { value: "end", label: "Right side" },
];

const TIME_PLACE_OPTIONS: { value: TimePlace; label: string }[] = [
  { value: "end", label: "Right side" },
  { value: "below", label: "Under the title" },
];

const TITLE_WRAP_OPTIONS: { value: TitleWrap; label: string }[] = [
  { value: "truncate", label: "Cut off" },
  { value: "wrap", label: "Wrap to two lines" },
];

const COUNTER_PLACE_OPTIONS: { value: CounterPlace; label: string }[] = [
  { value: "end", label: "Right edge" },
  { value: "title", label: "After the title" },
];

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "start", label: "Left" },
  { value: "center", label: "Center" },
];

const EMPTY_STATE_OPTIONS: { value: EmptyState; label: string }[] = [
  { value: "calm", label: "Message" },
  { value: "zero", label: "Zero" },
  { value: "dots", label: "Grey counters" },
  { value: "hidden", label: "Hide the block" },
];

const COLOR_NAMES: Record<ColorName, string> = {
  amber: "Amber",
  orange: "Orange",
  red: "Red",
  rose: "Rose",
  violet: "Violet",
  sky: "Sky",
  emerald: "Green",
  gray: "Grey",
};

const MAX_HEIGHT_OPTIONS = [25, 40, 60, 80];

const OVERFLOW_OPTIONS: { value: OverflowStyle; label: string }[] = [
  { value: "more", label: "Show “+N more”" },
  { value: "hidden", label: "Hide the rest" },
];

type Update = (patch: SettingsPatch) => void;

/** Sample data every mini preview on the page draws from. */
interface Samples {
  settings: InboxSettings;
  now: number;
  busy: InboxView;
  empty: InboxView;
  /** One question. */
  question: InboxView;
}

function useSamples(settings: InboxSettings): Samples {
  const now = useNow();
  return useMemo(() => {
    const busy = sampleView(now);
    const none = { decision: [], failed: [], done: [] };
    return {
      settings,
      now,
      busy,
      empty: emptySampleView(now),
      question: { ...busy, ...none, decision: busy.decision.slice(0, 1) },
    };
  }, [settings, now]);
}

export function SettingsPage() {
  const {
    settings: saved,
    isLoaded,
    error,
    save,
    importJson,
  } = useInboxSettings();
  const pluginId = usePluginId();
  const commandHints = useCommandHints(pluginId, true);
  // Every control edits the draft; the sidebar changes only on Save.
  const draft = useSettingsDraft(`bb-plugin-${pluginId}:settings-draft`, saved, save);
  const settings = draft.current;
  const update = draft.edit;
  const reset = () => draft.replace(DEFAULT_SETTINGS);
  const customRef = useRef<HTMLDivElement>(null);
  const samples = useSamples(settings);
  const { busy, empty } = samples;
  // Option buttons draw their mark in the "Waiting on you" look.
  const decisionLook = settings.categories.decision;
  const { rowMarker } = settings;
  const rowLayout = rowLayoutOf(settings);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <PreviewFrame caption="When you're needed">
          <Sample samples={samples} view={busy} />
        </PreviewFrame>
        <PreviewFrame caption="When all is clear">
          <Sample samples={samples} view={empty} />
        </PreviewFrame>
      </div>

      {error === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          Couldn't save: {error}
        </p>
      )}

      <fieldset
        disabled={!isLoaded}
        className="m-0 min-w-0 space-y-6 border-0 p-0"
      >
        <StyleGroup
          settings={settings}
          update={update}
          onCustomize={() =>
            customRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />

        <div ref={customRef} className="scroll-mt-4 border-t border-border pt-5">
          <h3 className="text-sm font-medium text-foreground">Custom</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each part of the block has quick picks; “Fine-tune” opens every
            detail. Any change here switches the style above to Custom.
          </p>
        </div>

        <Group
          title="Header"
          quick={{ group: "header", settings, update }}
          description="The top line of the block: a title and counters."
          preview={<Sample samples={samples} view={busy} part="header" />}
        >
          <Row label="Title">
            <TextSetting
              value={settings.title}
              onCommit={(title) => update({ title })}
            />
          </Row>
          <CountersRow settings={settings} update={update} />
          <Row label="Counter style" wide>
            <Segmented
              value={settings.counterStyle}
              options={COUNTER_STYLE_OPTIONS.map((option) => ({
                ...option,
                visual: <CounterVisual style={option.value} look={decisionLook} />,
              }))}
              onChange={(counterStyle) => update({ counterStyle })}
            />
          </Row>
          <Row label="Counters position" wide>
            <Segmented
              value={settings.counterPlace}
              options={COUNTER_PLACE_OPTIONS}
              onChange={(counterPlace) => update({ counterPlace })}
            />
          </Row>
          <ToggleRow
            settings={settings}
            update={update}
            field="showZeroCounts"
            label="Show zeros"
            description="Off: a counter appears only when there's something to count."
          />
        </Group>

        <Group
          title="What's listed"
          quick={{ group: "listed", settings, update }}
          description="Threads waiting on your reply are always listed."
          preview={<Sample samples={samples} view={busy} part="rows" />}
        >
          <ToggleRow
            settings={settings}
            update={update}
            field="showFailed"
            label="Failed threads"
            description="An error you haven't seen yet."
          />
          <ToggleRow
            settings={settings}
            update={update}
            field="showDone"
            label="Done, unseen"
            description="The agent finished and you haven't opened the thread."
          />
          <ToggleRow
            settings={settings}
            update={update}
            field="decisionsFirst"
            label="Replies first"
            description="Threads waiting on you go on top. Off: everything by time, newest first."
          />
        </Group>

        <Group
          title="Rows"
          quick={{ group: "rows", settings, update }}
          description="How each thread in the list looks."
          preview={
            <Sample
              samples={samples}
              view={busy}
              part="rows"
              overrides={{ showFailed: true, showDone: true }}
            />
          }
        >
          <Row
            label="Row layout"
            description={
              rowLayout === "custom"
                ? "Long titles wrap, so a row can take more lines. Change it under Layout below."
                : rowLayout === "one-line"
                  ? "Everything on one line: time at the right, project after the title."
                  : "A second line under the title, for the time (and the project, if shown). Fine-tune it under Layout."
            }
            wide
          >
            <Segmented
              value={rowLayout}
              options={[
                { value: "one-line", label: "One line", visual: <LinesVisual lines={1} /> },
                { value: "two-lines", label: "Two lines", visual: <LinesVisual lines={2} /> },
              ]}
              onChange={(layout) => {
                if (layout !== "custom") update(rowLayoutPatch(layout, settings));
              }}
            />
          </Row>
          <SubHeading title="Content" description="What a row shows." />
          <Row
            label="Marker"
            description="What tells the kinds of thread apart. Colors and icons are set in “Colors & icons”; bb status uses bb's own colors."
            wide
          >
            <Segmented
              value={settings.rowMarker}
              options={ROW_MARKER_OPTIONS.map((option) => ({
                ...option,
                visual: <MarkerVisual marker={option.value} look={decisionLook} />,
              }))}
              onChange={(rowMarker) => update({ rowMarker })}
            />
          </Row>
          <Row label="Density" wide>
            <Segmented
              value={settings.density}
              options={DENSITY_OPTIONS}
              onChange={(density) => update({ density })}
            />
          </Row>
          <Row
            label="Time"
            description="For a question, when it was asked; otherwise, when the thread failed or finished."
            wide
          >
            <Segmented
              value={settings.timeFormat}
              options={TIME_OPTIONS}
              onChange={(timeFormat) => update({ timeFormat })}
            />
          </Row>
          <Row label="Project name" wide>
            <Segmented
              value={settings.projectPlace}
              options={PROJECT_OPTIONS}
              onChange={(projectPlace) => update({ projectPlace })}
            />
          </Row>
          <SubHeading
            title="Layout"
            description="Where each part of a row sits, and how the right side lines up."
          />
          {rowMarker === "dot" || rowMarker === "glyph" || rowMarker === "icon" ? (
            <Row label="Marker side" wide>
              <Segmented
                value={settings.markerSide}
                options={SIDE_OPTIONS}
                onChange={(markerSide) => update({ markerSide })}
              />
            </Row>
          ) : null}
          {rowMarker === "tag" ? (
            <Row label="Tag position" wide>
              <Segmented
                value={settings.tagPlace}
                options={TAG_PLACE_OPTIONS}
                onChange={(tagPlace) => update({ tagPlace })}
              />
            </Row>
          ) : null}
          {settings.timeFormat === "off" ? null : (
            <Row label="Time position" wide>
              <Segmented
                value={settings.timePlace}
                options={TIME_PLACE_OPTIONS}
                onChange={(timePlace) => update({ timePlace })}
              />
            </Row>
          )}
          <ToggleRow
            settings={settings}
            update={update}
            field="alignColumns"
            label="Align right side"
            description="The time gets a fixed width, so tags and times stand in straight columns."
          />
          <Row label="Long titles" wide>
            <Segmented
              value={settings.titleWrap}
              options={TITLE_WRAP_OPTIONS}
              onChange={(titleWrap) => update({ titleWrap })}
            />
          </Row>
        </Group>

        <Group
          title="Colors & icons"
          quick={{ group: "colors", settings, update }}
          description="One look per kind of thread, shared by markers, counters, and tags."
          preview={
            <Sample
              samples={samples}
              view={busy}
              overrides={{
                showFailed: true,
                showDone: true,
                countDecision: true,
                countFailed: true,
                countDone: true,
                countWorking: true,
                separator: false,
              }}
            />
          }
        >
          {CATEGORIES.map((category) => (
            <CategoryEditor
              key={category}
              category={category}
              settings={settings}
              update={update}
            />
          ))}
          <div className="px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => update({ categories: DEFAULT_CATEGORIES })}
            >
              Reset colors & icons
            </Button>
          </div>
        </Group>

        <Group
          title="Empty state"
          quick={{ group: "empty", settings, update }}
          description="Nothing is waiting on you and nothing failed."
          preview={
            settings.emptyState === "hidden" ? (
              <span className="block px-2 py-1 text-xs italic text-muted-foreground">
                no block
              </span>
            ) : (
              <div className="-mx-1">
                <Sample samples={samples} view={empty} />
                <OrdinaryRows titles={["Another thread"]} />
              </div>
            )
          }
        >
          <Row label="Show" wide>
            <Segmented
              value={settings.emptyState}
              options={EMPTY_STATE_OPTIONS.map((option) => ({
                ...option,
                visual: <EmptyVisual state={option.value} />,
              }))}
              onChange={(emptyState) => update({ emptyState })}
            />
          </Row>
          {settings.emptyState === "hidden" ? null : (
            <Row label="Alignment" wide>
              <Segmented
                value={settings.emptyAlign}
                options={ALIGN_OPTIONS}
                onChange={(emptyAlign) => update({ emptyAlign })}
              />
            </Row>
          )}
          {settings.emptyState === "calm" ? (
            <Row label="Message">
              <TextSetting
                value={settings.calmText}
                onCommit={(calmText) => update({ calmText })}
              />
            </Row>
          ) : null}
          {settings.emptyState === "hidden" ? null : (
            <ToggleRow
              settings={settings}
              update={update}
              field="emptySeparator"
              label="Divider"
              description="A line under the empty state. Set apart from the list's divider."
            />
          )}
        </Group>

        <Group
          title="Behavior"
          description="Where the block looks and how you get around it."
        >
          <ToggleRow
            settings={settings}
            update={update}
            field="currentProjectOnly"
            label="Current project only"
            description="List only threads of the project you have open. With no project open, every project shows."
          />
          <ToggleRow
            settings={settings}
            update={update}
            field="collapsible"
            label="Fold on header click"
            description="Click the title to hide the list; the counters stay. The fold is remembered per window."
          />
          <ToggleRow
            settings={settings}
            update={update}
            field="keyHints"
            label="Key hints"
            description="While ⌘ is held, keys show on the block like on bb's own rows. Also follows bb's “Show keyboard hints”."
          />
          <Row
            label="Jump to a thread"
            description="Hold these keys and press 1–9 to open that thread of the block. The numbers show on the rows while they're held."
            wide
          >
            <div className="space-y-1.5">
              <Segmented
                value={settings.jumpModifier}
                options={JUMP_MODIFIERS.map((modifier) => ({
                  value: modifier,
                  label: jumpLabel(modifier),
                }))}
                onChange={(jumpModifier) => update({ jumpModifier })}
              />
              <JumpConflict
                modifier={settings.jumpModifier}
                takenBy={commandHints.takenBy}
              />
            </div>
          </Row>
          <Row
            label="Next thread that needs you"
            description="Opens the block's threads one after another."
          >
            <ShortcutLabel label={commandHints.nextThread} />
          </Row>
          <Row
            label="Show or hide the list"
            description="Folds the list like a click on the title."
          >
            <ShortcutLabel label={commandHints.toggleList} />
          </Row>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Change these keys in bb's keyboard settings: search for “Waiting On You”.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a
                href={bbSettingsHref("keyboard")}
                onClick={(event) => {
                  // Keep middle-click and ⌘-click as plain links.
                  if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
                  event.preventDefault();
                  openBbSettings("keyboard");
                }}
              >
                Open keyboard settings
                <Icon name="ExternalLink" aria-hidden className="size-3.5" />
              </a>
            </Button>
          </div>
        </Group>

        <Group
          title="Size & placement"
          quick={{ group: "size", settings, update }}
          description="How much of the sidebar the list takes."
          preview={
            <div className="-mx-1">
              <Sample
                samples={samples}
                view={busy}
                overrides={{ showFailed: true, showDone: true }}
              />
              <OrdinaryRows titles={["Another thread"]} />
            </div>
          }
        >
          <ToggleRow
            settings={settings}
            update={update}
            field="separator"
            label="Divider"
            description="A line between the list and the threads below it."
          />
          <Row
            label="Max rows"
            description="Rows shown before the list is cut. The shortcut still visits every thread."
            wide
          >
            <Segmented
              value={settings.maxItems}
              options={MAX_ITEMS_OPTIONS.map((value) => ({
                value: value as number,
                label: value === 0 ? "All" : String(value),
              }))}
              onChange={(maxItems) => update({ maxItems })}
            />
          </Row>
          {settings.maxItems === 0 ? null : (
            <Row
              label="When there are more"
              description="“+N more” opens the rest in place. Hidden rows still count in the header."
              wide
            >
              <Segmented
                value={settings.overflow}
                options={OVERFLOW_OPTIONS}
                onChange={(overflow) => update({ overflow })}
              />
            </Row>
          )}
          <Row
            label="Max height"
            description="Share of the window. Past it, the block scrolls on its own and the list below stays put."
            wide
          >
            <Segmented
              value={settings.maxHeight}
              options={withCurrent(settings.maxHeight).map((value) => ({
                value,
                label: `${value}%`,
              }))}
              onChange={(maxHeight) => update({ maxHeight })}
            />
          </Row>
        </Group>

        <ImportExportGroup
          settings={saved}
          importJson={importJson}
          blocked={draft.dirty}
        />

        <div>
          <Button variant="outline" size="sm" type="button" onClick={reset}>
            Reset all settings
          </Button>
        </div>
      </fieldset>

      <SaveBar
        changes={draft.changes.length}
        saving={draft.saving}
        onSave={() => {
          draft.commit().then(
            () => toast.success("Settings saved"),
            (cause: unknown) =>
              toast.error(
                `Couldn't save: ${cause instanceof Error ? cause.message : String(cause)}`,
              ),
          );
        }}
        onDiscard={draft.discard}
      />
    </div>
  );
}

/**
 * Pinned to the bottom of the page while there are unsaved changes, so it
 * stays in reach wherever the page is scrolled. ⌘S saves too.
 */
function SaveBar({
  changes,
  saving,
  onSave,
  onDiscard,
}: {
  changes: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const visible = changes > 0;
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = isMac() ? event.metaKey : event.ctrlKey;
      if (mod && !event.shiftKey && !event.altKey && event.code === "KeyS") {
        event.preventDefault();
        if (!saving) onSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, saving, onSave]);

  return (
    // A zero-height sticky anchor: the bar floats above the page bottom and
    // takes no room while hidden.
    <div className="pointer-events-none sticky bottom-4 z-20 h-0">
      <div
        aria-hidden={!visible}
        className={cn(
          "absolute inset-x-0 bottom-0 flex justify-center transition-all duration-200",
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
      <div
        role="region"
        aria-label="Unsaved changes"
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-popover py-2 pl-4 pr-2 text-sm text-popover-foreground shadow-lg",
          visible && "pointer-events-auto",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber-500" />
          <span className="font-medium">Unsaved changes</span>
          <span className="text-muted-foreground">
            · {changes} setting{changes === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={!visible || saving}
            onClick={onDiscard}
          >
            Discard
          </Button>
          <Button
            size="sm"
            type="button"
            disabled={!visible || saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
            <kbd className="rounded border border-background/30 px-1 font-sans text-[10px] leading-4 opacity-70">
              {isMac() ? "⌘S" : "Ctrl+S"}
            </kbd>
          </Button>
        </span>
      </div>
      </div>
    </div>
  );
}

const EXPORT_FILE_NAME = "waiting-on-you-settings.json";

/** Copy or save the settings as JSON, and bring JSON back in. */
function ImportExportGroup({
  settings,
  importJson,
  blocked,
}: {
  settings: InboxSettings;
  importJson: (raw: unknown) => Promise<ImportResult>;
  /** Unsaved edits on the page; an import would write over them. */
  blocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { kind: "ok" | "error"; message: string; detail?: string } | null
  >(null);
  const json = () => `${JSON.stringify(exportDocument(settings), null, 2)}\n`;

  const copy = async () => {
    const copied = await copyToClipboard({ text: json() });
    if (copied) toast.success("Settings copied as JSON");
    else toast.error("Couldn't copy to the clipboard");
  };
  const save = () => {
    void saveFile({
      fileName: EXPORT_FILE_NAME,
      blob: new Blob([json()], { type: "application/json" }),
    });
  };
  const pickFile = async (file: File | undefined) => {
    if (file === undefined) return;
    setText(await file.text());
    setResult(null);
  };
  const runImport = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      setResult({
        kind: "error",
        message: "That isn't valid JSON.",
        detail: cause instanceof Error ? cause.message : undefined,
      });
      return;
    }
    setBusy(true);
    try {
      const outcome = await importJson(parsed);
      if (outcome.applied.length === 0) {
        setResult({
          kind: "error",
          message: "Nothing to import.",
          detail:
            outcome.skipped.length === 0
              ? "The JSON holds no settings."
              : `Skipped: ${outcome.skipped.join(", ")}`,
        });
        return;
      }
      setResult({
        kind: "ok",
        message: `Imported ${outcome.applied.length} setting${outcome.applied.length === 1 ? "" : "s"}.`,
        detail:
          outcome.skipped.length === 0
            ? undefined
            : `Skipped: ${outcome.skipped.join(", ")}`,
      });
      setText("");
    } catch (cause) {
      setResult({
        kind: "error",
        message: "Couldn't import.",
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group
      title="Import & export"
      description="Keep your setup as a JSON file, or move it to another machine."
    >
      <Row
        label="Export"
        description="Every saved setting, including colors, icons, and texts."
      >
        <span className="flex gap-1.5">
          <Button variant="outline" size="sm" type="button" onClick={copy}>
            Copy JSON
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={save}>
            Save file
          </Button>
        </span>
      </Row>
      <Row
        label="Import"
        description={
          blocked
            ? "Save or discard your changes first; an import is applied right away."
            : "Paste JSON or pick a file. A partial file changes only what it lists; unknown or invalid fields are skipped."
        }
      >
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={blocked}
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            setResult(null);
          }}
        >
          {open ? "Close" : "Import…"}
        </Button>
      </Row>
      {open ? (
        <div className="space-y-2 px-4 py-3">
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setResult(null);
            }}
            spellCheck={false}
            placeholder={'{ "rowMarker": "icon", "maxItems": 5 }'}
            aria-label="Settings JSON"
            className="block h-36 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              type="button"
              disabled={blocked || busy || text.trim() === ""}
              onClick={runImport}
            >
              Import
            </Button>
            <Button variant="outline" size="sm" type="button" asChild>
              <label className="cursor-pointer">
                Choose file…
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => {
                    void pickFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
          {result === null ? null : (
            <div
              role={result.kind === "error" ? "alert" : "status"}
              className={cn(
                "text-xs",
                result.kind === "error" ? "text-destructive" : "text-foreground",
              )}
            >
              <p>{result.message}</p>
              {result.detail === undefined ? null : (
                <p className="mt-0.5 break-words text-muted-foreground">
                  {result.detail}
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
      <div className="px-4 py-3 text-xs text-muted-foreground">
        From a terminal:{" "}
        <code className="font-mono">bb waiting-on-you export &gt; waiting-on-you.json</code> and{" "}
        <code className="font-mono">
          bb waiting-on-you import --json "$(cat waiting-on-you.json)"
        </code>
      </div>
    </Group>
  );
}

/** "⌥⌘ 1–9" for a jump setting; "Off" when it is off. */
function jumpLabel(modifier: JumpModifier): string {
  const keys = jumpKeys(modifier, isMac());
  return keys === null ? "Off" : `${formatKeys(keys, isMac())}1–9`;
}

/** Warns when bb already binds the chosen keys plus a digit. */
function JumpConflict({
  modifier,
  takenBy,
}: {
  modifier: JumpModifier;
  takenBy: (keys: HeldKeys) => string | null;
}) {
  const keys = jumpKeys(modifier, isMac());
  if (keys === null) return null;
  if (modifier === "mod-shift" && isMac()) {
    return (
      <p role="alert" className="text-xs text-destructive">
        macOS keeps ⇧⌘3, ⇧⌘4, and ⇧⌘5 for screenshots, so threads 3–5 won't open
        with these keys.
      </p>
    );
  }
  const command = takenBy(keys);
  if (command === null) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      bb already uses {formatKeys(keys, isMac())}+digit for “{command}”. Pick other
      keys, or the two will clash.
    </p>
  );
}

function ShortcutLabel({ label }: { label: string | null }) {
  return label === null ? (
    <span className="text-xs text-muted-foreground">No key</span>
  ) : (
    <kbd className="rounded-md border border-border bg-state-hover px-2 py-1 font-sans text-xs font-medium text-foreground">
      {label}
    </kbd>
  );
}

/**
 * Ready-made looks, plus "Custom" for a hand-tuned mix. The big preview above
 * already shows the result, so the cards only name and describe a look.
 * "Custom" jumps to the detailed settings.
 */
function StyleGroup({
  settings,
  update,
  onCustomize,
}: {
  settings: InboxSettings;
  update: Update;
  onCustomize: () => void;
}) {
  const active = matchPreset(settings);
  const cards = [
    ...PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: preset.description,
      selected: active?.id === preset.id,
      onSelect: () => update(preset.fields),
      icon: null as string | null,
    })),
    {
      id: "custom",
      label: "Custom",
      description:
        active === null
          ? "Your own mix. Tune it below."
          : "Fine-tune every detail below.",
      selected: active === null,
      onSelect: onCustomize,
      icon: "ChevronDown",
    },
  ];
  return (
    <section>
      <h3 className="text-sm font-medium text-foreground">Style</h3>
      <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
        Pick a look, row layout included, or go custom. Texts, colors, and
        icons stay yours.
      </p>
      <div
        role="radiogroup"
        aria-label="Style"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={card.selected}
            onClick={card.onSelect}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
              card.selected
                ? "border-foreground ring-1 ring-foreground"
                : "border-border hover:border-muted-foreground",
            )}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
              {card.label}
              {card.icon === null ? null : (
                <Icon
                  name={card.icon}
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {card.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The real block on sample data, with some settings swapped. */
function Sample({
  samples,
  view,
  part = "all",
  overrides,
}: {
  samples: Samples;
  view: InboxView;
  part?: "all" | "header" | "rows";
  overrides?: Partial<InboxSettings>;
}) {
  return (
    <InboxBlock
      settings={{ ...samples.settings, ...overrides }}
      view={view}
      questionTimes={NO_QUESTION_TIMES}
      projectNames={SAMPLE_PROJECTS}
      activeThreadId={null}
      now={samples.now}
      part={part}
      preview
    />
  );
}

/** Keeps an older custom height selectable instead of silently hiding it. */
function withCurrent(current: number): number[] {
  return MAX_HEIGHT_OPTIONS.includes(current)
    ? MAX_HEIGHT_OPTIONS
    : [...MAX_HEIGHT_OPTIONS, current].sort((a, b) => a - b);
}

function OrdinaryRows({ titles }: { titles: string[] }) {
  return (
    <div className="mx-2 space-y-px opacity-50" aria-hidden>
      {titles.map((title) => (
        <div
          key={title}
          className="flex items-center gap-2 rounded-md px-2.5 py-1 text-sm"
        >
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          {title}
        </div>
      ))}
    </div>
  );
}

/** A sidebar-width box with a couple of ordinary rows under the block. */
function PreviewFrame({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="m-0 w-72 max-w-full">
      <figcaption className="mb-1.5 text-xs text-muted-foreground">
        {caption}
      </figcaption>
      <div className="rounded-lg border border-border bg-sidebar py-2 text-sidebar-foreground">
        {children}
        <OrdinaryRows titles={["Another thread", "One more thread"]} />
      </div>
    </figure>
  );
}

/** A small sidebar-colored box; decorative, so it never takes clicks. */
function MiniFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none select-none overflow-hidden rounded-md border border-border bg-sidebar px-1 py-1 text-sidebar-foreground [&>div]:pt-0.5 [&>span]:pt-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A settings group. `preview` is the one live sample of the part of the block
 * these settings change. With `quick`, a row of ready-made picks sits under
 * it and the detailed controls fold away under "Fine-tune"; they open on
 * their own while the group is a custom mix.
 */
function Group({
  title,
  description,
  preview,
  quick,
  children,
}: {
  title: string;
  description?: string;
  preview?: ReactNode;
  quick?: { group: GroupId; settings: InboxSettings; update: Update };
  children: ReactNode;
}) {
  const active = quick === undefined ? null : matchGroupPreset(quick.group, quick.settings);
  const pluginId = usePluginId();
  const storageKey = quick === undefined ? null : `bb-plugin-${pluginId}:fine-tune:${quick.group}`;
  const [openByUser, setOpenByUser] = useState<boolean | null>(() => {
    if (storageKey === null) return null;
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? null : stored === "1";
  });
  // Closed by default; a custom mix opens it so the changes are in view.
  const open = quick === undefined || (openByUser ?? active === null);
  const toggle = () => {
    const next = !open;
    setOpenByUser(next);
    if (storageKey !== null) window.localStorage.setItem(storageKey, next ? "1" : "0");
  };

  return (
    <section>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description === undefined ? (
        <div className="mb-2" />
      ) : (
        <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {preview === undefined ? null : (
          <div className="flex items-center gap-4 bg-state-hover/50 px-4 py-3">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              Preview
            </span>
            <MiniFrame className="w-72 max-w-full">{preview}</MiniFrame>
          </div>
        )}
        {quick === undefined ? null : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div
              role="radiogroup"
              aria-label={`${title} quick picks`}
              className="flex flex-wrap gap-1.5"
            >
              {GROUP_PRESETS[quick.group].map((preset) => {
                const selected = active?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={preset.hint}
                    onClick={() => quick.update(preset.patch)}
                    className={cn(
                      "h-7 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
              {active === null ? (
                <span className="flex h-7 items-center rounded-full border border-dashed border-foreground/40 px-3 text-xs font-medium text-foreground">
                  Custom
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="ml-auto flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Fine-tune
              <Icon
                name={open ? "ChevronDown" : "ChevronRight"}
                aria-hidden
                className="size-3.5"
              />
            </button>
          </div>
        )}
        {open ? children : null}
      </div>
    </section>
  );
}

function Row({
  label,
  description,
  htmlFor,
  wide = false,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  /** Let the control take the width it needs (a row of chips). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <label htmlFor={htmlFor} className="block text-sm text-foreground">
          {label}
        </label>
        {description === undefined ? null : (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className={cn("flex shrink-0", wide ? "basis-full" : "min-w-48 justify-end")}>
        {children}
      </div>
    </div>
  );
}

type BooleanField = {
  [K in keyof InboxSettings]: InboxSettings[K] extends boolean ? K : never;
}[keyof InboxSettings];

/** A quiet label that splits a group into parts. */
function SubHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="bg-state-hover/30 px-4 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {description === undefined ? null : (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** A switch; the label toggles it too. */
function ToggleRow({
  settings,
  update,
  field,
  label,
  description,
}: {
  settings: InboxSettings;
  update: Update;
  field: BooleanField;
  label: string;
  description?: string;
}) {
  const id = useId();
  const checked = settings[field];
  return (
    <Row
      label={label}
      description={description}
      htmlFor={id}
    >
      <span className="flex items-center gap-2">
        <span className="w-8 text-right text-xs text-muted-foreground">
          {checked ? "On" : "Off"}
        </span>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => update({ [field]: !checked })}
          className={cn(
            "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-foreground" : "bg-input",
          )}
        >
          <span
            className={cn(
              "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
              checked ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </button>
      </span>
    </Row>
  );
}

const COUNTER_FIELDS: Record<Category, BooleanField> = {
  decision: "countDecision",
  failed: "countFailed",
  done: "countDone",
  working: "countWorking",
};

/** One chip per counter, drawn in its category's look; each switches alone. */
function CountersRow({
  settings,
  update,
}: {
  settings: InboxSettings;
  update: Update;
}) {
  return (
    <Row
      label="Counters"
      description="Which numbers sit next to the title."
      wide
    >
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((category) => {
          const field = COUNTER_FIELDS[category];
          const on = settings[field];
          return (
            <button
              key={category}
              type="button"
              aria-pressed={on}
              onClick={() => update({ [field]: !on })}
              className={cn(
                "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
                on
                  ? "border-foreground/30 bg-state-active text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <CategoryMark
                category={category}
                look={settings.categories[category]}
                mode={settings.counterStyle === "icon" ? "icon" : "dot"}
                muted={!on}
              />
              {CATEGORY_NAMES[category]}
            </button>
          );
        })}
      </div>
    </Row>
  );
}

/** "CircleQuestion" → "Circle question", for tooltips. */
function iconName(icon: string): string {
  const words = icon.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Color swatches, an icon grid, and a label for one category. */
function CategoryEditor({
  category,
  settings,
  update,
}: {
  category: Category;
  settings: InboxSettings;
  update: Update;
}) {
  const look = settings.categories[category];
  const set = (change: Partial<typeof look>) =>
    update({ categories: { [category]: change } });

  return (
    <div className="space-y-3 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CategoryMark category={category} look={look} mode="icon" />
        {CATEGORY_NAMES[category]}
        {category === "working" ? (
          <span className="text-xs font-normal text-muted-foreground">
            counter only
          </span>
        ) : null}
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Color</p>
          <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
            {COLORS.map((color) => {
              const selected = look.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={COLOR_NAMES[color]}
                  title={COLOR_NAMES[color]}
                  onClick={() => set({ color })}
                  className={cn(
                    "flex size-6 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "ring-2 ring-foreground",
                  )}
                >
                  <span className={cn("size-4 rounded-full", PALETTE[color].solid)} />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Icon</p>
          <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1">
            {ICONS.map((icon) => {
              const selected = look.icon === icon;
              return (
                <button
                  key={icon}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={iconName(icon)}
                  title={iconName(icon)}
                  onClick={() => set({ icon })}
                  className={cn(
                    "flex size-7 cursor-pointer items-center justify-center rounded-md border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected
                      ? "border-foreground bg-state-active"
                      : "border-border hover:border-muted-foreground",
                  )}
                >
                  <Icon name={icon} className={cn("size-4", PALETTE[look.color].text)} />
                </button>
              );
            })}
          </div>
        </div>
        {category === "working" ? null : (
        <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Tag label</p>
            <TextSetting
              value={look.label}
              max={LABEL_MAX}
              className="w-32"
              onCommit={(label) => set({ label })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** The marker a row-marker option adds, drawn small for its button. */
function MarkerVisual({ marker, look }: { marker: RowMarker; look: CategoryLook }) {
  const swatch = PALETTE[look.color];
  switch (marker) {
    case "dot":
    case "glyph":
    case "icon":
      return <CategoryMark category="decision" look={look} mode={marker} />;
    case "stripe":
      return <span className={cn("h-3 w-0.5 rounded-full", swatch.solid)} />;
    case "tint":
      return <span className={cn("h-3 w-4 rounded-sm", swatch.soft)} />;
    case "tag":
      return (
        <span
          className={cn(
            "rounded-full px-1 text-[9px] font-semibold leading-3",
            swatch.soft,
            swatch.text,
          )}
        >
          {look.label}
        </span>
      );
    case "none":
      return null;
  }
}

/** A counter in the given style, drawn small for its button. */
function CounterVisual({ style, look }: { style: CounterStyle; look: CategoryLook }) {
  const swatch = PALETTE[look.color];
  if (style === "number") {
    return <span className={cn("font-semibold tabular-nums", swatch.text)}>2</span>;
  }
  if (style === "pill") {
    return (
      <span
        className={cn(
          "rounded-full px-1.5 font-semibold leading-4 tabular-nums",
          swatch.soft,
          swatch.text,
        )}
      >
        2
      </span>
    );
  }
  return <CategoryMark category="decision" look={look} mode={style} />;
}

/** A tiny row sketch: one line, or a title over a shorter second line. */
function LinesVisual({ lines }: { lines: 1 | 2 }) {
  return (
    <span className="flex w-5 flex-col gap-0.5">
      <span className="flex items-center gap-0.5">
        <span className="h-0.5 flex-1 rounded-full bg-current" />
        {lines === 1 ? <span className="h-0.5 w-1.5 rounded-full bg-current opacity-50" /> : null}
      </span>
      {lines === 2 ? <span className="h-0.5 w-3 rounded-full bg-current opacity-50" /> : null}
    </span>
  );
}

function EmptyVisual({ state }: { state: EmptyState }) {
  if (state === "calm") return <span className="text-emerald-500">✓</span>;
  if (state === "zero") return <span className="tabular-nums">0</span>;
  if (state === "dots") {
    return <span className="size-1.5 rounded-full bg-muted-foreground opacity-60" />;
  }
  return null;
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; visual?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex flex-wrap gap-0.5 rounded-md bg-state-hover p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.visual === undefined || option.visual === null ? null : (
              <span aria-hidden className="flex items-center">
                {option.visual}
              </span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Saves on Enter or blur; an empty value snaps back to the saved one. */
function TextSetting({
  value,
  onCommit,
  max = TEXT_MAX,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  max?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim().slice(0, max);
    if (next === "" || next === value) setDraft(value);
    else onCommit(next);
  };
  return (
    <Input
      value={draft}
      maxLength={max}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      className={cn("h-8 w-48 text-sm", className)}
    />
  );
}
