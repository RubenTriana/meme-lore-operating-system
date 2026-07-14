# Optional AI boundary

There is no remote AI dependency in the analytical core. Assisted extraction is a separate adapter boundary and its browser feature flag is disabled by default.

```ts
interface NarrativeExtractionAdapter {
  extract(input: NarrativeSource): Promise<ExtractionProposal>
}
```

The adapter receives only author-selected text fragments. Its contract cannot receive the universe, filesystem paths, unselected files, browser secrets, or application storage. A disclosure panel shows exactly which fragments and how many characters would be provided. Likely secret patterns are blocked before invocation.

The only provider is `mock-local-v1`; it performs no network request and recognizes explicit declarations without filling missing information. Future remote providers require an approved feature flag, explicit transport disclosure, credential storage outside canon, consent per selection, and dedicated security tests.

Mandatory flow:

```text
source → proposal → human accepted/rejected states → schema validation
       → patch export and before/after comparison → explicit approval → canon loader
```

An `ExtractionProposal` is never canon. Only accepted items with valid source spans can enter a patch, and the application never writes a proposal directly to `universe_master.json`.
