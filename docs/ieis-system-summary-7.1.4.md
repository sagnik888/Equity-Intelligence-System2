# IEIS current system summary — specification 7.1.4

**Review basis:** Full text of `IEIS_7_1_4_Corrected_Master_Specification_1792012294842.docx` and the current application source, database schema, API contract, seed data, and dashboard.

**Authority:** The 7.1.4 correction/addendum is the controlling specification. Where it changes or narrows earlier 7.1.3/7.1.2 requirements, use the 7.1.4 rule. Older formula or workflow descriptions are not independent permission to take action.

## Current system in one paragraph

IEIS is a research and alert-oriented dashboard backed by a single API and PostgreSQL schema. It currently runs on deterministic seeded demonstration data, with scoring, five horizon labels, research, portfolio views, formula metadata, governance registries, audit/history views, and seeded backtest records. It does **not** have licensed production market-data coverage, a complete point-in-time data pipeline, approved investment validation, authenticated execution controls, an exchange/broker instrument master, a broker adapter, or a transactional order outbox. Effective execution stays disabled; order-intent creation returns a blocked response; position sizing returns a zero final quantity; seeded signals are preview-only and non-actionable. These controls prevent the current demo from being presented as a trading-ready system.

## Effective operating and validation state

| State | Current value | Meaning |
| --- | --- | --- |
| Data | `demo_only` | Seeded records are not licensed, live, or certified point-in-time source data. |
| Architecture/code | Implemented, not certified | A working app and passing code checks do not establish investment or operational readiness. |
| Model/formula | Not investment-validated | Formula helpers and registry metadata are not a validated investment model. |
| Investment | `not_validated` | No source-backed out-of-sample evidence or approved investment release is present. |
| Effective execution | `alert_only`; live disabled | Configuration cannot enable a missing/unauthorized execution path. |
| Entry safety | `emergency_block_entries` | No live disk telemetry, approved reserve/hysteresis thresholds, and reviewed resource state are configured. |
| Paper trading | Not enabled | Seeded portfolio rows and order-intent schema do not constitute an accepted paper-trading system. |
| Live orders | Blocked | No authenticated account context, verified signed policy, broker rules/adapter, or reconciliation path exists. |

The configured `live_execution_enabled` value, if changed outside the supported UI, is reported separately from the effective value. The effective API response remains false.

## 7.1.4 changes and implementation status

