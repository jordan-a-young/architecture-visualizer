import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { log } from 'node:console';
import process from 'node:process';
const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), 'archgraph-consumer-'));
const write = (name, value) =>
  writeFileSync(
    join(directory, name),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
try {
  const core = `file:${resolve(root, 'artifacts/archgraph-core-0.1.0.tgz')}`;
  const react = `file:${resolve(root, 'artifacts/archgraph-react-0.1.0.tgz')}`;
  const demo = JSON.parse(
    readFileSync(resolve(root, 'apps/demo/package.json'), 'utf8'),
  );
  write('package.json', {
    name: 'archgraph-external-consumer',
    private: true,
    type: 'module',
    packageManager: 'pnpm@11.19.0',
    dependencies: {
      ...Object.fromEntries(
        Object.entries(demo.dependencies).filter(([name]) => name !== 'elkjs'),
      ),
      'archgraph-core': core,
      'archgraph-react': react,
    },
    devDependencies: { ...demo.devDependencies, typescript: '~5.9.3' },
  });
  write(
    'pnpm-workspace.yaml',
    `allowBuilds:\n  esbuild: true\noverrides:\n  'archgraph-core': '${core}'\n`,
  );
  write('tsconfig.json', {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      lib: ['ES2022', 'DOM'],
    },
    include: ['src'],
  });
  write(
    'index.html',
    '<html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
  );
  mkdirSync(join(directory, 'src'));
  write(
    'src/main.tsx',
    `import { createRoot } from 'react-dom/client';
import { ArchitectureViewer, getEdgeKey, parseViewState } from 'archgraph-react';
import type { ArchitectureViewerHandle, LayoutFunction, NodeRendererProps, NodePositions, NodeLabelMode, WalkthroughState, ViewerViewState, RelationshipStyleRegistry, EdgeLineStyle } from 'archgraph-react';
import { validateGraph } from 'archgraph-core';
import type { ArchitectureGraph } from 'archgraph-core';
import 'archgraph-react/styles.css';
const graph: ArchitectureGraph = { version: '1.0', nodes: [{id:'a',label:'A',type:'custom'}], edges:[], groups:[] };
const layout: LayoutFunction = graph => new Map(graph.nodes.map(n => [n.id, [0, 0, 0]]));
function Custom({ color }: NodeRendererProps) { return <mesh><boxGeometry/><meshBasicMaterial color={color}/></mesh>; }
const ref = (viewer: ArchitectureViewerHandle | null) => { viewer?.resetCamera(); viewer?.setCameraPreset('top'); viewer?.focusNode('a'); };
export const edgeKey = getEdgeKey({source:'a',target:'a'}, 0);
export const captureView = (viewer: ArchitectureViewerHandle): ViewerViewState => parseViewState(viewer.getViewState());
export const restoreView = (viewer: ArchitectureViewerHandle, state: unknown) => viewer.restoreViewState(state);
export const arrangeVisible = (viewer: ArchitectureViewerHandle) => viewer.arrangeVisibleGraph();
export const resetLayout = (viewer: ArchitectureViewerHandle) => viewer.resetLayout();
export const walkthrough: WalkthroughState = { startNodeId: 'a', edgeKeys: [] };
const labelMode: NodeLabelMode = 'selected';
const lineStyle: EdgeLineStyle = 'dotted';
const relationshipStyles: RelationshipStyleRegistry = { 'depends-on': { label: 'Code dependency', lineStyle } };
const positions: NodePositions = { a: [1, 0, 2] };
export const screenshot = (viewer: ArchitectureViewerHandle): Promise<Blob> => viewer.captureScreenshot({includeLabels: true});
if (!validateGraph(graph).valid) throw new Error('Unexpected invalid fixture');
createRoot(document.getElementById('root')!).render(<ArchitectureViewer ref={ref} graph={graph} nodeLabelMode={labelMode} relationshipStyles={relationshipStyles} showRelationshipLegend layout={layout} collapsedGroupIds={[]} onCollapsedGroupsChange={ids => { void ids; }} nodeRenderers={{ custom: Custom }} showGroupBoundaries groupStyle={() => ({color:"#445566",fillOpacity:0.06})} edgeRouting="orthogonal" draggableNodes defaultNodePositions={positions} onNodePositionsChange={next => console.log(next.a)} onNodeDragEnd={(node, position) => console.log(node.id, position)}/>);
`,
  );
  const run = (args) =>
    execFileSync('pnpm', args, { cwd: directory, stdio: 'inherit' });
  run(['install', '--no-frozen-lockfile']);
  run(['exec', 'tsc']);
  run(['exec', 'vite', 'build']);
  execFileSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "import { validateGraph } from 'archgraph-core'; if(!validateGraph({version:'1.0',nodes:[],edges:[],groups:[]}).valid)process.exit(1)",
    ],
    { cwd: directory, stdio: 'inherit' },
  );
  run(['add', 'elkjs@0.11.1']);
  write(
    'src/optional.ts',
    `import { createElkLayout } from 'archgraph-react/elk';
export const engine = createElkLayout({ direction: 'DOWN', nodeSize: () => ({width:2,depth:2}) });
`,
  );
  const main = readFileSync(join(directory, 'src/main.tsx'), 'utf8');
  write(
    'src/main.tsx',
    `import {engine} from './optional';\n` +
      main.replace('layout={layout}', 'layout={engine}'),
  );
  run(['exec', 'tsc']);
  run(['exec', 'vite', 'build']);
  log(
    'Standalone tarball consumer: TypeScript, Vite build, and Node ESM import passed.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
