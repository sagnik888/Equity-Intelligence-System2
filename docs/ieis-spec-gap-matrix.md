# IEIS 7.1.2 implementation gap matrix

This is the implementation checklist against the attached consolidated specification. It intentionally distinguishes an implemented control from a production-validation claim. The system remains demo-data, alert/paper-only until the applicable validation gates pass.

## Current status

| Area | Current implementation | Remaining work |
| --- | --- | --- |
| Formula governance | Registry metadata and formula API exist; core formula helpers are tested in code | Add structured machine expressions, persisted registry/version approvals, export validation, and complete edge-case test coverage |
| Validation boundary | Governance status separates data/model/investment/execution states | Add architecture/code/resource/security gate records and gate history |
| Coverage model | Demo seed is labeled; coverage target is exposed | Add discovery/standard/deep coverage tiers and imports/connectors; no live 2,000-security dataset is present |
| Source rights | Basic source foundation exists | Add license registry, connector contract, request health, raw immutable records, retention checks, and permitted-use blocking |
| Canonical entities | ISIN-backed security table exists | Add company/listing/broker-instrument/derivative identities, identifier history, mapping review, and historical status/sector/index history |
| Point-in-time facts | Basic effective timestamp fact table exists | Add full economic/knowledge-time fields, revision lineage, original/revised views, and PIT selection service |
| Reconciliation | Formula helper exists | Add field-specific reconciliation states, quarantine, source precedence, unit/scope checks, and conflict blocking |
| Financial normalization | Seed snapshot fields exist | Add period/scope/unit/currency/reported-vs-normalized facts and reconciliation adjustments |
| Corporate actions | Basic action table exists | Add complete action types, adjustment factors, share-count history, validation, and canonical price-series handling |
| Feature store | Scores contain some breakdown JSON | Add versioned feature definitions/values, publication lag, staleness, outlier, negative-base, and cache controls |
| Scoring | Candidate score and confidence shrinkage exist | Correct weight alignment, percentile normalization, sector routing, sector-specific facts/models, and missing-data safety |
| Signals | Five horizons and score bands exist | Add completed-bar construction, signal state history, hysteresis, expiry, cooldown, confirmation timing, regime/catalyst inputs, and cross-horizon actions |
| Research/evidence | Research scores and evidence ledger exist | Add full evidence taxonomy, affected forecast/valuation fields, management guidance, research promotion, forecast/scenario/valuation workflows |
| Portfolio | Settings, suitability inputs, and paper intents exist | Add full risk/capacity constraints, position intent, costs/distributions/tax lots, order lifecycle, fills, reconciliation, failover, and broker classification |
| Backtesting | Seeded results and rich metric columns exist | Replace fabricated factor data with reproducible PIT walk-forward runs, costs/liquidity/survivorship controls, and validation status |
| Dashboard | Core dashboard, signals, research, portfolio, watchlists, audit, backtest pages exist | Add data quality, model governance, resources, orders/broker, settings, and expanded overview/signal/company/audit surfaces |
| Security/RBAC | Live execution disabled; secrets are environment-managed | Add authenticated roles, privileged action checks, immutable audit events, redaction, and environment separation |
| Resources | No operational governor | Add resource metrics, workload modes, persistent jobs, safety thresholds, and low-memory/low-storage behavior |
| Backup/recovery | No application-owned backup/restore evidence | Add backup configuration/status, restore-test records, retention metadata, and release gate |
| Model governance | Formula version is exposed | Add champion/challenger/experimental registry, approvals, shadow comparisons, deployments, and rollback |
| API/versioning | OpenAPI source and generated clients exist | Add versioned `/api/v1` surface or document compatibility bridge and add missing endpoints/contracts |
| Testing/release gates | Typecheck/build/smoke tests pass | Add formula/data/broker/resource/adversarial tests and persisted acceptance-gate results |

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