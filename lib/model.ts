// Token Radar — the value model (radar-3).
//
// One sealed snapshot in, one ranked board out. Every number below is derived
// from the snapshot's own figures; no protocol name is ever special-cased and
// the same function scores every row.
//
// The question the board answers: if a protocol that records no token issued
// one tomorrow and the market priced it like the tokens that already trade,
// what would it be worth? The anchor is the market itself: the 128
// live-token protocols that carry both a market cap and a TVL.
//
// THE FITTED MODEL. The market-cap-to-TVL ratio is fitted, not assumed. On
// the 128 anchors we fit, by ordinary least squares,
//
//   log(mcap_usd / tvl_usd) = a + b * log(tvl_usd)
//
// The fit is computed from the snapshot at run time (fitLogRatio); the
// dashboard prints the fitted a and b. The slope is negative: the bigger a
// protocol's TVL, the lower the market-cap multiple the market pays for it
// (correlation between log TVL and log ratio is about -0.41). Two richer
// variants were tried and REJECTED by out-of-sample testing, and the code
// still computes their scores so the dashboard can show the comparison:
//   * category dummies (one per big category, ridge lambda 1): in-sample
//     R^2 0.22, but leave-one-out R^2 0.09 — it overfits the thin categories.
//   * shrunk category-median ratios (median log ratio per category, shrunk
//     toward the global median by n/(n+3)): leave-one-out R^2 -0.06.
// The kept fit wins on leave-one-out R^2 (about 0.14) and on the
// walk-forward split (train on the oldest-listed 70% of anchors, test on
// the newest-listed 30%: R^2 about 0.22).
//
// HONEST LIMITS. The market is noisy: the fitted model explains only ~14%
// of the out-of-sample variance of log value, and the median absolute
// percentage error on a held-out anchor is about 85%. The dashboard states
// those numbers plainly next to the fit. The board therefore ranks by the
// fitted central estimate and shows, per row, the nearest live comps in the
// same category, so a reader can see how wide the market's own spread is.
// Three small priors then adjust the fitted ratio, exactly as stated in the
// dashboard: growth (the protocol's own 7-day TVL change, clamped to
// -60%..+120%, half weight), maturity (age since DefiLlama began tracking
// it, 0.6 rising to 1.0 over 3 years) and breadth (+3% per extra chain, at
// most +15%). They are priors, not fitted coefficients, and the dashboard
// says so.
//
//   implied_value_usd = round(tvl_usd * fitted_ratio * growthMult * maturityMult * breadthMult)
//
// COVERAGE. The board ranks ALL 758 snapshot protocols, in one descending
// order by implied value. Pre-token protocols are valued by the fitted
// model; live-token protocols with a market cap are valued at their actual
// market cap (the market's own value, never a model guess); live-token
// protocols with no market cap in the snapshot are valued by the fitted
// model and marked as such. The dashboard separates the two worlds with a
// view toggle and defaults to the pre-token radar. A pre-token protocol
// that fails the watchlist's own rule (a CEX, a bridge, a wrapped or staked
// product) is still ranked and still covered, but is marked launch_candidate
// false: farm it for yield and points, not for a new token. A protocol
// "records no token" in DefiLlama's record — that is never a claim that it
// has none.

/** One protocol entry: exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  min_peers: number;
  ratio_floor: number;
  ratio_cap: number;
  ridge_lambda: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.03,
  breadth_max_chains: 5,
  min_peers: 3,
  ratio_floor: 0.01,
  ratio_cap: 2,
  ridge_lambda: 1,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3-fitted';

/** The big categories that get a dummy in the rejected richer fit. */
export const FIT_CATEGORIES = ['Lending', 'Dexs', 'Liquid Staking', 'Yield', 'CEX', 'RWA', 'Canonical Bridge', 'Basis Trading', 'Bridge'];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One live-token comp shown in a row's "why this value" breakdown. */
export interface Comp {
  slug: string;
  name: string;
  category: string | null;
  ratio: number;
  tvl_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  view_rank: number;
  cand_rank: number | null;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token' | 'live' | 'live-no-mcap';
  value_basis: 'fitted' | 'market-cap' | 'fitted-no-mcap';
  launch_candidate: boolean;
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    fitted_ratio: number;
    cat_median_ratio: number | null;
    peer_ratio: number;
    peer_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  comps: Comp[];
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  view_rank: number;
  cand_rank: number | null;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  token_status: 'pre-token' | 'live' | 'live-no-mcap';
  value_basis: 'fitted' | 'market-cap' | 'fitted-no-mcap';
  launch_candidate: boolean;
  fitted_ratio: number;
  cat_median_ratio: number | null;
  peer_ratio: number;
  peer_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  on_watchlist: boolean;
  comps: Comp[];
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl_ratio: number | null;
}

