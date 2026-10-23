# bb-plugin-inbox

A "Needs you" block pinned above bb's sidebar thread list. It lists threads
where an agent waits on your reply (a question or an approval) and threads
that failed while you weren't looking. Opening a thread marks it read, so it
leaves the block on its own.

## Install

```sh
bb plugin install git:https://github.com/qwent71/bb-plugin-inbox.git@main
```

bb clones the repository, installs its dependencies, and builds it. Tagged
`vX.Y.Z` releases will follow; once they exist, install a range such as
`@^0.1.0` and `bb plugin update` moves you to later releases.
Settings live on the plugin's page under Settings → Inbox; `bb inbox export`
and `bb inbox import` move them between machines.

## Files

- `app.tsx` — places the block above the sidebar list and registers the
  settings page.
- `components/inbox-block.tsx` — the block itself. The sidebar and every
  preview on the settings page draw this same component.
- `components/settings-page.tsx` — the settings page: a live preview per group.
- `hooks/use-inbox.ts` — settings over RPC with realtime sync, and the exact
  time each question was asked.
- `lib/inbox.ts` — which thread goes where, and time formatting.
- `lib/settings.ts` — settings type, options, defaults, parsing, migration.
- `server.ts` — stores settings and validates every change.

## How it decides

| Kind | Rule |
| --- | --- |
| Waiting on you | the thread has a pending interaction |
| Failed | an unread error, or a queued message that failed to send |
| Done, unseen | finished and not opened since (optional) |
| Working | busy right now (counter only) |

A question's time is the moment it was asked, not bb's `latestAttentionAt`,
which doesn't move while a thread waits mid-turn.

## Notes

- bb has no slot above the thread list, so the block is portaled into a node
  placed before the sidebar's scroll area. If bb changes that markup the block
  stops showing; nothing else breaks.
- Settings live in plugin storage, not `bb.settings`, so the settings page can
  put its preview above the controls.

## Develop

```sh
npm install --include=dev
npm run check          # typecheck, build, settings RPC and rule checks
bb plugin reload inbox
```