| Change | Requirement summary | Current implementation | Remaining gap |
| --- | --- | --- | --- |
| N01 — exact booleans | Accept booleans only; reject `0/1`, strings, null, and truthy coercions for safety decisions. | `exactBoolean` is used by resource, candle-seal, session, and signal-eligibility controls; unit tests reject coercible values. Order quantity validation also rejects numeric strings. | Apply a complete exact-type audit to every safety-related API and persisted setting. |
| N02 — final quantity | Final quantity is the minimum of the risk, liquidity, company, sector, group, horizon, event, correlation, cash/margin, gross, net, F&O, drawdown, and account-risk residual caps; positions and pending commitments must be reconciled. | The safety helper requires every cap and floors the minimum to a lot multiple; tests cover all 14 cap inputs. The sizing endpoint exposes a demo estimate only and always returns `final_quantity: 0`. | Build reconciled position/commitment snapshots, all residual-cap calculations, and policy-sourced inputs before any nonzero result is permitted. |
| N03 — order-policy evidence | Order permission must be supported by signed, dated, scoped account/broker/exchange/segment/session/order/product/strategy/origin and algorithm-registration/static-IP evidence. | A broker order-policy evidence table records the required fields. Order-intent creation is blocked. | No signing trust store, cryptographic verifier, policy review workflow, current broker confirmation, or approved policy record exists. A boolean `signature_verified` field is not proof of cryptographic verification. |
| N04 — lot sizes | Lot size must be a positive integer; quantities must round down to a whole lot. | Positive-safe-integer validation and `floorToLot` exist with unit tests. | No authoritative effective-dated exchange/broker instrument-master source is connected; the helper is not used to produce any executable quantity. |
| N05 — resource emergency | Invalid or absent resource telemetry blocks entries; recovery needs reserve plus hysteresis and an explicit health review. | `evaluateDiskResourceState` fails closed. Governance reports entries blocked and requires review when telemetry or policy is absent. | Host telemetry, persisted thresholds, health-review workflow, and critical-workload prioritization are not connected. |
| N06 — candle finality | A completed candle requires exact flags, calendar confirmation, complete observations, verified checksum, no source conflict, timezone-aware timestamps, and a provider watermark beyond the seal delay. | `evaluateCandleSeal` implements these checks and has tests for conflict, watermark delay, timezone, and strict booleans. | No production bar store, licensed provider watermark, exchange-calendar feed, checksum pipeline, or reconciliation process exists. Seeded bars/signals are not sealed. |
| N07 — NSE CAS phases | Session classification must honor calendar, CAS membership, phase boundaries, and stricter broker restrictions. | A conservative phase classifier and input validation exist. It is not connected to an order route. | Membership and session schedules must come from effective-dated authoritative exchange/broker sources. The specification’s phase table is not a live exchange feed or broker permission. |
| N08 — actionable signals | Licensed source, sealed data, no Level-1 gate, approved strategy, and configured data/signal confidence minimums are all prerequisites; scores alone are not permission. | Eligibility and actionable-score helpers fail closed and are tested. API signal objects include lifecycle/provenance and `actionable`; seeded rows are marked `preview_only`, and dashboard labels them research preview/no action. | No licensed source, seal service, complete gate linkage, approved strategy, or governed confidence threshold is available. All present signals remain non-actionable. |
| N09 — duplicate-safe business identity | Stable SHA-256 business-action identity and uniqueness by account/action; retries reuse intent; partial-fill residuals require authorized lineage. | Canonical SHA-256 identity helper exists. Schema has unique business-key fields, reservation/outbox tables, and fill/lot records. | No database transaction joining reservation, intent, audit, and outbox; no dispatcher, broker idempotency, partial-fill lineage workflow, or reconciliation worker. The paper-intent endpoint is blocked. |
| N10 — risk policy source | Do not treat a default cap such as 1% as live policy; risk comes from an authenticated, signed, dated account/strategy/instrument-class policy. | The implicit 1% risk default was removed from position sizing. The endpoint requires an explicit risk input to produce a clearly labeled legacy demo estimate; it never returns a nonzero final quantity. | No authenticated risk-policy approval/verification workflow or production policy exists. The 1% figure in the specification remains an offline illustration only. |
| N11 — formula expressions | Only a bounded, whitelisted set of deterministic callable expressions with synthetic test vectors; no Python `eval`; no formula becomes production-approved without units, PIT, property, and investment validation. | Existing formula registry/helpers remain available; no arbitrary expression evaluation was added. | Verify the complete 26-expression whitelist and vectors against the master, then add units/PIT/property tests and approval linkage. No formula is certified for production investment use. |
| N12 — quantitative release gates | Release evidence must be quantitative, reproducible, and fail closed on unknowns; arbitrary session, latency, or profitability claims are not certification. | Governance distinguishes demo data, investment validation, and blocked execution. Backtest factor output no longer invents statistics when no run exists. | No reproducible PIT validation suite, complete acceptance-gate evidence, independent review, or release approval exists. |

## Features currently present

- **Dashboard and navigation:** Overview, Signals, Scores, Universe/company, Rankings, Research, Portfolio, Watchlists, Audit, Backtest, and governance-oriented views.
- **Universe and demo fundamentals:** ISIN-keyed security rows with sample financial and market fields. Coverage reporting compares the seeded set with a 2,000-security target; the target is not live coverage.
- **Scores and rankings:** Candidate scoring, data-confidence fields, ranking dimensions, score history, hard-gate caps, and score distribution. Inputs are demo/proxy data and not certified for investment decisions.
- **Signals:** Daily, weekly, monthly, medium, and long horizon rows; seeded score/state history; penalties and gate cap; lifecycle and provenance schema; explicit preview/no-action UI.
- **Research and evidence:** Research score, component/evidence structures, and history. Analyst, forecast, scenario, valuation, and promotion workflows remain incomplete.
- **Portfolio:** Demo/manual position views, portfolio summary, review list, suitability, and an estimate endpoint. These are not an account/broker reconciliation ledger.
- **Governance:** Formula metadata, data source/license/connector/model/feature/gate/resource/job registries, plus a status endpoint. Registries may be empty or demo-only; their presence is not evidence of live approval.
- **Backtest:** Seeded run summaries and metric fields. Factor analysis reports `not_computed` rather than returning fabricated statistics without an actual reproducible run.
- **Database safety scaffolding:** Effective-dated controls and order-policy evidence schemas, risk reservations, outbox, broker attempts/fills, and virtual lots. These schemas do not imply active order handling.
- **Demo operation:** Fixed seed/reference date and guarded destructive reset (`IEIS_ALLOW_DEMO_RESET=true` in non-production only).

## Changes integrated for 7.1.4