/** One peer-ratio anchor, for the dashboard's methodology panel. */
export interface PeerAnchor {
  category: string;
  peer_count: number;
  median_ratio: number;
}

/** One validation score: R^2, mean absolute log error and median absolute percentage error. */
export interface ValidationStats {
  r2: number;
  mae_log: number;
  med_ape: number;
  n: number;
}

/** The fitted model's validation, computed from the snapshot at run time. */
export interface Validation {
  anchors: number;
  fitted_loo: ValidationStats;
  fitted_walkforward: ValidationStats;
  dummy_loo: ValidationStats;
  dummy_walkforward: ValidationStats;
  baseline_loo: ValidationStats;
  baseline_walkforward: ValidationStats;
  walkforward_train: number;
  walkforward_test: number;
}

/** The fitted coefficients, computed from the snapshot at run time. */
export interface FittedModel {
  intercept: number;
  slope: number;
  dummy_intercept: number;
  dummy_slope: number;
  dummy_effects: { category: string; effect: number }[];
  global_log_ratio: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  pre_token_size: number;
  live_size: number;
  live_mcap_size: number;
  launch_candidate_size: number;
  early_size: number;
  total_implied_usd: number;
  total_implied_pre_usd: number;
  median_implied_pre_usd: number;
  top_category: string;
  top_category_implied_usd: number;
  global_ratio: number;
  fitted: FittedModel;
  validation: Validation;
  peers: PeerAnchor[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty sorted list. */
export function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol records a token but the snapshot carries no market cap for it. */
export function isLiveNoMcap(p: SnapshotProtocol): boolean {
  return !isPreToken(p) && !(typeof p.mcap_usd === 'number' && p.mcap_usd > 0);
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that move an asset whose token already trades, never a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A whole word wrapped, staked or staking in a name: a product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a pre-token protocol is a launch candidate: pre-token, and not a
 * wrapped, staked or bridged product of a protocol whose token already
 * trades — the watchlist's own rule. Non-candidates are still ranked and
 * still covered; they are only marked, never dropped.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The live-token anchors: protocols carrying both a market cap and a TVL. */
export function anchorsOf(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    const tmp = M[col]!;
    M[col] = M[piv]!;
    M[piv] = tmp;
    const d = M[col]![col]!;
    if (Math.abs(d) < 1e-12) throw new SnapshotError('fitted model: singular design matrix');
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / d;
      for (let k = col; k <= n; k++) M[r]![k]! -= f * M[col]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** Ridge least squares: beta = (X'X + lambda*I)'s inverse times X'y; the intercept is never penalised. */
export function ridgeFit(X: number[][], y: number[], lambda: number): number[] {
  const k = X[0]!.length;
  const A: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const b: number[] = Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < k; a++) {
      b[a]! += X[i]![a]! * y[i]!;
      for (let c = 0; c < k; c++) A[a]![c]! += X[i]![a]! * X[i]![c]!;
    }
  }
  for (let a = 1; a < k; a++) A[a]![a]! += lambda;
  return solveLinear(A, b);
}

/** The kept fit's features: [1, log TVL]. */
function fitFeatures(p: SnapshotProtocol): number[] {
  return [1, Math.log(p.tvl_usd)];
}

/** The rejected richer fit's features: [1, log TVL, one dummy per big category]. */
function dummyFeatures(p: SnapshotProtocol): number[] {
  return [1, Math.log(p.tvl_usd), ...FIT_CATEGORIES.map((c) => (p.category === c ? 1 : 0))];
}

/** log(mcap / TVL) for an anchor. */
function logRatio(p: SnapshotProtocol): number {
  return Math.log(p.mcap_usd! / p.tvl_usd);
}

/** The shrunk category-median log ratio: the category median blended toward the global median by n/(n+3). */
export function shrunkCatMedian(train: SnapshotProtocol[], category: string | null): number {
  const all = train.map(logRatio).sort((a, b) => a - b);
  const global = median(all);
  const key = category ?? '(no category)';
  const inCat = train.filter((p) => (p.category ?? '(no category)') === key).map(logRatio).sort((a, b) => a - b);
  if (inCat.length === 0) return global;
  const w = inCat.length / (inCat.length + 3);
  return w * median(inCat) + (1 - w) * global;
}

/** R^2, mean absolute log error and median absolute percentage error of predictions against actual log ratios. */
export function validationStats(predicted: number[], actual: number[]): ValidationStats {
  const n = actual.length;
  const mean = actual.reduce((a, b) => a + b, 0) / n;
  let ss = 0;
  let st = 0;
  let ae = 0;
  const errs: number[] = [];
  for (let i = 0; i < n; i++) {
    const e = predicted[i]! - actual[i]!;
    ss += e * e;
    st += (actual[i]! - mean) ** 2;
    ae += Math.abs(e);
    errs.push(Math.abs(Math.exp(predicted[i]!) - Math.exp(actual[i]!)) / Math.exp(actual[i]!));
  }
  errs.sort((a, b) => a - b);
  return { r2: Math.round((1 - ss / st) * 1000) / 1000, mae_log: Math.round((ae / n) * 1000) / 1000, med_ape: Math.round(median(errs) * 1000) / 1000, n };
}

/**
 * Leave-one-out validation of an estimator: refit on all anchors but one,
 * predict the held-out anchor, repeat. `fit` takes a training set and
 * returns a predictor for a protocol's log ratio.
 */
export function leaveOneOut(anchors: SnapshotProtocol[], fit: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): ValidationStats {
  const predicted: number[] = [];
  const actual: number[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const train = anchors.filter((_, j) => j !== i);
    predicted.push(fit(train)(anchors[i]!));
    actual.push(logRatio(anchors[i]!));
  }
  return validationStats(predicted, actual);
}

/**
 * Walk-forward validation: fit on the oldest-listed 70% of anchors (by
 * listed_at), test on the newest-listed 30%. Anchors with no listed date
 * sit out of this split; the counts are reported with the scores.
 */
export function walkForward(
  anchors: SnapshotProtocol[],
  fit: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number,
): { stats: ValidationStats; train: number; test: number } {
  const withDate = anchors.filter((p) => p.listed_at !== null && Number.isFinite(Date.parse(`${p.listed_at}T00:00:00Z`)));
  const sorted = [...withDate].sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : 0));
  const cut = Math.floor(sorted.length * 0.7);
  const train = sorted.slice(0, cut);
  const test = sorted.slice(cut);
  const predict = fit(train);
  const stats = validationStats(test.map(predict), test.map(logRatio));
  return { stats, train: train.length, test: test.length };
}

/** The kept fit, as a predictor: log ratio from log TVL. */
function fitKept(train: SnapshotProtocol[]): (p: SnapshotProtocol) => number {
  const beta = ridgeFit(train.map(fitFeatures), train.map(logRatio), 1e-6);
  return (p) => beta[0]! + beta[1]! * Math.log(p.tvl_usd);
}

/** The rejected category-dummy fit, as a predictor. */
function fitDummy(train: SnapshotProtocol[]): (p: SnapshotProtocol) => number {
  const beta = ridgeFit(train.map(dummyFeatures), train.map(logRatio), MODEL.ridge_lambda);
  return (p) => dummyFeatures(p).reduce((sum, v, i) => sum + v * beta[i]!, 0);
}

/** The rejected shrunk category-median baseline, as a predictor. */
function fitBaseline(train: SnapshotProtocol[]): (p: SnapshotProtocol) => number {
  return (p) => shrunkCatMedian(train, p.category);
}

/**
 * Fit the model and validate all three estimators on the anchors. The kept
 * fit is the log-TVL one; the other two are computed only so the dashboard
 * can show, honestly, that they were tried and lost out of sample.
 */
export function fitAndValidate(snapshot: Snapshot): { fitted: FittedModel; validation: Validation } {
  const anchors = anchorsOf(snapshot);
  if (anchors.length < 10) throw new SnapshotError(`only ${anchors.length} live-token anchors: the fitted model needs at least 10`);
  const beta = ridgeFit(anchors.map(fitFeatures), anchors.map(logRatio), 1e-6);
  const dummyBeta = ridgeFit(anchors.map(dummyFeatures), anchors.map(logRatio), MODEL.ridge_lambda);
  const allLog = anchors.map(logRatio).sort((a, b) => a - b);
  const fitted: FittedModel = {
    intercept: Math.round(beta[0]! * 1000) / 1000,
    slope: Math.round(beta[1]! * 1000) / 1000,
    dummy_intercept: Math.round(dummyBeta[0]! * 1000) / 1000,
    dummy_slope: Math.round(dummyBeta[1]! * 1000) / 1000,
    dummy_effects: FIT_CATEGORIES.map((c, i) => ({ category: c, effect: Math.round(dummyBeta[i + 2]! * 1000) / 1000 })),
    global_log_ratio: Math.round(median(allLog) * 1000) / 1000,
  };
  const wfKept = walkForward(anchors, fitKept);
  const wfDummy = walkForward(anchors, fitDummy);
  const wfBase = walkForward(anchors, fitBaseline);
  const validation: Validation = {
    anchors: anchors.length,
    fitted_loo: leaveOneOut(anchors, fitKept),
    fitted_walkforward: wfKept.stats,
    dummy_loo: leaveOneOut(anchors, fitDummy),
    dummy_walkforward: wfDummy.stats,
    baseline_loo: leaveOneOut(anchors, fitBaseline),
    baseline_walkforward: wfBase.stats,
    walkforward_train: wfKept.train,
    walkforward_test: wfKept.test,
  };
  return { fitted, validation };
}

/**
 * The peer anchors: for every category, the median mcap/TVL ratio of its
 * live-token protocols, plus the global median across all of them. Ratios
 * are clamped so a thin category cannot produce an absurd multiple. These
 * are the per-row "category peer median" reference, not the fitted value.
 */
export function peerAnchors(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, { ratio: number; count: number }>; global: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = Math.min(model.ratio_cap, Math.max(model.ratio_floor, p.mcap_usd / p.tvl_usd));
    all.push(ratio);
    const key = p.category ?? '(no category)';
    const list = byCategory.get(key) ?? [];
    list.push(ratio);
    byCategory.set(key, list);
  }
  all.sort((a, b) => a - b);
  const global = all.length > 0 ? median(all) : 0.25;
  const out = new Map<string, { ratio: number; count: number }>();
  for (const [key, list] of byCategory) {
    list.sort((a, b) => a - b);
    out.set(key, { ratio: median(list), count: list.length });
  }
  return { byCategory: out, global };
}

