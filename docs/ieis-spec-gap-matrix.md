# IEIS 7.1.4 implementation gap matrix

This is the implementation checklist against the full 7.1.4 corrected master specification. The 7.1.4 correction/addendum overrides conflicting historical 7.1.3/7.1.2 language. It distinguishes implemented controls from production-validation claims. The application remains on seeded demo data in effective alert-only mode; paper order creation and live execution are blocked.

For the full current-state narrative and feature inventory, see [`ieis-system-summary-7.1.4.md`](./ieis-system-summary-7.1.4.md).

## Current status

| Area | Current implementation | Remaining work |
| --- | --- | --- |
| Formula governance | Exact 26-ID allowlist; direct callable reference dispatcher; deterministic synthetic vector per formula; missing-argument rejection; no eval; all entries unapproved | Add independent financial/unit/PIT/property validation, export/hash checks, approval workflow, and formula-version linkage to computed outputs |
| Validation boundary | Governance status separates demo data, investment, and effective execution states; resource gate fails closed without telemetry/policy | Add architecture/code/resource/security gate records, gate history, and quantitative evidence |
| Coverage model | Demo seed is labeled; coverage target is exposed | Add discovery/standard/deep coverage tiers and imports/connectors; no live 2,000-security dataset is present |
| Source rights | Basic source foundation exists | Add license registry, connector contract, request health, raw immutable records, retention checks, and permitted-use blocking |
| Canonical entities | ISIN-backed security table exists | Add company/listing/broker-instrument/derivative identities, identifier history, mapping review, and historical status/sector/index history |
| Point-in-time facts | Basic effective timestamp fact table exists | Add full economic/knowledge-time fields, revision lineage, original/revised views, and PIT selection service |
| Reconciliation | Formula helper exists | Add field-specific reconciliation states, quarantine, source precedence, unit/scope checks, and conflict blocking |
| Financial normalization | Seed snapshot fields exist | Add period/scope/unit/currency/reported-vs-normalized facts and reconciliation adjustments |
| Corporate actions | Basic action table exists | Add complete action types, adjustment factors, share-count history, validation, and canonical price-series handling |
| Feature store | Scores contain some breakdown JSON | Add versioned feature definitions/values, publication lag, staleness, outlier, negative-base, and cache controls |
| Scoring | Candidate score and confidence shrinkage exist | Correct weight alignment, percentile normalization, sector routing, sector-specific facts/models, and missing-data safety |
| Signals | Five horizons, score bands, lifecycle/provenance fields, non-actionable preview labeling, and a read-only fail-closed transition engine exist | Connect to licensed sealed inputs; persist append-only transitions; add regime/catalyst/next-session evidence and cross-horizon policy |
| Research/evidence | Research scores and evidence ledger exist | Add full evidence taxonomy, affected forecast/valuation fields, management guidance, research promotion, forecast/scenario/valuation workflows |
| Portfolio | Demo positions, suitability inputs, fail-closed size preview, and blocked order-intent API exist; order-control storage scaffolding is present | Add full policy-sourced residual caps, position intent, costs/distributions/tax lots, accepted paper lifecycle, fills, reconciliation, failover, and broker classification |
| Backtesting | Seeded results and rich metric columns exist | Replace fabricated factor data with reproducible PIT walk-forward runs, costs/liquidity/survivorship controls, and validation status |
| Dashboard | Core dashboard, signals, research, portfolio, watchlists, audit, backtest pages exist | Add data quality, model governance, resources, orders/broker, settings, and expanded overview/signal/company/audit surfaces |
| Security/RBAC | Effective live execution disabled; order creation blocked; secrets are environment-managed | Add authenticated roles, privileged action checks, immutable audit events, redaction, and environment separation |
| Resources | Missing telemetry/reserve policy produces emergency entry block | Add live resource metrics, workload modes, persistent jobs, approved safety thresholds, health review, and low-memory/low-storage behavior |
| Backup/recovery | No application-owned backup/restore evidence | Add backup configuration/status, restore-test records, retention metadata, and release gate |
| Model governance | Formula version is exposed | Add champion/challenger/experimental registry, approvals, shadow comparisons, deployments, and rollback |
| API/versioning | OpenAPI source and generated clients exist | Add versioned `/api/v1` surface or document compatibility bridge and add missing endpoints/contracts |
| Testing/release gates | Formula and safety reference tests run; quantitative release evaluator is fail-closed and visible in Governance | Add reviewed thresholds and signed/reproducible evidence, then independent release review; no defaults or thresholds are assumed |

