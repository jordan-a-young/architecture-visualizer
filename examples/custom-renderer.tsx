import { ArchitectureViewer } from 'archgraph-react';
import type { NodeRendererProps } from 'archgraph-react';
import type { ArchitectureGraph } from 'archgraph-core';
import 'archgraph-react/styles.css';
function ModuleNode({ selected, color, opacity }: NodeRendererProps) {
  return (
    <mesh scale={selected ? 1.15 : 1}>
      <octahedronGeometry args={[0.65]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}
export function CustomArchitecture({ graph }: { graph: ArchitectureGraph }) {
  return (
    <ArchitectureViewer
      graph={graph}
      nodeRenderers={{ 'terraform-module': ModuleNode }}
    />
  );
}