/** The peer ratio one protocol is anchored to: its category's median, or the global median. */
export function peerRatioFor(
  p: SnapshotProtocol,
  anchors: { byCategory: Map<string, { ratio: number; count: number }>; global: number },
  model: ModelConstants,
): { ratio: number; category: string | null; count: number } {
  const key = p.category ?? '(no category)';
  const hit = anchors.byCategory.get(key);
  if (hit !== undefined && hit.count >= model.min_peers) return { ratio: hit.ratio, category: p.category, count: hit.count };
  return { ratio: anchors.global, category: null, count: 0 };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The fitted mcap/TVL ratio for a protocol, from the kept fit, clamped to the model's ratio band. */
export function fittedRatio(p: SnapshotProtocol, fitted: FittedModel, model: ModelConstants = MODEL): number {
  const logRatioHat = fitted.intercept + fitted.slope * Math.log(p.tvl_usd);
  return Math.min(model.ratio_cap, Math.max(model.ratio_floor, Math.exp(logRatioHat)));
}

/** The multipliers and the fitted implied value one pre-token protocol gets. */
export function fittedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fitted: FittedModel,
  model: ModelConstants,
): { implied: number; ratio: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const ratio = fittedRatio(protocol, fitted, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  const breadthMult = 1 + model.breadth_per_chain * extraChains;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * ratio * growthMult * maturityMult * breadthMult));
  return { implied, ratio, growthPct, growthMult, maturityMult, breadthMult, age };
}