## Ordered implementation sequence

1. Governance foundation: licenses, connectors, raw records, entity history, PIT metadata, model/resource/gate registries.
2. Data quality: reconciliation/quarantine, normalization, corporate-action adjustments, feature-store contracts.
3. Scoring and signals: sector routing, percentile normalization, completed bars, state machines, expiry/cooldown.
4. Research and valuation: evidence taxonomy, management guidance, forecasts, scenarios, valuation, promotion.
5. Portfolio and paper lifecycle: suitability/capacity, position intent, simulated fills, costs, reconciliation, broker classification.
6. Reproducible backtesting: PIT snapshots, walk-forward runs, survivorship/cost/liquidity controls, reliability metrics.
7. Operations and security: RBAC, immutable audit, resource governor, jobs, backups, model governance, acceptance gates.
8. UI/API completion: data quality, governance, resources, orders, settings, model, expanded audit and overview surfaces.

The first implementation batch adds the registries and persisted control surfaces required by every later layer. It does not claim that absent licensed data has been created.

## Latest audit corrections

The following correctness and safety gaps were fixed after comparing the running system with the code and seed paths:

- Candidate score dashboard link now resolves to a real `/scores` page.
- Dashboard operating mode is read from persisted settings; portfolio review count is derived from position suitability, signal, and price state.
- Historical audit output now preserves signal penalties and queries available raw-record/revision metadata when present.
- Research component responses no longer manufacture empty analyst notes; missing notes remain absent.
- Backtest factor analysis no longer returns hard-coded IC, decile, exposure, or correlation statistics. It reports `not_computed` until a reproducible PIT run exists.
- Demo fixtures use a fixed seed and fixed reference date, so repeated demo loads are reproducible.
- Destructive demo reset now requires `IEIS_ALLOW_DEMO_RESET=true` and refuses production execution.
- Seed truncation covers the newly added control/history tables to avoid stale governance state.
- 7.1.4 strict boolean, cap, lot, resource, candle-seal, signal-eligibility, score, and business-action helpers added with focused unit tests.
- Seeded signals are explicitly incomplete, unsealed, preview-only, and non-actionable; the Signals UI states that the data is demo research only.
- Paper-order creation now returns 409 with missing-control reasons; quantity input rejects string coercion. Position sizing has no 1% default, no fabricated liquidity fallback, and always returns `final_quantity: 0`.
- Execution-policy, risk-policy, reservation, outbox, broker-attempt/fill, and virtual-lot schema scaffolding added; no broker adapter, cryptographic signer/verifier, outbox worker, or reconciliation flow is active.
- API governance exposes effective execution as disabled and entry safety as blocked when telemetry/policy review is unavailable.
- Demo model/gate/alert records no longer claim a production-approved champion or a fully operational trading system; the current rows were corrected in place without resetting the database.
- The 26 formula IDs in the 7.1.4 allowlist now have direct offline reference dispatch and synthetic vectors; arbitrary expression text is never evaluated, and every formula remains not approved.
- Quantitative release readiness now requires evidence for ten areas, treats absent/invalid evidence as unknown, and reports review readiness only; it cannot enable execution.

## 7.1.4 delta checklist

| Requirement | Status | Evidence / remaining |
| --- | --- | --- |
| N01 exact booleans | Partial | Helper and unit tests exist; a full API/settings boundary audit remains. |
| N02 all residual quantity caps | Partial, fail-closed in product path | Helper requires all 14 cap fields and floors by lot; no reconciled exposures or active policy, so endpoint quantity remains zero. |
| N03 signed order-policy evidence | Schema only | Evidence fields exist; no trust store, cryptographic verification, or approvals. |
| N04 verified integer lot size | Helper only | Positive integer and floor-to-lot tested; no authoritative effective-dated instrument source, not used for execution. |
| N05 resource emergency/recovery | Partial, currently blocks entries | Missing telemetry, reserve/hysteresis policy, or health review cannot reach normal state. Host metrics and recovery review are not wired. |
| N06 candle seal | Helper only | Seal predicates and tests exist; no licensed bar, watermark, calendar, checksum, or conflict pipeline. |
| N07 CAS/session phase | Classifier only | Boundary classifier exists; no authoritative calendar/membership or broker rule input. It is not execution permission. |
| N08 action eligibility | Reference lifecycle engine present; all current signals blocked | Exact gate/approval/confidence checks, confirmation, expiry/cooldown/hysteresis and paper position events are tested. Runtime uses preview/unavailable mapping only; licensed input, full gate linkage, durable transition audit, and governed thresholds are absent. |
| N09 business-action idempotency | Helper/schema only | Stable hash and unique keys exist; no atomic reservation/outbox/dispatch/reconciliation transaction. |
| N10 account risk policy | Partial | Default 1% removed; no verified policy. Sizing result remains preview-only and final quantity zero. |
| N11 formula whitelist and vectors | Reference tested, not approved | Exact 26 IDs, 26 deterministic synthetic vectors, and missing-required-argument tests are present. Independent finance, units, PIT, property tests, and approval linkage remain. |
| N12 quantitative release gates | Fail-closed evaluator present; evidence absent | Ten release areas require explicit numeric thresholds, measurements, units, periods, entitled sources, reviewer identity, and test artifacts. Unknown or duplicate evidence blocks review; no release threshold is invented, and execution remains disabled. |

