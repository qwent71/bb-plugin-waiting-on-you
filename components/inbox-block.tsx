// The "Needs you" block itself, drawn the same way in the sidebar and in the
// settings preview. It takes data and settings as props; its only state is
// whether a cut list is shown in full.
import { memo, useState } from "react";
import type { MouseEvent } from "react";
import {
  experimental_ThreadActionsContextMenu as ThreadActionsContextMenu,
  experimental_ThreadStatusGlyph as ThreadStatusGlyph,
  ThreadTitle,
  useBbNavigate,
  type PluginSidebarProject,
  type PluginSidebarThread,
  type PluginSidebarThreadIndicator,
  type PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";
import { Icon } from "@/components/ui/icon";
import { formatTime, type InboxView } from "@/lib/inbox";
import type {
  Category,
  CategoryLook,
  ColorName,
  InboxSettings,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Categories that put a thread in the list; "working" is only counted. */
export type NeedKind = Exclude<Category, "working">;

/** Full names for headers, tooltips, and screen readers. */
export const CATEGORY_NAMES: Record<Category, string> = {
  decision: "Waiting on you",
  failed: "Failed",
  done: "Done, unseen",
  working: "Working",
};

const ROW_LABELS: Record<NeedKind, string> = {
  decision: "waiting on you",
  failed: "failed",
  done: "done, unseen",
};

/** What bb's own status glyph draws for each category. */
const CATEGORY_INDICATOR: Record<Category, PluginSidebarThreadIndicator> = {
  decision: "waiting-for-input",
  failed: "unread-error",
  done: "unread-success",
  working: "runtime",
};

interface Swatch {
  /** Solid color for dots and stripes. */
  solid: string;
  /** Soft background for tinted rows, tags, and pills. */
  soft: string;
  /** Text and icon color. */
  text: string;
}

// Written out in full so Tailwind finds every class when it scans the source.
// Text colors come from app.css, which follows bb's theme, not the OS.
export const PALETTE: Record<ColorName, Swatch> = {
  amber: {
    solid: "bg-amber-500",
    soft: "bg-amber-500/12",
    text: "wou-tone-amber",
  },
  orange: {
    solid: "bg-orange-500",
    soft: "bg-orange-500/12",
    text: "wou-tone-orange",
  },
  red: {
    solid: "bg-red-500",
    soft: "bg-red-500/12",
    text: "wou-tone-red",
  },
  rose: {
    solid: "bg-rose-500",
    soft: "bg-rose-500/12",
    text: "wou-tone-rose",
  },
  violet: {
    solid: "bg-violet-500",
    soft: "bg-violet-500/12",
    text: "wou-tone-violet",
  },
  sky: {
    solid: "bg-sky-500",
    soft: "bg-sky-500/12",
    text: "wou-tone-sky",
  },
  emerald: {
    solid: "bg-emerald-500",
    soft: "bg-emerald-500/12",
    text: "wou-tone-emerald",
  },
  gray: {
    solid: "bg-zinc-400",
    soft: "bg-zinc-500/12",
    text: "wou-tone-gray",
  },
};

/** Widths that fit the longest text of each time format, for columns. */
const TIME_WIDTH: Record<"relative" | "short" | "clock", string> = {
  relative: "w-[4.75rem]",
  short: "w-8",
  clock: "w-10",
};

const MUTED: Swatch = {
  solid: "bg-muted-foreground",
  soft: "bg-muted",
  text: "text-muted-foreground",
};

/** A key pill like the ones bb shows on its rows while ⌘ is held. */
export function KeyHint({ label }: { label: string }) {
  return (
    <kbd className="shrink-0 rounded border border-border bg-background px-1 font-sans text-[10px] font-medium leading-4 text-muted-foreground">
      {label}
    </kbd>
  );
}

/**
 * A category's mark: a dot, bb's own status glyph, or the chosen icon.
 * `indicator` lets a real row pass bb's exact state for the glyph.
 */
export function CategoryMark({
  category,
  look,
  mode,
  muted = false,
  indicator,
}: {
  category: Category;
  look: CategoryLook;
  mode: "dot" | "glyph" | "icon";
  muted?: boolean;
  indicator?: PluginSidebarThreadIndicator;
}) {
  const swatch = muted ? MUTED : PALETTE[look.color];
  if (mode === "glyph") {
    return (
      <span
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center",
          muted && "opacity-60 grayscale",
        )}
      >
        <ThreadStatusGlyph
          indicator={
            indicator === undefined || indicator === "none"
              ? CATEGORY_INDICATOR[category]
              : indicator
          }
          size="compact"
        />
      </span>
    );
  }
  if (mode === "icon") {
    return (
      <Icon
        name={look.icon}
        aria-hidden
        className={cn(
          "size-3.5 shrink-0",
          swatch.text,
          look.icon === "Loading" && !muted && "animate-spin",
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", swatch.solid)}
    />
  );
}

export function projectNameMap(
  projects: readonly PluginSidebarProject[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const project of projects) {
    // The personal project is everyone's default; naming it is just noise.
    if (!project.isPersonal) names.set(project.id, project.name);
  }
  return names;
}

function actionTarget(thread: PluginSidebarThread): PluginThreadActionTarget {
  const environmentId = thread.environment?.id ?? null;
  return {
    id: thread.id,
    projectId: thread.projectId,
    parentThreadId: thread.parentThreadId,
    archivedAt: thread.archivedAt,
    pinnedAt: thread.pinnedAt,
    sectionId: thread.sectionId,
    isUnread: thread.isUnread,
    status: thread.status,
    environment:
      environmentId === null
        ? null
        : { id: environmentId, path: thread.environment?.path ?? null },
  };
}

const InboxRow = memo(function InboxRow({
  thread,
  kind,
  at,
  projectName,
  isActive,
  now,
  settings,
  preview,
  hint,
}: {
  thread: PluginSidebarThread;
  kind: NeedKind;
  /** When this thread started needing the user. */
  at: number;
  projectName: string | null;
  isActive: boolean;
  now: number;
  settings: InboxSettings;
  /** Settings preview: sample data, no navigation, no thread menu. */
  preview: boolean;
  /** A key that opens this row, shown in place of the time while ⌘ is held. */
  hint: string | null;
}) {
  const look = settings.categories[kind];
  const swatch = PALETTE[look.color];
  const {
    rowMarker,
    density,
    timeFormat,
    projectPlace,
    markerSide,
    tagPlace,
    timePlace,
    alignColumns,
    titleWrap,
  } = settings;
  const navigate = useBbNavigate();
  // The block lives outside bb's thread list, so bb doesn't route these
  // clicks for us: a plain anchor would reload the whole app. Keep the href
  // for middle-click and copy-link, and route ordinary clicks in place.
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (!preview) navigate.toThread(thread.id);
  };

  const title = preview ? (
    thread.displayTitle
  ) : (
    <ThreadTitle threadId={thread.id} />
  );
  const project =
    projectPlace === "off" || projectName === null ? null : projectName;

  const mark =
    rowMarker === "dot" || rowMarker === "glyph" || rowMarker === "icon" ? (
      <CategoryMark
        category={kind}
        look={look}
        mode={rowMarker}
        indicator={preview ? undefined : thread.indicator}
      />
    ) : null;
  const tag =
    rowMarker === "tag" ? (
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 text-[10px] font-semibold leading-4",
          swatch.soft,
          swatch.text,
        )}
      >
        {look.label}
      </span>
    ) : null;
  const time =
    timeFormat === "off" ? null : (
      <time
        dateTime={new Date(at).toISOString()}
        title={new Date(at).toLocaleString("en-GB")}
        className={cn(
          "shrink-0 text-xs tabular-nums text-muted-foreground",
          // A fixed-width time column keeps tags and times in straight lines.
          alignColumns && timePlace === "end" && cn("text-right", TIME_WIDTH[timeFormat]),
        )}
      >
        {formatTime(at, now, timeFormat)}
      </time>
    );
  // While ⌘ is held the key takes the time's place, wherever the time sits.
  const trailingTime = hint !== null ? <KeyHint label={hint} /> : timePlace === "end" ? time : null;
  const secondLine = [
    projectPlace === "below" ? project : null,
    timePlace === "below" && hint === null ? time : null,
  ].filter((part) => part !== null);
  const wrap = titleWrap === "wrap" ? "line-clamp-2 break-words" : "truncate";

  const row = (
    <a
      href={thread.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={`${thread.displayTitle}, ${ROW_LABELS[kind]}`}
      className={cn(
        "relative flex min-w-0 gap-2 rounded-md pl-2.5 pr-2 text-sidebar-foreground outline-none transition-colors",
        secondLine.length > 0 || titleWrap === "wrap" ? "items-start" : "items-center",
        density === "compact" ? "py-0.5 text-[13px]" : "py-1 text-sm",
        "hover:bg-sidebar-accent focus-visible:bg-sidebar-accent",
        rowMarker === "tint" && swatch.soft,
        isActive && "bg-sidebar-accent font-medium",
      )}
    >
      {rowMarker === "stripe" ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1.5 left-0.5 w-0.5 rounded-full",
            swatch.solid,
          )}
        />
      ) : null}
      {markerSide === "start" && mark !== null ? (
        <span className="flex h-[1lh] shrink-0 items-center">{mark}</span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("min-w-0", tagPlace === "title" ? "shrink" : "flex-1", wrap)}>
            {title}
            {projectPlace === "inline" && project !== null ? (
              <span className="ml-1.5 text-xs text-muted-foreground">{project}</span>
            ) : null}
          </span>
          {tagPlace === "title" ? tag : null}
        </span>
        {secondLine.length === 0 ? null : (
          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
            {secondLine.map((part, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden>·</span> : null}
                {part}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="flex h-[1lh] shrink-0 items-center gap-1.5">
        {tagPlace === "end" ? tag : null}
        {markerSide === "end" ? mark : null}
        {trailingTime}
      </span>
    </a>
  );
  if (preview) return row;
  return (
    <ThreadActionsContextMenu thread={actionTarget(thread)}>
      {row}
    </ThreadActionsContextMenu>
  );
});

const COUNTER_FIELDS: Record<Category, keyof InboxSettings> = {
  decision: "countDecision",
  failed: "countFailed",
  done: "countDone",
  working: "countWorking",
};

/** Header counters in the chosen style; a zero turns grey. */
function Counters({
  items,
  settings,
}: {
  items: { category: Category; count: number }[];
  settings: InboxSettings;
}) {
  const style = settings.counterStyle;
  return (
    <span
      className={cn(
        "flex items-center gap-2 tabular-nums",
        settings.counterPlace === "end" && "ml-auto",
        settings.counterPlace === "title" && "ml-1",
      )}
    >
      {items.map(({ category, count }) => {
        const look = settings.categories[category];
        const zero = count === 0;
        const swatch = zero ? MUTED : PALETTE[look.color];
        return (
          <span
            key={category}
            title={`${CATEGORY_NAMES[category]}: ${count}`}
            className={cn(
              "flex items-center gap-1 font-medium",
              swatch.text,
              zero && "opacity-60",
              style === "pill" &&
                cn("rounded-full px-1.5 leading-4", swatch.soft),
            )}
          >
            {style === "dot" || style === "glyph" || style === "icon" ? (
              <CategoryMark
                category={category}
                look={look}
                mode={style}
                muted={zero}
              />
            ) : null}
            {count}
          </span>
        );
      })}
    </span>
  );
}

/** The key pill a row shows while a modifier is held, if any. */
function rowHint(
  hints: BlockKeyHints | null,
  threadId: string,
  index: number,
): string | null {
  if (hints === null) return null;
  if (hints.jumpPrefix !== null) {
    return index < 9 ? `${hints.jumpPrefix}${index + 1}` : null;
  }
  return hints.nextThreadId === threadId ? hints.nextThread : null;
}

export interface NeedItem {
  thread: PluginSidebarThread;
  kind: NeedKind;
  /** When this thread started needing the user. */
  at: number;
}

/**
 * The threads the block lists, in display order. The "next thread" shortcut
 * walks this same order, so the keyboard and the eye always agree.
 */
export function orderNeeds(
  settings: InboxSettings,
  view: InboxView,
  questionTimes: ReadonlyMap<string, number>,
): NeedItem[] {
  const kinds: NeedKind[] = ["decision"];
  if (settings.showFailed) kinds.push("failed");
  if (settings.showDone) kinds.push("done");

  // A question's own time beats latestAttentionAt, which doesn't move while
  // the thread waits mid-turn. Failures and finished turns do move it.
  const timeOf = (thread: PluginSidebarThread, kind: NeedKind) =>
    kind === "decision"
      ? (questionTimes.get(thread.id) ?? thread.latestAttentionAt)
      : thread.latestAttentionAt;
  const byNewest = (a: { at: number }, b: { at: number }) => b.at - a.at;
  const groups = kinds.map((kind) =>
    view[kind]
      .map((thread) => ({ thread, kind, at: timeOf(thread, kind) }))
      .sort(byNewest),
  );
  return settings.decisionsFirst
    ? groups.flat()
    : groups.flat().sort(byNewest);
}

export interface InboxBlockProps {
  settings: InboxSettings;
  view: InboxView;
  /** When each waiting thread asked its question (see useQuestionTimes). */
  questionTimes: ReadonlyMap<string, number>;
  projectNames: ReadonlyMap<string, string>;
  activeThreadId: string | null;
  now: number;
  preview?: boolean;
  /**
   * Draw only part of the block, for the small samples beside each setting:
   * "header" is the title line, "rows" the thread list without the frame.
   */
  part?: "all" | "header" | "rows";
  /** The list is folded away; only the header shows. */
  collapsed?: boolean;
  /** Makes the header a fold toggle (when the setting allows it). */
  onToggleCollapsed?: () => void;
  /** Key pills to show while ⌘ is held; null hides them. */
  keyHints?: BlockKeyHints | null;
  /** A cut list shown in full; owned by the caller when given. */
  showAll?: boolean;
  onToggleShowAll?: () => void;
}

export interface BlockKeyHints {
  /** The row the "next thread" key would open. */
  nextThreadId: string | null;
  nextThread: string | null;
  toggleList: string | null;
  /** While the jump keys are held: their label, e.g. "⌥⌘", for rows 1–9. */
  jumpPrefix: string | null;
}

export function InboxBlock({
  settings,
  view,
  questionTimes,
  projectNames,
  activeThreadId,
  now,
  preview = false,
  part = "all",
  collapsed = false,
  onToggleCollapsed,
  keyHints = null,
  showAll: showAllProp,
  onToggleShowAll,
}: InboxBlockProps) {
  // The sidebar owns this state (the jump keys need it); previews keep their own.
  const [ownShowAll, setOwnShowAll] = useState(false);
  const showAll = showAllProp ?? ownShowAll;
  const toggleShowAll = onToggleShowAll ?? (() => setOwnShowAll((value) => !value));
  const needs = orderNeeds(settings, view, questionTimes);
  const isEmpty = needs.length === 0;
  if (isEmpty && settings.emptyState === "hidden") return null;
  const canFold = settings.collapsible && !isEmpty;
  const folded = canFold && collapsed;

  // Cut the list after maxItems rows; "+N more" opens the rest in place.
  const limit = settings.maxItems;
  const isCut = limit > 0 && needs.length > limit;
  const shown = isCut && !showAll ? needs.slice(0, limit) : needs;
  const hiddenCount = needs.length - shown.length;

  const enabled = (Object.keys(COUNTER_FIELDS) as Category[])
    .filter((category) => settings[COUNTER_FIELDS[category]] === true)
    .map((category) => ({ category, count: view[category].length }));
  // "Grey counters" keeps every enabled counter while empty; otherwise the
  // zero rule applies to all counters alike.
  const keepZeros =
    settings.showZeroCounts || (isEmpty && settings.emptyState === "dots");
  const visible = keepZeros
    ? enabled
    : enabled.filter((item) => item.count > 0);
  // A centered empty line keeps its counters beside the text, not at the edge.
  const counterSettings =
    isEmpty && settings.emptyAlign === "center"
      ? { ...settings, counterPlace: "title" as const }
      : settings;
  const counters =
    visible.length === 0 ? null : (
      <Counters items={visible} settings={counterSettings} />
    );

  // While ⌘ is held: the "next" key sits on its row, or on the header when
  // that row is folded or cut away; the fold key always sits on the header.
  const nextRowShown =
    !folded &&
    shown.some(({ thread }) => thread.id === keyHints?.nextThreadId);
  const headerHints =
    keyHints === null ? null : (
      <span
        className={cn(
          "flex items-center gap-1",
          (counters === null || settings.counterPlace === "title") && "ml-auto",
        )}
      >
        {keyHints.nextThread !== null &&
        keyHints.nextThreadId !== null &&
        !nextRowShown ? (
          <KeyHint label={keyHints.nextThread} />
        ) : null}
        {keyHints.toggleList !== null && canFold ? (
          <KeyHint label={keyHints.toggleList} />
        ) : null}
      </span>
    );

  const header =
    isEmpty && settings.emptyState === "calm" ? (
      <span
        className={cn(
          "flex items-center gap-1.5 px-2 pb-0.5 pt-2 text-xs text-muted-foreground",
          settings.emptyAlign === "center" && "justify-center",
        )}
      >
        <span className="text-emerald-500">✓</span>
        <span>{settings.calmText}</span>
        {counters}
      </span>
    ) : (
      <span
        className={cn(
          "flex items-center gap-1.5 px-2 pb-0.5 pt-2 text-xs font-medium",
          isEmpty ? "text-muted-foreground" : "text-foreground",
          isEmpty && settings.emptyAlign === "center" && "justify-center",
        )}
      >
        {canFold ? (
          <Icon
            name={folded ? "ChevronRight" : "ChevronDown"}
            aria-hidden
            className="-ml-0.5 size-3 shrink-0 text-muted-foreground"
          />
        ) : null}
        <span>{settings.title}</span>
        {/* No counters switched on: fall back to the plain total. */}
        {enabled.length === 0 ||
        (isEmpty && settings.emptyState === "zero") ? (
          <span className="tabular-nums text-muted-foreground">
            {needs.length}
          </span>
        ) : null}
        {counters}
        {headerHints}
      </span>
    );

  const headerLine =
    canFold && onToggleCollapsed !== undefined ? (
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!folded}
        title={folded ? "Show the list" : "Hide the list"}
        className="group/fold block w-full cursor-pointer rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {header}
      </button>
    ) : (
      header
    );

  const moreRow =
    !isCut || settings.overflow === "hidden" ? null : (
      <li>
        <button
          type="button"
          onClick={toggleShowAll}
          aria-expanded={showAll}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md pl-2.5 pr-2 text-left text-xs text-muted-foreground outline-none transition-colors",
            settings.density === "compact" ? "py-0.5" : "py-1",
            "hover:bg-sidebar-accent hover:text-foreground focus-visible:bg-sidebar-accent",
          )}
        >
          <Icon
            name={showAll ? "ChevronDown" : "ChevronRight"}
            aria-hidden
            className="size-3 shrink-0"
          />
          {showAll ? "Show less" : `+${hiddenCount} more`}
        </button>
      </li>
    );

  const rows = isEmpty || folded ? null : (
    <ul className="space-y-px">
      {shown.map(({ thread, kind, at }, index) => (
        <li key={thread.id}>
          <InboxRow
            thread={thread}
            kind={kind}
            at={at}
            settings={settings}
            projectName={projectNames.get(thread.projectId) ?? null}
            isActive={thread.id === activeThreadId}
            now={now}
            preview={preview}
            hint={rowHint(keyHints, thread.id, index)}
          />
        </li>
      ))}
      {moreRow}
    </ul>
  );
  if (part === "header") return headerLine;
  if (part === "rows") return rows;

  return (
    <div
      aria-label={settings.title}
      style={{ maxHeight: `${settings.maxHeight}vh` }}
      className={cn(
        "mx-2 mb-1 overflow-y-auto pb-1.5",
        // The list and the empty state each have their own divider.
        (isEmpty ? settings.emptySeparator : settings.separator) &&
          "border-b border-sidebar-border",
      )}
    >
      <section aria-label={settings.title}>
        {headerLine}
        {rows}
      </section>
    </div>
  );
}
