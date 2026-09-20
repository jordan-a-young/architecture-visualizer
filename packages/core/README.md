# archgraph-core

Provider-independent architecture graph types, Zod schemas, structured validation and pure traversal utilities. No React, Three.js, provider SDKs, discovery, or network calls.

```ts
import { validateGraph, getDependencies } from 'archgraph-core';
const result = validateGraph(input);
if (result.valid) console.log(getDependencies(result.graph, 'service-id'));
```

Graphs require version `1.0`, nodes, edges and groups. Node/edge types are arbitrary strings; metadata is `Record<string, unknown>`. Exports include individual schemas, graph types, `validateGraph`, `validateGraphSemantics`, `isSafeHref`, `getNode`, `getOutgoingEdges`, `getIncomingEdges`, `getDependencies`, `getDependents`, `getNeighbors`, `getConnectedSubgraph`, and `filterGraph`.

Relationship cycles are valid; malformed references and duplicate IDs are errors. Self-edges/duplicate relationships are warnings and isolated nodes are informational. Validate untrusted JSON before using traversal helpers. ESM and TypeScript declarations included. MIT licensed.
