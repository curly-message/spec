# AGENTS.md

Behavioral guidelines for LLM coding assistants working on the **Curly Message
Format** family. Applies to anything that drives commits, PRs, issues or file
edits in any of its repositories.

## How the files are laid out

- **This file holds the full rules for the whole family.** Every other
  repository of the family carries a short `AGENTS.md` that defers to it and
  states only what differs there (see *A new repository* at the end). A rule
  lives in one place.
- **`CLAUDE.md` imports `AGENTS.md`** (`@AGENTS.md`), so Claude Code loads it;
  other agents read `AGENTS.md` directly.
- **Precedence:** these repo rules override an agent's own memory or
  preference. If memory conflicts with this file, follow this file.
- **Tradeoff:** the rules bias toward caution, correctness and not breaking a
  published package over speed. For trivial tasks, use judgment.

---

## The family

| Repository | Packages | Role |
|------------|----------|------|
| [`spec`](https://github.com/curly-message/spec) | `SPEC.md`, `CST.md`; `@curly-message/conformance` (`conformance/`); the site (`site/`, private) | the format: the normative document, the conformance set every implementation runs, and the public site with the playground; hosts the **shared issue tracker** |
| [`parsers`](https://github.com/curly-message/parsers) | `@curly-message/parser` (`js/`) | the implementations, one directory per language, each a standalone package with no root manifest |
| [`lint`](https://github.com/curly-message/lint) | `@curly-message/lint` (`lint/`), `@curly-message/eslint-plugin` (`eslint-plugin/`) | npm workspaces: the linter library and the `curly-lint` command, and the ESLint plugin over them |

Issues for every repository of the family live in
[`curly-message/spec`](https://github.com/curly-message/spec/issues); the other
repositories take pull requests only.

### This repository

Tech stack — **ground truth, do not assume otherwise**:

| | `conformance/` | `site/` |
|---|---|---|
| Language | TypeScript, ESM only | JavaScript, ESM only |
| Package manager | npm, one lockfile per package | npm, one lockfile |
| Build | tsup | `node build.mjs` (`marked`) |
| Tests | vitest | `node --test` |
| Lint | ESLint flat config with `@stylistic`, run by a pre-commit hook | none |
| Runtime dependencies | none | none shipped; the playground runs the parser the lockfile pins |
| Supported runtimes | Node 22+, Bun, Deno 2 | Node 22 to build; any current browser |
| CI | `tests-conformance.yml` (calls `tests.yml`), `publish-conformance.yml` (calls `publish.yml`), `release-spec.yml` | `tests-site.yml`, `site.yml` |

Commands, run from the package directory:

| Command | What it does |
|---------|--------------|
| `npm ci` | install from the lockfile |
| `npm test` | `conformance/`: build, typecheck the source and the shipped declarations, lint, then the suite against the source and against the build; `site/`: build, then read the pages back |
| `npm run test:bun`, `npm run test:deno` | `conformance/`: build, then the suite on Bun or Deno — what the runtime legs of CI run |
| `npm run lint:fix` | `conformance/`: fix what the formatting contract reports |
| `npm run manifest` | `conformance/`: rewrite `index.json` from the fixtures |
| `npm run serve` | `site/`: build and serve with a rebuild on change |

Repository map:

| Path | Role |
|------|------|
| `SPEC.md` | the specification: version 3 of the format and nothing else |
| `CST.md` | the concrete syntax tree, a companion that adds nothing to the format |
| `CHANGELOG.md`, `MIGRATIONS.md`, `RULINGS.md` | every revision of the document, the path off an earlier version, and why the rules read as they do |
| `conformance/fixtures/`, `conformance/schema/`, `conformance/index.json` | the set: fixtures pinned to sections, their JSON Schema, the manifest |
| `conformance/src/` | the JavaScript runner and the loaders the package exports |
| `conformance/bin/` | the `curly-message-conformance` command and the manifest writer |
| `conformance/RUNNER.md`, `conformance/defects.json` | what a runner in another language is held to, and the deliberately wrong adapters it is audited against |
| `site/` | the site's generator, its two own pages and the playground |
| `brand/` | the marks, under their own terms |

### Dependencies across the family

- `@curly-message/parser` and `@curly-message/conformance` have **no runtime
  dependencies**. The parser tests against the set as a `devDependency`.
- `@curly-message/lint` takes the parser as a **peer dependency**, so a project
  lints with the parser it resolves with, and carries the current parser as a
  `devDependency` to build and test against. `@curly-message/eslint-plugin`
  **pins** the linter **exactly**: both release from one repository, together.
- The site pins the parser through its lockfile; the playground runs that
  release.
- A peer range is **widened, never narrowed**: narrowing fails a project still
  on a version (or prerelease) the old range accepted. A prerelease line needs
  an explicit widening (`^3.1.1 || ^3.2.0-next.0`).

## Architecture you must respect

**The specification is normative; usage decides what it says.** Where an
implementation and `SPEC.md` disagree, that is a bug report against one of
them — decide which, and say so, rather than quietly changing the other. What
the document settles is argued from how messages are written and read, not from
what it happens to say today. Within `curly-message-3`, what a message resolves
to does not change (`README.md`, *Status*); an amendment that would change it
belongs to a later version of the format.

**Behavior changes are format changes.** Anything that alters what a message
resolves to changes `SPEC.md`, its `CHANGELOG.md`, the conformance set and every
implementation in the same round of work, released together by one plan (§4).

**The conformance set is the contract.** Every fixture cites the section it
tests, and the set's own tests hold each citation to a heading of the document.
An implementation runs the whole set in its tests; a behavior no fixture pins
is a gap in the set, not freedom for the implementation.

**Implementation independence is the point.** The format exists so that
implementations can target it without inheriting a host library. A published
surface of the family implements the format, never a host's calling
convention; an adapter that presents a package to a host belongs in that host's
repository. The family's documents name no host library and no adapter — the
format's origin, `@sveltekit-i18n/parser-default`, is the one host package they
name.

## Invariants — do NOT break these without explicit user sign-off

1. **No runtime dependencies** in the parser or the conformance set. Adding one
   is a blocking change — stop and ask.
2. **No breaking changes** to a released package's public surface or exported
   types.
3. **No host coupling** (above). A dependency on a host library is a blocking
   change.
4. **One module format, stated runtimes:** ESM only; Node 22+, Bun and
   Deno 2. The source touches no API beyond what the stated runtimes share —
   the `node:` modules Bun and Deno implement among them — and CI has a leg
   per runtime to keep that true. Reaching for one is a blocking change.
5. **Generated output** (`dist/`, `_site/`) is never hand-edited and never
   committed.

---

## 1. Think before coding

**Don't guess. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly; if unsure, ask. Clarifying questions belong in
  chat **before** mistakes show up in the diff.
- If multiple interpretations exist, present them — don't pick silently.
- For non-trivial changes, propose the plan in chat **before** touching files.
- **Refetch before reasoning, don't recall.** In long sessions, fetch current
  state (PR/issue meta, branch state, file content, CI status) instead of
  trusting memory. In-session recall is a cache; the system is the source of
  truth.

## 2. Simplicity first

Minimum code that solves the problem. No speculative features or
abstractions. Validate only at boundaries (a caller's options, a message, a
catalogue) — internal contracts are contracts. A package fails soft at its
public edges: a missing payload key, an unknown modifier or a prototype-named
key degrades to something sensible instead of throwing.

## 3. Surgical changes

**Touch only what you must. Match existing style even if you'd write it
differently.**

- Don't "improve" adjacent code or formatting unrelated to the task.
- Don't refactor what isn't broken.
- Remove only the imports/vars/types **your** change orphaned.
- **Findings along the way.** Unrelated dead code, a bug or a stale doc is
  not fixed in the same PR, and not left in chat or in the PR's notes alone,
  where it ends with the PR. Once reproduced, a small fix that decides
  nothing gets a PR of its own, through the whole cycle, right after the
  current one; anything larger, or anything the user decides, gets an issue
  in the [shared tracker](https://github.com/curly-message/spec/issues) with
  its scenario. Both are opened without asking. The PR that found it links
  either under `## Notes`. An impression not reproduced is neither. An issue
  takes the milestone of the release the current work lands in when that
  release would ship the defect (`parser 3.2.0`), and the package's open
  line's (`parser 3.x`) otherwise; the release plan (§4) lists what its
  milestone holds. Only a finding worth landing in a stable release counts:
  a defect a consumer of a published package, its docs, the site or the
  playground can meet — in behavior, types or cost — or a gap in a
  repository's own checks. A nit, a matter of taste, or friction of the
  agent's own tooling or environment is neither; mention it in chat at most.

## 4. Verify and review

**Every commit's tip is green.**

- Before each code commit, the build **and** the test suite pass. Report the
  real output — never claim done without running them.
- Type, lint and build errors never reach a commit, not even WIP.
- Doc-only changes skip the build and the review cycle, but each statement is
  checked against the code it describes, links resolve and markdown renders.

**Nothing merges unreviewed.** A green suite only proves what it tests. Every
change goes through this cycle:

1. **Design check before code.** For a non-trivial change, a small panel
   argues against the plan before any implementation, above all where it
   leans on behavior it does not own (`Intl`, a runtime, ESLint, a bundler).
   A flawed design costs more than any code bug a later round catches.
2. **Develop**, verified as above.
3. **Review**, its scope picked by the change's risk and by the planned
   issues it touches. Each finding needs a concrete scenario (input → wrong
   output) and must survive independent skeptics trying to refute it. Every
   round also reviews **performance** against the base branch, at runtime and
   in the type checker: what the change adds to a hot path, what it retains
   and whether that stays bounded, what it adds to the consumer's bundle, and
   what its types cost the checker. A performance finding needs the same
   concrete scenario, measured by count (calls, instantiations, bytes) and by
   time (see *Benchmarks*). Performance work goes where consumers spend the
   most time first; a change that speeds up a rare shape is taken only when it
   costs the common flows nothing measurable. When a measurement shows that a
   planned item does not pay off, it is reported with that measurement before
   it is implemented, never done anyway.
4. **Ground every claim.** A reviewer proves an assumption from the source
   (the specification, the engine's behavior on every supported runtime) or
   by reproducing it — never from memory.
5. **Fix red → green** (§13), as fixups into the commit that introduced the
   defect (§6).
6. **Review the fix.** Each round of fixups gets a review of at least its own
   delta, and the rounds go on until one confirms nothing. From the third
   round that still confirms something, the findings are read together:
   findings that keep coming back in one place or of one kind mean the design
   is wrong there, so that part goes back to step 1 and the cycle continues
   from its outcome without waiting on the user — who is asked only when the
   redesign would change the public surface, the PR's scope or an invariant.
   A round that touches only prose gets a self-check instead: each changed
   statement is checked against the code, or reproduced, on every version it
   claims to hold for.
7. **Run it where it is used** when a change touches how a package meets
   something its tests only simulate: the playground against the local build
   of the parser (`site/`), or a scratch project that installs the packed
   tarball for the linter, its command and the ESLint plugin.
8. **Review the release.** Before a minor or major release, review its whole
   diff across the repositories, for the bugs that live between features no
   single PR contains.

The user decides when a PR merges; the cycle decides when it is ready to ask.
A PR is offered for merge only once the whole cycle ran on its final head and
CI is green. The offer lists each step with its outcome — the design check,
each review round and what it found, the run where it is used (or why it does
not apply), CI — and names any step not run.

### Benchmarks

- **Every package has one**: `npm run bench`, and
  `npm run bench -- --compare <dir>` against the same package checked out and
  built at `<dir>`.
- **Counts and times.** A count (calls, instantiations) is deterministic and
  gates; a time is measured base against change on one machine in one
  session, alternating over repeated samples, and reported with its spread.
  The spread leaves out the lowest and highest quarter of the samples, rounded
  down, so a busy neighbour neither hides nor flags a change.
- **CI runs it on every PR** that touches what it measures and posts the
  table as a comment (on a PR from a fork, in the job's summary). A failing
  benchmark of the branch fails the job; so does a count that grew, a row gone
  missing or changing kind, or a failing benchmark of the base — unless the PR
  carries a `bench-accepted` label (a label change re-runs the job). A size
  that grew and a time beyond its spread are flagged for review.
- A hot path no row covers gets a row in the same PR.
- The release workflow writes `BENCH.md` into the release commit, so each
  published version records its results.

### Releases

**Releases are planned across the family, never one package at a time.** A
publish cannot be undone, and an exact pin or a peer range means a dependency
released after its dependent forces another release of the dependent.

- **Never infer a release.** A request to fix something is not a request to
  publish it; ask what remedy is wanted.
- **Plan before any publish, patches included.** For every package of the
  family, list what `main` holds since its last tag and every fix planned or
  in flight that touches it (the issues of the release's milestone included),
  and decide for each: release now, or defer. Show that table in chat;
  nothing is published until the user approves it.
- **The plan is a table of every step**, each with who takes it and the steps
  it waits on: the issues to resolve, the PRs to open and merge, each range
  bump, the checks below, each publish and each document update. It is
  ordered so that no package is published twice.
- **Leaves first.** The document's revision, then the conformance set, then
  the parser, then the linter, then the ESLint plugin, then the site. A
  package is not published while a package it depends on holds an unreleased
  change or a planned fix it needs, unless the user deferred that fix by name.
- **Bump the family first.** Every range a package holds on the family
  (`devDependencies`, peer ranges, exact pins, lockfiles, the site's) and every
  doc line naming a tested version moves to the latest released version in a
  PR merged before the publish.
- **What npm shows is the version it shows.** Before each publish, go through
  what the tarball carries (`npm pack --dry-run`) — the README is the npm
  page — and the docs it links to. Each statement describes the version being
  published and each link resolves. A mismatch is fixed before the publish,
  never in the next release.
- **Every package is shown in use.** The playground shows the parser, and a
  release that adds to what a message can say shows it there; the parser's
  suite runs the conformance set; the linter and the plugin are shown by the
  usage their READMEs give.
- **Every package is benchmarked** before it is published (see above).
- **Publishing:** one package per workflow run, by npm trusted publishing,
  with a tag namespaced by package (`js-v3.1.1`, `conformance-v4.1.0`,
  `lint-v1.0.0`). A new package's first version is published by hand
  (`--tag next`), then its trusted publisher is set to the workflow.
- **Close the loop.** After a publish, confirm the version on npm
  (`npm view`) and update what follows it — the ranges and pins above, the
  site's lockfile, the other repositories' lockfiles — as part of the same
  plan.

## 5. Commit on approval

**Local changes are the default. Committing is the user's call.**

- Respond to requests by editing **locally**; show the diff; ask "ok?".
- Commit only after explicit approval ("ok", "commit it", or a fixup request).
- A modified working tree between turns is the **expected state**, not mess
  to clean up unprompted.
- **Approval is scoped to the named changes.** Approving X doesn't authorize
  bundling unrelated files into the commit.

## 6. Incremental commits & fixup hygiene

- **One concern per commit.** Each commit is self-contained and lands code in
  its **final form**.
- **Never** add code in one commit and refactor it away in a later commit on
  the same branch. Refinement of what the branch already introduced →
  `git commit --fixup=<sha>` + `git rebase -i --autosquash`, not an "address
  review" commit.
- "Fix this"/"amend" within an active branch means the **fixup workflow**.
- After an approved fixup, the autosquash rebase **and** the
  `git push --force-with-lease` are part of the same approved step.
- Commit messages: imperative mood, `type(scope): summary`. The scope is the
  package directory when the change is inside one (`feat(js): …`,
  `fix(lint): …`, `docs(conformance): …`); root-level changes leave it off
  (`docs: …`, `chore: …`).

## 7. Branch & push discipline

- **The default branch is `main`.** Never commit straight to it; never
  force-push a shared branch. Every repository allows rebase merges only, so
  `main` stays linear.
- **`main` carries only finished product.** No temporary bootstraps or
  workarounds for unpublished dependencies, no half-built surfaces.
  Branch-only scaffolding (e.g. a `file:` dev dependency standing in for an
  unpublished package) is removed before merge; until then the PR waits as a
  draft.
- **Branch from an up-to-date `main`**
  (`git fetch origin && git switch main && git pull --ff-only`), with a name
  that says what the work is: `fix/<slug>`, `feat/<slug>`, `chore/<slug>`,
  `docs/<slug>`, `perf/<slug>`.
- Rebase on `main` before pushing; on conflicts, **stop and ask**. Never
  merge `main` into a feature branch.

## 8. PRs

- **Every branch headed for `main` gets a PR**, opened once it is pushed and
  green, without asking. Keep it narrowly scoped; link out-of-scope
  follow-ups (§3) under `## Notes`.
- Title ≤ 70 chars, describing the overarching scope. Body: a short summary,
  what was tested (real results), and the linked issue via closing keywords
  (`Closes curly-message/spec#N`).
- **Keep PR meta in lockstep with the branch.** After every push, re-check
  that the title, summary, test results and scope still match the diff.
  Drift is a defect, not a follow-up.

## 9. Docs track code

Update docs in the same PR that invalidates them: `AGENTS.md`, each
`README.md` (a package's README is its npm page), each `CHANGELOG.md`, and the
doc comments on exported types. A code change that contradicts a doc updates
the doc, ideally in the same commit. Remove a feature → remove its docs.
Stale docs found along the way → §3. A change to what a message resolves to
also updates `SPEC.md` and its `CHANGELOG.md` (§ Architecture).

- **Links within the family** are relative inside a repository and GitHub
  URLs across repositories. The site's address appears only in a package's
  `homepage`, in a repository's Website field and in the site's own canonical
  URLs — never in a document, which reads the same on GitHub, on npm and on
  the site.
- **Names:** the format is the *Curly Message Format*; its machine-readable
  identifier is `curly-message`, versioned as `curly-message-3`.

## 10. Coding conventions

- Formatting is the linter's contract (the `@stylistic` block of each
  package's `eslint.config.js`: 2-space indent, single quotes, semicolons,
  trailing commas on multiline, spaced object braces, no trailing whitespace,
  at most one consecutive blank line, newline at EOF). `npm run lint` reports
  what breaks it and `npm run lint:fix` fixes it; a pre-commit hook runs it,
  and CI runs it without `--fix`.
- Prefer the **functional, immutable** style for shared state (computed-key
  spread, `reduce`, `Object.fromEntries` for a level built from entries — a
  spread per key is quadratic). On a **measured hot path** a function-local
  accumulator may be mutated, but only into a null-prototype object, given a
  normal prototype before it escapes.
- Keep orchestration and pure logic apart: pure, testable helpers live in a
  `utils` module.
- **A package writes nowhere itself.** What it has to say leaves through its
  API — the parser's `onReport`, the linter's findings — and the caller
  decides where that goes. Never raw `console` in a library.
- **Write a character outside ASCII in a string or a regular expression as an
  escape**, never as itself: a literal line separator is invisible to review
  and ends a JavaScript line.
- **Reuse before reimplementing.** Grep before adding a helper; bend an
  existing one rather than forking it.
- **Abstraction beats duplication** that already exists (as opposed to §2's
  speculative abstraction). When a fix would add a second copy of an existing
  structure, extract the shared core; if that reshapes call sites, recommend
  it in chat rather than refactoring silently.

## 11. Security & robustness posture

The packages have no eval, DOM or network of their own; they turn
consumer-supplied text and data into strings, trees and findings. The
realistic risks are **DoS, robustness and the prototype chain**.

- **Prototype keys are missing data.** Reads of a table by a key a message or
  a catalogue supplies use an own-property check, so `toString`, `__proto__`
  and `constructor` are missing, not inherited.
- **Never bracket-assign a user-supplied key onto a plain object** —
  `table[key] = value` routes `'__proto__'` through the prototype setter.
  Write with a computed-key spread (`DefineProperty`) or into a
  null-prototype object.
- **Bounded work.** What a call costs grows with its input, never with a
  value outside it; a limit that keeps it so is load-bearing, and changing one
  is a format change in the parser and a blocking change elsewhere.
- **Fail soft at the edges.** One throwing callback must not wipe a batch.
- **Consumer-controlled text never meets a pattern that backtracks** — the
  parser's scan is hand-written for that reason. Don't add one that could;
  flag it if touched.

## 12. Comments & language

- Default to **no** comment; code says *what*, comments say *why* (a hidden
  constraint, an invariant, a non-obvious workaround). Never reference the
  current task, a fixed bug or a PR number — that rots.
- A name that needs a comment to explain it is the wrong name.
- If a workaround needs a paragraph to justify it, the code is wrong — fix
  the code.
- **Everything committed or published is in English** — code, comments,
  commit messages, PRs, issues, docs. Chat may use the user's language.

## 13. Tests

- Drive behavior through the **public API**; import a pure helper directly
  only where that makes a test more deterministic.
- A test shows what the code does and what it leaves alone: the near miss is
  the test.
- **Bug fixes are red → green.** Write the test that reproduces the bug,
  confirm it **fails** on the unfixed code, fix, watch it pass, and state that
  both directions were verified. The test lands with the fix, never apart.
- An assertion that contradicts the specification is a bug in one of them.
  Decide which, and say so — don't quietly reshape the test to match the code.
- **Never wait on wall-clock time**, and never assert on it. Await promises or
  observable state; the CI matrix (OS × runtime versions) is slow on some legs
  and timing flakes. Cost is asserted by count; time belongs to the benchmark.
- **Never assume what a runtime leaves unspecified** — how deep a call stack
  goes, the order `Intl` lists something in. Derive it on the runtime the test
  runs on.
- **Test the shipped artifact**, not only the source: the suite imports the
  package by its name, and `npm test` runs it once against the source and
  once, under `--mode dist`, against `dist/`.
- **Types are tested by compiling.** Type fixtures assert with
  `@ts-expect-error` and a type-level `Equal`, compiled with `tsc` at
  `skipLibCheck: false` against both the source and the shipped declarations.
  A type test that runs must exercise the value it types: a closure declared
  and never invoked asserts nothing.
- **What a type costs the checker is tested by count, never by time**,
  wherever a type computes over what a consumer passes (a generic, a
  conditional or mapped type): `program.getInstantiationCount()` across
  inputs of two sizes, each call site written as a consumer writes it so the
  checker cannot reuse one call's work for the next.
- Every repository runs the same suite on every supported runtime and OS in
  CI, plus lint without `--fix`.

## 14. Output style

- Terse. Lead with results. No "I'll do X" preamble, no trailing recap.
- **One file = one visible operation** — each file edit is its own diff, not
  a shell loop that writes many.
- **No emojis** in code, commit messages or PR descriptions unless requested.

---

**These guidelines are working if:** PRs review easily, commits read as a
single coherent story, the published API never breaks by accident, an
implementation never drifts from the specification by accident, and
clarifying questions show up in chat before mistakes show up in the diff.

---

## A new repository

Its `AGENTS.md` defers to this one and keeps only what differs:

```markdown
# AGENTS.md

Behavioral guidelines for LLM coding assistants working on **<repo>**.

**Precedence:** These repo rules override individual LLM memory or personal
preference. If your own memory conflicts with this file, follow this file.

This repository follows the rules of the Curly Message Format family in
[`spec`'s AGENTS.md](https://github.com/curly-message/spec/blob/main/AGENTS.md)
(sections 1-14). What follows is only what differs here.

Those rules are not in this file, and nothing loads them for you: before any
change, read `spec`'s AGENTS.md in full — `../spec/AGENTS.md` when it is
checked out beside this repository on an up-to-date `main`, otherwise
[the raw file](https://raw.githubusercontent.com/curly-message/spec/main/AGENTS.md)
— and follow it as fully as the rules below.

## The repository
<!-- layout, stack, commands, map, how it depends on the family, its release position -->

## Architecture you must respect
<!-- this repository's own invariants -->

## Tests
<!-- what this suite proves and what it leaves to the others -->
```

Its `CLAUDE.md`:

```markdown
# CLAUDE.md

The agent rules for this repository live in **[AGENTS.md](./AGENTS.md)**,
imported here so they load automatically:

@AGENTS.md
```

Its CI:

- `tests.yml`: the suite on each supported Node version × ubuntu, macOS,
  Windows, plus a leg each on Bun and Deno, plus lint without `--fix`.
- `bench.yml`: the benchmark of the PR against its base, posted as a comment;
  `bench-label.yml` re-runs it when `bench-accepted` changes.
- A publish workflow per package: trusted publishing, `BENCH.md` written into
  the release commit, a GitHub release per package tag.
- Repository settings: rebase merges only; issues off, pointing to the shared
  tracker.
