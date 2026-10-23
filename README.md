# Waiting On You

A bb plugin that pins a "Needs you" block above the sidebar thread list. It
lists threads where an agent waits on your reply (a question or an approval)
and threads that failed while you weren't looking. Opening a thread marks it
read, so it leaves the block on its own.

## Install

```sh
bb plugin install git:https://github.com/qwent71/bb-plugin-waiting-on-you.git@^0.1.0
```

bb clones the repository, installs its dependencies, and builds it. Releases
are `vX.Y.Z` tags, so `bb plugin update` moves you to later 0.x releases.

## Use

- The block sits above whichever thread list is active; click a row to open
  its thread, or click the title to fold the list.
- `⇧⌘J` opens the next thread that needs you; rebind it in Settings →
  Keyboard (search for "Waiting On You").
- Hold `⌥⌘` and press 1–9 to open that row. The modifier is a plugin setting.
- Settings → Waiting On You has a live preview, styles, quick picks per part
  of the block, and every detail under "Fine-tune". Changes apply on Save.
- `bb waiting-on-you export` prints the settings as JSON;
  `bb waiting-on-you import --json "$(cat file.json)"` applies a whole or
  partial file; `bb waiting-on-you reset` restores the defaults.

## How it decides

| Kind | Rule |
| --- | --- |
| Waiting on you | the thread has a pending interaction |
| Failed | an unread error, or a queued message that failed to send |
| Done, unseen | finished and not opened since (optional) |
| Working | busy right now (counter only) |

A question's time is the moment it was asked, not bb's `latestAttentionAt`,
which doesn't move while a thread waits mid-turn.

## Files

- `app.tsx` — places the block above the sidebar list, registers the
  settings page and the keyboard commands.
- `components/inbox-block.tsx` — the block. The sidebar and every preview on
  the settings page draw this same component.
- `components/settings-page.tsx` — the settings page.
- `hooks/` — settings over RPC with realtime sync, the settings draft, key
  hints, and question times.
- `lib/` — sorting threads, settings (type, defaults, parsing, migration),
  presets and quick picks, shortcuts.
- `server.ts` — stores settings, validates every change, and serves the
  `bb waiting-on-you` command.

## Notes

- bb has no slot above the thread list, so the block is portaled into a node
  placed before the sidebar's scroll area. If bb changes that markup the block
  stops showing; nothing else breaks.
- Settings live in plugin storage, not `bb.settings`, so the settings page can
  put its preview above the controls.
- Everything runs on your bb server. Nothing leaves it; no account or API key
  is needed.

## Develop

```sh
npm install --include=dev
npm run check          # typecheck, build, and the checks in test/
bb plugin install .
bb plugin reload waiting-on-you
```

## License

MIT
