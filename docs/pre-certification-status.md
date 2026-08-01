# Pre-certification status

## Release

- Version: `0.2.0-experimental.0`
- Branch: `version-2-experimental`
- Phase 10 verified commit: `347ff44`
- Checkpoint commit: the commit containing this document, created with `chore(release): prepare 0.2.0 experimental checkpoint`
- Tag: `meme-lore-v0.2.0-experimental.0`
- Push: remote `origin` authentication and branch update verified with a dry run; the checkpoint branch and annotated tag are backed up as the final action of this procedure
- Date: `2026-07-14`

`main` and `origin/main` remain at `6658560d82293216545f76a20d43b5fa5eff4f09`. The bundled `data/universe_master.json` has no diff against `main`.

## Technical quality

| Gate | Command | Result | Approximate duration |
| --- | --- | --- | ---: |
| Typecheck | `npx tsc -b --pretty false` | Passed | 6.72 s |
| Lint | `npm run lint` | Passed | 5.45 s |
| Tests | `npm test` | 17 files, 89/89 passed | 12.65 s reported by Vitest; 14.94 s process time |
| Production build | `npm run build` | Passed; 2,868 modules transformed | 16.50 s process time |
| Derived analysis | `npm run analysis:build` | Passed; 6 artifacts verified | 1.74 s |
| Benchmark | `npm run analysis:benchmark` | Passed for 1,000, 5,000, and 10,000 entities, seed 42 | 4.80 s |

No pre-existing quality failure was reproduced. The benchmark reproduction measured 828.54 ms for graphs at 10,000 entities versus 876.19 ms in the Phase 10 report; this is a single-run variation, not a performance guarantee.

## Existing capabilities

- Local migration and Zod/referential validation of canon.
- Stable normalization, hashing, entity/timeline/knowledge/dependency indexes, and reconstructible derived artifacts.
- Versioned Web Worker progress, cancellation, typed errors, and interruption handling.
- IndexedDB or memory cache keyed by canon hash, schema version, and engine version; damaged entries are discarded.
- Conservative incremental compilation with full-rebuild fallback for unsafe changes and deletions.
- Deterministic continuity, causality, and structured knowledge diagnostics with canonical evidence.
- Connection topology, bounded graph exploration, paths, cycles, centrality, density, observations, and reciprocity issues.
- Author-supplied Narrative Plausibility Score with separate coverage and browser-local profiles.
- Diagnostic JSON export and browser-local author decisions.
- Optional, disabled-by-default extraction boundary with selected fragments, secret blocking, source spans, mock-local proposals, human review, validated patch export, comparison, and explicit approval.
- Reproducible synthetic benchmark generator for 1,000, 5,000, and 10,000 entities.
- Detection of corrupt canon, broken references, incompatible versions, damaged cache, interrupted Worker, partial derived sets, thousands of issues, and deleted entities.

## Capabilities not yet certified

- Accuracy of classification for the real MEME canon.
- Narrative false-positive and false-negative rates on author-reviewed cases.
- Complete end-to-end author experience.
- Clarity and usefulness of every diagnostic message and limitation.
- Clean installation on a new machine and supported Node versions beyond the measured environment.
- User manual and guided onboarding.
- Certified acceptance test signed off by the author.

## Risks

- Benchmarks use one run per checkpoint; there is no median or reliable variability distribution.
- Graph processing is the largest measured stage at 10,000 entities.
- Performance depends on the target CPU, RAM, Node version, browser, and canon topology.
- The release remains on an experimental branch and is not merged into `main`.
- Synthetic fixtures verify structure and scale, not narrative truth or author expectations.
- Assisted extraction currently has only a mock local provider; no remote integration is approved or certified.

## Entry for the next phase

The certification phase must begin by reading:

- `docs/pre-certification-status.md`
- `docs/analysis-benchmarks.md`
- `docs/analysis-architecture.md`
- `docs/author-workflow.md`

It must also consult `docs/analysis-schema.md`, `docs/analysis-rules.md`, `docs/derived-data.md`, and `docs/ai-boundary.md` where relevant. This checkpoint does not begin narrative certification or user-manual validation.