/**
 * The three nearest live-token comps: the nearest in the same category
 * first, topped up with the nearest overall when the category holds fewer
 * than three anchors, so a thin category still shows the market's spread.
 */
export function nearestComps(p: SnapshotProtocol, anchors: SnapshotProtocol[]): Comp[] {
  const target = Math.log(p.tvl_usd);
  const byDistance = (a: SnapshotProtocol, b: SnapshotProtocol): number =>
    Math.abs(Math.log(a.tvl_usd) - target) - Math.abs(Math.log(b.tvl_usd) - target) || (a.slug < b.slug ? -1 : 1);
  const toComp = (a: SnapshotProtocol): Comp => ({
    slug: a.slug,
    name: a.name,
    category: a.category,
    ratio: Math.round((a.mcap_usd! / a.tvl_usd) * 100) / 100,
    tvl_usd: a.tvl_usd,
  });
  const picked: Comp[] = [];
  const seen = new Set<string>();
  for (const a of [...anchors.filter((a) => a.category === p.category)].sort(byDistance)) {
    if (picked.length >= 3) break;
    picked.push(toComp(a));
    seen.add(a.slug);
  }
  for (const a of [...anchors].sort(byDistance)) {
    if (picked.length >= 3) break;
    if (seen.has(a.slug)) continue;
    picked.push(toComp(a));
    seen.add(a.slug);
  }
  return picked;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 120;
  return 60;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The setup gas for a position, from its size. */
function setupGas(capital: number): number {
  return capital >= 150 ? 8 : 4;
}

/** The category's core action, in the words a farmer can follow. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as a lender, then borrow $20 of USDC against it and repay it the same week so the wallet shows both sides of the market.`;
  if (c.includes('dex') || c.includes('leveraged farm') || c.includes('amm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} — half USDC, half the pool's other asset — and keep the LP position open.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, long $30 and short $30, then close it the same day.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds in one app on the destination chain instead of bridging straight back.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} on ${chain} and place one market position of $10 on an outcome you have read, not a random one.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('vault')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares for the whole hold period.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it for the whole period.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the whole hold period.`;
  if (c.includes('payment') || c.includes('card')) return `Top up $${capital} through ${name} on ${chain} and spend $10 of it on a real payment, keeping the receipt.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC onto ${chain} through ${name} and use it in one native app on that chain.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action. */
function weeklyAction(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'add $10 of supply or repay and re-borrow $10, so the wallet shows fresh lending activity';
  if (c.includes('dex') || c.includes('leveraged farm') || c.includes('amm')) return 'swap $10 through the pool or add $10 of liquidity, so the wallet shows fresh trading activity';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'open and close one $10 hedged trade, so the wallet shows fresh volume without a directional bet';
  if (c.includes('bridge') || c.includes('cross chain')) return 'bridge $10 to another supported chain and use it there, so the wallet shows fresh bridging activity';
  if (c.includes('staking') || c.includes('restak')) return 'claim or restake the staking rewards, so the wallet shows fresh staking activity';
  if (c.includes('prediction')) return 'place one $5 position on a new market, so the wallet shows fresh prediction activity';
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('vault')) return 'deposit another $10 into the vault or claim its yield, so the wallet shows fresh vault activity';
  if (c.includes('stable')) return 'mint or redeem $10 of the stable asset, so the wallet shows fresh stablecoin activity';
  if (c.includes('rwa')) return 'claim the yield the asset earned, so the wallet shows fresh holding activity';
  if (c.includes('insurance')) return 'check the policy and renew or top it up if it lapses, so the cover stays active';
  if (c.includes('payment') || c.includes('card')) return 'make one small real payment through it, so the wallet shows fresh payment activity';
  return 'make one qualifying action, such as a deposit, a swap or a vote, so the wallet stays active';
}

