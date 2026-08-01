# Phase 9 — Optional narrative extraction boundary

## Contract and flow

`NarrativeExtractionAdapter` accepts only a `NarrativeSource` made of author-selected text fragments and returns an `ExtractionProposal`. The proposal contains proposed entities, events, relations, warnings, and exact source spans. It is never a `Universe` and cannot write canon.

The enforced workflow is:

`source → proposal → human review → schema validation → patch → explicit approval → in-memory canonical loader`

`proposed`, `accepted`, and `rejected` are review states. Only accepted items enter `buildExtractionPatch`; the resulting preview is validated with the existing Zod and reference validation before export or approval.

## Provider boundary

The only implementation is `mock-local-v1`. It performs no network requests and recognizes explicit pipe-delimited declarations without inferring missing fields. A future provider must implement the same adapter contract and remain outside `src/analysis`.

The local `aiExtractionEnabled` preference is false by default and is not canonical data. No remote provider, SDK, API key, or new dependency is included.

## Security boundary

- Only checked fragments are copied into the adapter input.
- The universe, files, filesystem paths, and unselected fragments are not part of the adapter contract.
- The disclosure summary shows selected labels, character count, transport, and whether the universe is included.
- Common secret patterns are blocked before adapter invocation.
- Every accepted proposal must retain a valid `SourceSpan`.
- The UI applies nothing until the author reviews the before/after comparison and checks the explicit approval control.
