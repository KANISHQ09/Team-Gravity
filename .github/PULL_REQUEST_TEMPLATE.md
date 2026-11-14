## Summary

<!-- What does this PR do, and why? One or two sentences. -->

Closes #<!-- issue number -->

## Type of change

- [ ] `feat` new feature
- [ ] `fix` bug fix
- [ ] `docs` documentation only
- [ ] `refactor` / `perf` no behaviour change
- [ ] `test` tests only
- [ ] `chore` / `ci` / `build` tooling or config

## Area

- [ ] `packages/engine`
- [ ] `packages/catalog`
- [ ] `packages/shared`
- [ ] `apps/web`
- [ ] `apps/server`
- [ ] `tools/` / `docs/` / repo config

## What changed

<!-- Bullet list of the main changes. Mention any requirement IDs (e.g. FR-06). -->

-

## How it was tested

<!-- Commands run and what you checked by hand. -->

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manual check:

## Screenshots / recordings

<!-- For UI changes. Delete if not applicable. -->

## Checklist

- [ ] Follows [CONTRIBUTING.md](../CONTRIBUTING.md) and the folder structure
- [ ] Engine code stays pure and deterministic (no DOM, network, clock or unseeded randomness)
- [ ] New or changed game numbers carry a `NASA` / `DERIVED` / `GAME` label and are listed in `docs/DATA_LEDGER.md`
- [ ] Keyboard-accessible, labelled, and no colour-only status (UI changes)
- [ ] No secrets, `.env` files or personal data committed
- [ ] New dependencies are justified below and MIT-compatible
- [ ] Docs updated if behaviour changed

## New dependencies

<!-- package — why it is needed — license. Write "None" if none. -->

None

## Notes for reviewers

<!-- Anything risky, unfinished, or worth a closer look. AI-assisted changes: say which parts. -->
