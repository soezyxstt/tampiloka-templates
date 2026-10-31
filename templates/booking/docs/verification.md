# Recorded release verification

Date: 2026-10-31T02:11:01.172Z

Full evidence: https://github.com/soezyxstt/tampiloka-templates/actions/runs/41156562018

Header/catalog release evidence: https://github.com/soezyxstt/tampiloka-templates/actions/runs/41158505039

## Completed checks

- Booking domain/API/provider tests: 32 passed. Provider HTTP is mocked, not a merchant sandbox.
- CLI tests: 15 passed, including all 16 preset/level combinations.
- Registry tests: 11 passed. Public catalog tests: 5 passed.
- Four fresh standalone projects passed installation, typecheck, build, doctor, migration and production-mode API checks.
- Full real-Worker/D1 browser suite: 46 passed locally and 46 passed at https://booking.tampiloka.site, with no browser runtime exceptions.
- After adding static asset security headers: 5 affected end-to-end checks passed locally and live under active CSP. The other checks were explicitly skipped in this focused rerun, not counted as passes.
- 360, 390, 1024 and 1440 pixel layouts, reduced/normal staff motion, keyboard focus, URL axes/history, owner/viewer refresh, sample/reset isolation, payment retry, receipt, uploaded QR and check-in are covered.
- All four public WebP preview URLs returned HTTP 200 in the browser and decoded to 1280x800 before enabling catalog readiness.
- Booking typecheck/build, monorepo typecheck and design guard passed. Earlier affected cafe and commerce builds and commerce API tests passed in run 41153095810.

The full-suite workflow above has an overall failed status because its later standalone Python image request received HTTP 403. Its domain, standalone, local browser, deployment and live browser steps all succeeded. This release independently verifies all images using an actual browser; it does not count the failed Python request as a pass.

## Boundaries

No real payment was processed. Client-owned secrets, merchant-specific Midtrans sandbox verification, physical camera testing, privacy/retention rules and backup recovery remain launch checks. See limitations.md and deployment.md. The branch and PR are not automatically merged. Public catalog publication from this reviewed branch requires merging the PR before future main-branch publications can retain these entries.