The complete requirement-level description and current feature inventory are in [`ieis-system-summary-7.1.4.md`](./ieis-system-summary-7.1.4.md). Database schema additions must be pushed and verified before those tables are considered installed in the active database.

## Remaining implementation queue after the latest audit

### A. Trustworthy data layer

1. Connect an explicitly permitted market-data/document source through the integration flow; do not invent a provider or bypass license terms.
2. Implement source-adapter execution: health checks, retry/backoff, circuit breaker, schema validation, checksums, gap detection, dead-letter records, and exchange-calendar handling.
3. Add company, listing, broker-instrument, derivative, filing/document, price-bar, normalized-statement, and benchmark constituent tables.
4. Populate raw immutable records, source/license references, point-in-time facts, revisions, reconciliation conflicts, quarantine, security identifier history, sector history, and index membership.
5. Add corporate-action adjustments and adjusted price/total-return series.
6. Split discovery, standard fundamental, and deep research coverage tiers and enforce tier-aware outputs.

### B. Models and research

7. Replace scoring defaults/proxies with persisted feature inputs and source-backed calculations; add sector-specific models and cross-sectional normalization.
8. Add independently reviewed formula/feature/model approvals and deployment linkage to every computed score, signal, research record, and backtest.
9. Complete hard-gate review/resolution workflow with evidence, audit events, caps, blocks, and score/signal consequences.
10. Connect the tested signal lifecycle to approved inputs and durable transition history; implement completed-bar technical aggregation plus regime, catalyst, cross-horizon, and next-session policy.
11. Add evidence taxonomy, management guidance, forecasts, scenarios, reverse valuation, sensitivity, catalyst tracking, and research promotion/review.

### C. Portfolio and execution safety

12. Add authenticated users, roles, permissions, approval steps, and privileged-action audit logging.
13. Complete suitability, risk, liquidity/capacity, correlation, concentration, SME/F&O, drawdown, event, cash-reserve, cost, tax-lot, and corporate-action controls.
14. Add paper order lifecycle, simulated fills, broker reconciliation, orphan/failover handling, stale-data blocking, and retail-algo classification fields.
15. Keep live broker execution disabled until separate data, investment, security, and execution gates are approved.

### D. Backtesting and operations

16. Replace seeded backtest records with a reproducible point-in-time walk-forward engine using survivorship-controlled universes, filing availability, corporate actions, lag, costs, slippage, liquidity impact, taxes, and signal expiry.
17. Add bootstrap confidence intervals, regime/subperiod analysis, parameter sensitivity, deflated Sharpe, probability of overfitting, factor redundancy, and exposure analysis.
18. Add persistent run configuration, source/model snapshot IDs, validation states, champion/challenger models, shadow comparisons, rollback, resource governor enforcement, jobs, quotas, backup/restore evidence, RPO/RTO, and security controls.

### E. Product surfaces

19. Add dedicated Data Quality, Orders/Broker, Resources/Jobs, Settings, Reports, and Security/RBAC pages.
20. Expand Governance with licenses, connectors, formulas, features, models, gate history, resources, jobs, backup state, and approval details.
21. Expand Signals, Research, Company Detail, Audit, Universe, Portfolio, and Backtest pages with provenance, state history, write/review workflows, and explicit unavailable/demo states.
22. Add route/link smoke tests, response contract tests, responsive navigation, alert inbox/detail views, export/redaction controls, and accessible empty/error states.

Items 1–6 are intentionally blocked on a real permitted source connection. Items 7–22 can be implemented against the contracts and deterministic demo fixtures, but must remain visibly unvalidated until source-backed data and acceptance gates exist.