1. Added strict safety helpers for exact booleans, all required quantity-cap fields, lot rounding, resource state, candle sealing, session phases, signal eligibility, actionable-score suppression, and canonical business-action hashing.
2. Added database structures for account/strategy risk policy, broker order policy, reservations, transactional-outbox records, broker attempts/fills, virtual lots, and signal lifecycle/provenance.
3. Marked every seeded signal `preview_only`, unsealed, incomplete-bar, and accompanied by a reason; surfaced lifecycle, provenance, and a persistent research-preview/no-action label in the Signals page.
4. Disabled order-intent creation with HTTP 409 and explicit blocking reasons; request quantity validation no longer coerces strings to numbers.
5. Changed position sizing to remove the 1% default, remove the fabricated missing-liquidity fallback, expose only an optional legacy demo estimate, and always return zero as the final/non-executable quantity.
6. Changed governance to report effective live execution as disabled and new entries as blocked until valid resource policy and review exist.
7. Added deterministic unit tests for exact booleans, lot sizing, complete caps, resource blocking/recovery, candle sealing, signal eligibility, actionable scores, and business-action identity.
8. Regenerated OpenAPI-derived clients and validators after the contract updates.
9. Corrected the persisted demo model record to pending review, changed seeded release gates to warning/unapproved, and replaced the “system fully operational” alert with an explicit demo/research-only notice; no seed reset or table clearing was used.

## Remaining work, in dependency order

### 1. Licensed source and point-in-time data foundation

- Connect a user-authorized source only after permitted use, retention, display/derived-data rights, and contract scope are recorded.
- Build source health/retry/circuit-breaker/schema/checksum/gap/dead-letter handling and an authoritative exchange calendar.
- Add company/listing/instrument/derivative/document/bar identities; raw immutable payload metadata; economic-time and knowledge-time facts; revision lineage; source precedence; quarantine; reconciliation; corporate-action adjustments; and historical status/sector/index membership.
- Build provider watermarks, sealed-candle construction, and source conflict detection. Until then, no signal can pass data eligibility.

### 2. Model and signal lifecycle

- Reconcile all formula/expression definitions and synthetic vectors against the complete specification; add unit, property, missing-data, PIT, and edge-case tests.
- Replace proxy/demo scoring inputs with source-backed, versioned features, sector models, percentile normalization, and approved formula/model links.
- Implement full hard-gate review and evidence linkage.
- Implement signal lifecycle transitions, confirmation timing, validity/expiry, cooldown, hysteresis, regime/catalyst context, cross-horizon policy, and durable state history.
- Persist configured confidence minimums and all eligibility provenance; keep signal state and action eligibility separate.

### 3. Risk and order control

- Add authenticated users/roles, approval identities, effective signed risk policies, cryptographic signature verification, instrument lot sizes, exchange/broker constraints, and per-account reconciliation.
- Calculate every N02 residual cap from reconciled positions plus pending commitments, including cash/margin, gross/net, derivatives, drawdown, event, correlation, and portfolio group limits.
- Add CAS membership/calendar source with broker overrides, explicit order-type rules, and source freshness.
- Only after separate paper-trading acceptance, add a transactional database outbox, persistent retry state, duplicate-safe intent lifecycle, partial-fill residual lineage, simulated fills, cancellation, reconciliation, and failover.
- Keep live broker execution separately disabled until data, investment, security, operations, and execution release gates all pass.

### 4. Backtesting, release gates, and operations

- Replace seeded outcomes with reproducible point-in-time walk-forward data and survivor-controlled universes, filing lag, corporate actions, costs, slippage, liquidity impact, taxes, and signal expiry.
- Add uncertainty intervals, regime/subperiod analysis, parameter sensitivity, deflated Sharpe/probability-of-overfitting measures, factor redundancy, and exposure analysis.
- Implement quantitative acceptance evidence and unknown-is-fail release evaluation; do not assert arbitrary latency/profitability/session thresholds as certified without review.
- Add active resource telemetry/policy and health review, prioritization, persistent jobs/quotas, backup/restore drills, retention/RPO/RTO evidence, immutable audit, security review, and environment separation.

### 5. Product surfaces

- Complete Data Quality, Orders/Broker, Resources/Jobs, Settings, Reports, Security/RBAC, and model-governance pages.
- Expand Governance, Signals, Research, Company Detail, Audit, Universe, Portfolio, and Backtest with state history, provenance, approvals, unavailable/demo states, and accessible empty/error handling.
- Add contract/integration/route tests and responsive-navigation checks.

## Release boundary

The attached 7.1.4 spec authorizes research-only/alert-only as pre-release modes; the current implementation must not be described as validated paper trading. Neither seeded data nor passing helper tests establish data rights, investment merit, exchange permission, operational resilience, or live execution readiness. The companion reference code mentioned in the specification was not attached as a separate workspace asset and is not treated as implemented project code.