/**
 * A protocol's farm plan. Pre-token launch candidates get 8 steps; other
 * pre-token protocols get 7 with a yield-first note (their upside is yield
 * and points, not a new token); live-token protocols get 7 steps about
 * using the protocol now that its token already trades. Every step names
 * its cost and its time, and step 7/8 budgets the whole plan in gas per
 * hour of work. The plan is derived from the protocol's own record
 * (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const chain2 = p.chains.length > 1 ? p.chains[1]! : null;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = setupGas(capital);
  const weeks = Math.ceil(hold / 7);
  const gasTotal = gas + 2 * weeks;
  const minutesTotal = 15 + 10 * weeks + 15;
  const perHour = Math.round((gasTotal / (minutesTotal / 60)) * 10) / 10;
  const status = isPreToken(p) ? (isLaunchCandidate(p) ? 'pre' : 'pre-noncandidate') : 'live';
  const budget: FarmStep = {
    text: `Budget the whole plan before you start: about $${gasTotal} of gas over ${hold} days for roughly ${minutesTotal} minutes of work — near $${perHour} per hour of your time, before any points or launch value.`,
    cost: `about $${gasTotal} of gas in total`,
    time: `${hold} days, ${minutesTotal} minutes of work`,
  };
  const logStep: FarmStep = {
    text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
    cost: 'nothing but the log',
    time: '5 minutes',
  };
  if (status === 'live') {
    return [
      { text: `Use a fresh wallet that holds only the funds you plan to use, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: `${coreAction(p, capital, chain)} This protocol's token already trades, so the upside here is yield and fees, not a launch.`, cost: `$${capital} of capital and about $${gas} of gas`, time: '15 minutes to set up' },
      { text: chain2 !== null ? `Repeat the same position on ${chain2} with $${Math.round(capital / 2)} so the wallet is active on a second chain.` : `Do a second qualifying action the next day: ${weeklyAction(p)}.`, cost: chain2 !== null ? `$${Math.round(capital / 2)} of capital and about $3 of gas` : 'about $2 of gas', time: '10 minutes' },
      { text: `Once a week, ${weeklyAction(p)}.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
      { text: `Before you withdraw, open the protocol's own rewards page and claim only from the link it publishes; never pay anyone to claim for you.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      budget,
      logStep,
    ];
  }
  if (status === 'pre-noncandidate') {
    return [
      { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: `${coreAction(p, capital, chain)} This one moves an asset that already trades, so farm it for yield and points rather than a new token.`, cost: `$${capital} of capital and about $${gas} of gas`, time: '15 minutes to set up' },
      { text: chain2 !== null ? `Repeat the same position on ${chain2} with $${Math.round(capital / 2)} so the wallet is active on a second chain.` : `Do a second qualifying action the next day: ${weeklyAction(p)}.`, cost: chain2 !== null ? `$${Math.round(capital / 2)} of capital and about $3 of gas` : 'about $2 of gas', time: '10 minutes' },
      { text: `Once a week, ${weeklyAction(p)}.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
      { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      budget,
      logStep,
    ];
  }
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: coreAction(p, capital, chain), cost: `$${capital} of capital and about $${gas} of gas`, time: '15 minutes to set up' },
    { text: chain2 !== null ? `Repeat the same position on ${chain2} with $${Math.round(capital / 2)} so the wallet is active on a second chain.` : `Do a second qualifying action the next day: ${weeklyAction(p)}.`, cost: chain2 !== null ? `$${Math.round(capital / 2)} of capital and about $3 of gas` : 'about $2 of gas', time: '10 minutes' },
    { text: `Once a week, ${weeklyAction(p)}.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    budget,
    logStep,
  ];
}

/** The board: every protocol in the snapshot, strongest first, with ranks 1..n and a within-view rank per status group. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, fit: { fitted: FittedModel } | null = null): BoardRow[] {
  const fitted = fit !== null ? fit.fitted : fitAndValidate(snapshot).fitted;
  const anchors = anchorsOf(snapshot);
  const peerA = peerAnchors(snapshot, model);
  const watch = new Set(snapshot.watchlist);
  const scored = snapshot.protocols.map((p) => {
    const pre = isPreToken(p);
    const liveNoMcap = !pre && !(typeof p.mcap_usd === 'number' && p.mcap_usd > 0);
    const v = fittedValue(p, snapshot.as_of, fitted, model);
    const peer = peerRatioFor(p, peerA, model);
    const implied = pre || liveNoMcap ? v.implied : Math.max(1, Math.round(p.mcap_usd!));
    return {
      p,
      implied,
      value: v,
      peer,
      token_status: (pre ? 'pre-token' : liveNoMcap ? 'live-no-mcap' : 'live') as BoardRow['token_status'],
      value_basis: (pre ? 'fitted' : liveNoMcap ? 'fitted-no-mcap' : 'market-cap') as BoardRow['value_basis'],
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const viewCount = new Map<string, number>();
  let candCount = 0;
  return scored.map((s, i) => {
    const key = s.token_status === 'pre-token' ? 'pre' : 'live';
    const viewRank = (viewCount.get(key) ?? 0) + 1;
    viewCount.set(key, viewRank);
    const candRank = isLaunchCandidate(s.p) ? ++candCount : null;
    const comps = nearestComps(s.p, anchors);
    return {
      rank: i + 1,
      view_rank: viewRank,
      cand_rank: candRank,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: s.token_status,
      value_basis: s.value_basis,
      launch_candidate: isLaunchCandidate(s.p),
      on_watchlist: watch.has(s.p.slug),
      age_days: s.value.age,
      implied_value_usd: s.implied,
      model: {
        fitted_ratio: round4(s.value.ratio),
        cat_median_ratio: s.peer.category !== null ? round4(s.peer.ratio) : null,
        peer_ratio: round4(s.peer.ratio),
        peer_count: s.peer.count,
        growth_pct: s.value.growthPct,
        growth_multiplier: round4(s.value.growthMult),
        maturity_multiplier: round4(s.value.maturityMult),
        breadth_multiplier: round4(s.value.breadthMult),
        age_days: s.value.age,
      },
      comps,
      farm_steps: farmSteps(s.p, s.value.age).map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 12)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl_ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? Math.round((p.mcap_usd / p.tvl_usd) * 100) / 100 : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    view_rank: row.view_rank,
    cand_rank: row.cand_rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    token_status: row.token_status,
    value_basis: row.value_basis,
    launch_candidate: row.launch_candidate,
    fitted_ratio: row.model.fitted_ratio,
    cat_median_ratio: row.model.cat_median_ratio,
    peer_ratio: row.model.peer_ratio,
    peer_count: row.model.peer_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    on_watchlist: row.on_watchlist,
    comps: row.comps,
    // The board's own steps, copied whole: the page shows exactly what board.json holds.
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. The fit and its validation are computed once and shared by the board and the dashboard. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const fit = fitAndValidate(snapshot);
  const board = buildBoard(snapshot, model, fit);
  const { fitted, validation } = fit;
  const live = liveRows(snapshot);
  const anchors = peerAnchors(snapshot, model);
  const peers: PeerAnchor[] = [...anchors.byCategory.entries()]
    .filter(([, v]) => v.count >= model.min_peers)
    .map(([category, v]) => ({ category, peer_count: v.count, median_ratio: round4(v.ratio) }))
    .sort((a, b) => b.peer_count - a.peer_count);
  const preRows = board.filter((r) => r.token_status === 'pre-token');
  const preSorted = [...preRows].sort((a, b) => a.implied_value_usd - b.implied_value_usd);
  const medianPre = preSorted.length > 0 ? preSorted[Math.floor(preSorted.length / 2)]!.implied_value_usd : 0;
  const byCat = new Map<string, number>();
  for (const r of preRows) byCat.set(r.category ?? '(no category)', (byCat.get(r.category ?? '(no category)') ?? 0) + r.implied_value_usd);
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    pre_token_size: preRows.length,
    live_size: board.length - preRows.length,
    live_mcap_size: board.filter((r) => r.token_status === 'live').length,
    launch_candidate_size: board.filter((r) => r.launch_candidate).length,
    early_size: board.filter((r) => !r.on_watchlist && r.token_status === 'pre-token').length,
    total_implied_usd: board.reduce((sum, r) => sum + r.implied_value_usd, 0),
    total_implied_pre_usd: preRows.reduce((sum, r) => sum + r.implied_value_usd, 0),
    median_implied_pre_usd: medianPre,
    top_category: topCat[0],
    top_category_implied_usd: topCat[1],
    global_ratio: round4(anchors.global),
    fitted,
    validation,
    peers,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length !== snapshot.protocols.length) return `the board holds ${board.length} rows for ${snapshot.protocols.length} snapshot protocols: the radar covers the whole universe`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const sorted = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.implied_value_usd > sorted[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && sorted[0]!.implied_value_usd === sorted[sorted.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${sorted[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
