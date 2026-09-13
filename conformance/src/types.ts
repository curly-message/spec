/**
 * The contract between the conformance set and an implementation under test.
 * Everything here is spelled in the vocabulary of the specification — the
 * inputs of section 4, the levels of section 2, the limits of section 13, the
 * report codes of section 14.2 — and nothing in it names a host or an
 * implementation's own API. An implementation meets the set through an
 * `Adapter` (section 14.3), which is where its own calling convention is
 * translated into this one.
 */

/** A conformance level of section 2. */
export type Level = 'core' | 'intl' | 'extensions';

/**
 * The limits of section 13 an implementation permits, as it documents them:
 * the passes it performs, the output it holds in the host's own string unit,
 * and the nodes one conversion may visit. Section 13 states the minima.
 */
export type Limits = {
  passes: number;
  output: number;
  conversion: number;
};

/**
 * What a host-defined modifier receives (sections 11, 11.3), as the
 * specification lists it: the value and the default as text, the options as
 * the placeholder wrote them, the props composed under the modifier's own
 * name, and the locale where one is available. The default is read through a
 * call, because section 10 walks the chain only where a modifier asks for it.
 */
export type ModifierInput = {
  value: string;
  options: { key: string; value: string }[];
  props: Record<string, unknown>;
  locale?: string;
  default: () => string;
};

/** A behaviour of the catalogue, as a function an adapter wraps into its own modifier signature. */
export type ModifierBehaviour = (input: ModifierInput) => unknown;

/** The names of the catalogue's behaviours; README.md states each. */
export type Behaviour = 'upper' | 'echo' | 'empty' | 'nothing' | 'raise' | 'default' | 'options' | 'props' | 'locale' | 'object';

/**
 * One resolution's inputs, decoded into host values: the four inputs of
 * section 4 and the message's id, plus the two pieces of configuration a case
 * may ask for — host-defined modifiers to register (section 11.3) and the
 * implementation-configured defaults of section 11.2.
 */
export type Resolution = {
  message: unknown;
  payload?: unknown;
  props?: unknown;
  locale?: string;
  id?: unknown;
  modifiers?: Record<string, ModifierBehaviour>;
  defaults?: unknown;
};

export type ReportCode = 'unknown-modifier' | 'failed-modifier' | 'missing-options' | 'unserializable-value' | 'missing-locale' | 'pass-limit' | 'output-limit';

export type ReportOrigin = 'message' | 'payload' | 'limit';

/**
 * A report as the adapter observed it. Only the code is required; a field the
 * adapter supplies is held to what the case expects of it, and one it leaves
 * out is not checked, because section 14.3 prescribes no channel and no shape.
 */
export type Report = {
  code: ReportCode;
  origin?: ReportOrigin;
  id?: unknown;
  limit?: number;
};

/**
 * What a resolution produced. `reports` left undefined says the adapter does
 * not observe reports at all, and every expectation about them is skipped.
 */
export type Resolved = {
  output: string;
  reports?: Report[];
};

/**
 * The adapter of section 14.3: what an implementation supplies so the set can
 * drive it. `levels` selects the fixtures the set runs, and `limits` derives
 * the cases that sit at a boundary, so both are the implementation's own
 * statements about itself made observable.
 */
export type Adapter = {
  levels: readonly Level[];
  limits: Limits;
  resolve: (input: Resolution) => Resolved;
};

/** A section reference: a heading number of SPEC.md, such as `9.2` or `A.4`. */
export type Section = string;

/** A formatting request whose result on the running host is the expected output. */
export type FormatRequest = {
  api: 'NumberFormat' | 'DateTimeFormat' | 'RelativeTimeFormat';
  options?: Record<string, unknown>;
  input: unknown;
};

export type ExpectedReport = {
  code: ReportCode;
  origin: ReportOrigin;
  /** Text, compared as written: a tagged value is read on a case's inputs, never in its expectations. */
  id?: string;
};

export type Expected = {
  output?: string;
  format?: FormatRequest;
  reports?: ExpectedReport[];
};

/** A case written out in a fixture file, its inputs still JSON: tagged values not yet decoded. */
export type ConcreteCase = {
  id: string;
  description: string;
  section?: Section;
  message: unknown;
  payload?: Record<string, unknown>;
  props?: Record<string, unknown>;
  locale?: string;
  /** The message's id (section 4). Spelled out because a case's own `id` names the case. */
  messageId?: unknown;
  modifiers?: Record<string, Behaviour>;
  defaults?: Record<string, unknown>;
  expected: Expected;
};

export type Generator = 'passes-at-limit' | 'passes-over-limit' | 'output-at-limit' | 'output-over-limit' | 'output-over-limit-stops' | 'conversion-over-limit';

/** A case the runner builds from the adapter's limits. */
export type GeneratedCase = {
  id: string;
  description: string;
  section?: Section;
  generate: Generator;
};

export type Case = ConcreteCase | GeneratedCase;

export type FixtureFile = {
  format: 'curly-message-1';
  level: Level;
  section: Section;
  cases: Case[];
};

/** A fixture file together with the name it is shipped under. */
export type Fixture = {
  name: string;
  file: FixtureFile;
};

/** The manifest shipped as `index.json`. */
export type Manifest = {
  format: 'curly-message-1';
  version: string;
  files: { path: string; level: Level; section: Section; cases: number }[];
};

export type Failure = {
  ok: false;
  reason: string;
  expected: unknown;
  actual: unknown;
};

/**
 * What running a case answered. A passing outcome carries `unobserved` where
 * the adapter left `reports` undefined: the case passed on its output alone,
 * and its report expectation was not checked.
 */
export type Outcome = { ok: true; unobserved?: 'reports' } | Failure;

/** A case ready to run: what identifies it, and the call that runs it. */
export type Planned = {
  id: string;
  file: string;
  level: Level;
  section: Section;
  description: string;
  execute: () => Outcome;
};

/** A case the plan left out, and why. */
export type Skipped = {
  id: string;
  file: string;
  level: Level;
  section: Section;
  description: string;
  reason: string;
};

export type Plan = {
  cases: Planned[];
  skipped: Skipped[];
};

export type Options = {
  /** The fixtures to run; the shipped set when omitted. */
  fixtures?: Fixture[];
  /** Run only these levels, among those the adapter claims. */
  levels?: readonly Level[];
};

export type Result = {
  passed: Planned[];
  failed: (Planned & { outcome: Failure })[];
  skipped: Skipped[];
  /** The cases among `passed` whose report expectation went unchecked, because the adapter observes no reports. */
  unobserved: Planned[];
};
