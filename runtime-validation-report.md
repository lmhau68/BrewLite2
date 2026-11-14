# Runtime Validation Report

**Generated**: 2026-11-14T11:24:34+07:00  
**Target**: BrewLite2, local checkout

## Summary

| Check | Status | Exit code | Evidence |
|---|---|---:|---|
| API unit tests | PASS | 0 | 6 files, 38 tests |
| API PostgreSQL integration | PASS | 0 | 3 files, 16 tests |
| API lint and build | PASS | 0 | `npm run lint`, `npm run build` |
| Web unit/component tests | PASS | 0 | 8 files, 35 tests |
| Web type-check and build | PASS | 0 | `npm run lint`, `npm run build` |
| Chromium Playwright E2E | PASS | 0 | 1 full checkout at 390x844 |
| Additional browser flows | PASS | 0 | Chromium at 360x800; Firefox at 360x800 and 390x844 |
| Migration and seed | PASS | 0 | Fresh PostgreSQL schema; seed run twice with unchanged counts |
| App startup and smoke checks | PASS | 0 | API `/health`, `/products`, web `/`, and PWA manifest returned HTTP 200 |
| Docker Compose config | PASS | 0 | `docker compose config --quiet`; running documented services healthy |
| Render startup script syntax | PASS | 0 | `sh -n` in Linux container |

The seed contained 11 products, 33 sizes, 5 toppings, and 12 product/topping links.
The existing Compose database had no host-published port. An isolated PostgreSQL
container was used for tests and removed afterward; the existing Compose services
were not stopped or modified.

## Browser and API evidence

- The checkout flow passed in Chromium and Firefox: registration, menu selection,
  cart, order creation, simulated card payment, and order detail.
- No horizontal overflow was detected by explicit width checks on the tested
  menu, product detail, cart, payment, and order-detail routes in Firefox at
  360x800 and 390x844, and in Chromium at 360x800. The Chromium checkout E2E at
  390x844 passed, but did not include an explicit overflow assertion.
- After 10 warm-up requests, 100 requests per catalog endpoint measured:
  - `GET /products`: max 9.1 ms, p95 6.7 ms.
  - `GET /products/:id`: max 17.6 ms, p95 10.4 ms.
  - These two endpoints meet the documented `<500 ms` threshold in this local
    test environment. Other business endpoints were not benchmarked.

## Documentation findings and remaining gaps

- `docs/traceability-matrix.md` still identifies itself as Task 4.3 / Sprint 1,
  says Sprint 2 features are not implemented, and lists older test counts. It
  does not trace the current Task 5.1/5.2 implementation.
- `docs/architecture/architecture.md` describes production on Render, while
  `docs/architecture/deployment.md` describes local Docker Compose as the
  platform. Align these deployment assumptions.
- SRS FR-01 says the menu displays availability, while the current main-menu
  tests expect unavailable products to be hidden. The API can include them with
  `includeUnavailable=true`; clarify the intended user-visible behavior.
- SRS section 5 says a failed or unpaid order remains `PENDING`, while FR-09 and
  `use-case-checkout.md` specify `PAYMENT_FAILED` after a definite failure.
  Clarify the distinction between unpaid/pending and failed payment.
- The full SRS is not completely verified. Not run: the 30-minute NFR-02
  availability observation; 100-request performance measurements for every
  business endpoint; full NFR-03 security boundaries (rate limiting, password
  byte limits, token expiry); production NFR-04 checks; keyboard/focus checks;
  NFR-08 log correlation/redaction checks; and actual GitHub Actions/Render
  deployment and rollback.
- FR-15 through FR-19 and FR-22 are marked Could; FR-20 and FR-21 are Won't.
  They were not treated as MVP acceptance requirements.

## Verdict

**NEEDS_SIGNOFF** — all executed automated tests, builds, and tested browser
flows passed. This does not certify every SRS acceptance criterion or production
deployment requirement; the unverified items above remain.
