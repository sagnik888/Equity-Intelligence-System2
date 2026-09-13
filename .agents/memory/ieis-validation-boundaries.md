---
name: IEIS validation boundaries
description: Durable safety rule for distinguishing demo data, model validation, investment validation, and execution readiness.
---

IEIS must report data readiness, model/formula readiness, investment-validation readiness, and execution readiness as separate states. A passing formula test or working paper workflow must never imply that the investment system is validated or that live broker execution is available.

**Why:** The specification requires explicit validation states, and the current build intentionally uses seeded research data with no connected market-data or broker provider.

**How to apply:** Keep governance/status responses and UI labels explicit. Any future live-execution work must add authenticated approvals, reconciliation, immutable audit events, and a separate controlled transition rather than changing the paper path implicitly.