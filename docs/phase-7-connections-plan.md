# Phase 7: connections plan

## Objective

Turn the existing derived relation graph into a deterministic exploration and diagnostic tool without changing canon or beginning a graph-wide visual rewrite.

## Reusable implementation resources

- `RelationGraph`, `EntityIndex`, and `DependencyIndex` are serializable parts of `DerivedCompilation` in `src/analysis/types.ts`, built by `src/analysis/derived.ts`.
- `compileAnalysisSnapshot` in `src/analysis/incremental.ts` already supplies source/version metadata and conservative invalidation planning.
- `src/analysis/worker-protocol.ts`, `src/analysis/worker-runtime.ts`, and `src/services/analysis-worker-client.ts` provide typed compile/cancel/progress/error messaging; `src/services/analysis-service.ts` and `src/services/analysis-cache.ts` provide the application API and versioned cache identity.
- `src/analysis/engines.ts` is the current feature-flagged engine registry; `AnalysisRule` and `NarrativeIssue` are in `src/analysis/types.ts`.
- `/analysis` is defined in `src/app/routes.ts`, rendered by `src/pages/AnalysisPage.tsx`, and already has filter helpers in `src/analysis/presentation.ts`.
- `@xyflow/react` is installed and used by `src/graph/SemanticGraph.tsx`; React Router, Zustand (`src/store/useStudioStore.ts`), and existing UI components are available.
- `analysisConfig.engines.connections` is the existing feature flag. Author annotations remain separate from canon.

## Algorithms and result classes

Implement pure graph functions against `RelationGraph`, with stable node/edge ordering and explicit directed-versus-undirected views:

| Result | Algorithm | Initial classification |
| --- | --- | --- |
| Isolated nodes | Degree zero | `observation` |
| Disconnected components | BFS/DFS over a selected undirected projection | `observation` |
| Degree centrality | In/out/total degree by edge type | `metric` |
| Betweenness centrality | Brandes, only with bounded graph sizes | `metric` |
| Shortest paths | BFS for unweighted projections | `metric` / exploration result |
| Cycles | Deterministic SCC or directed cycle walk | `observation` unless a later structured rule defines an error |
| Module density | Actual versus possible intra-module edges | `metric` |
| Indirect connections | Depth-limited BFS with provenance paths | `observation` |
| Missing reciprocity | Compare reverse edges only for relation types that declare reciprocity | `issue` only when the structured contract requires it |

Broken references remain validation issues. A character with no edges, a symbol with no event edge, or a disconnected component should not become a narrative issue by default. Any new issue must have a rule ID, evidence, and deterministic ID through the existing rule/issue contract.

## Scalability and Worker execution

- Execute projection construction, components, degree, bounded shortest paths, SCCs, and all centrality calculations in the existing Worker boundary.
- Limit indirect exploration by explicit depth and node/edge budgets; return a truncated marker instead of silently expanding further.
- Load a selected node neighborhood first. Paginate tabular metrics and virtualize result lists using the existing pattern from `/analysis`; do not render the whole graph by default.
- At roughly 1,000 entities, permit full basic metrics in the Worker. At 5,000, compute neighborhood queries and degree/components eagerly but make betweenness opt-in and bounded. At 10,000, keep rendering and path search budgeted, avoid all-pairs work, and require sampled or selected-subgraph betweenness.
- Extend cache identity only when the connections engine has a distinct engine/version contract. Reuse `DependencyIndex` to identify changed neighborhoods; fall back to full graph recomputation whenever edge consistency cannot be proven.

## Future interface

Add `/analysis/connections` through the current router and navigation system without replacing `/analysis`. It should later allow selection of an entity, direct neighbors, bounded indirect traversal, a path between two entities, node/edge-type filters, depth limits, and inspection of edge provenance (`explicit`, `refs`, `foreshadowing`). The page should distinguish analytical graph data from the existing `SemanticGraph` visual component and reuse the diagnostics filter and empty-state conventions.

## Future tests

Create small deterministic fixtures and verify: isolated node; disconnected components; shortest path; directed and undirected cycle; directed versus undirected projection; duplicate edges; stable IDs/order; large graph budgets; Worker cancellation; one-entity incremental change; entity deletion; and observations that remain non-issues. Add integration tests for feature flags, cache invalidation, provenance display, pagination/virtualization, and cancellation. Include a graph with intentionally isolated entities to prevent false-positive issue rules.

## Risks

- Betweenness centrality is expensive and must be bounded.
- Large graphs can cause visual explosion even when calculations are correct.
- Generic refs may swamp meaningful relationship signals; provenance and edge-type filtering are required.
- Duplicate edges, ambiguous direction, and not-yet-structured relationship types need explicit projection rules.
- Intentionally isolated entities can create false positives.
- React Flow is a visualization dependency, not the source of analytical truth; the analytical and visual graph may have different projections.

## Recommended implementation order

1. Define additive connection result types and engine/rule contracts.
2. Implement pure projection and traversal algorithms.
3. Add unit fixtures and deterministic-order tests.
4. Integrate Worker messages and cancellation.
5. Add cache and incremental invalidation behavior.
6. Expose metrics and observations before issue rules.
7. Add narrowly scoped diagnostic rules, if structured contracts justify them.
8. Add only the required Zustand state for selection and view preferences.
9. Implement the `/analysis/connections` interface with bounded neighborhoods.
10. Run integration and performance-budget tests.

No Phase 7 source code, components, engines, or tests are included in this checkpoint.
