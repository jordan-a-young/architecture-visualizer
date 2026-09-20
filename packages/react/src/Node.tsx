import type { NodeRendererProps } from './types.js';
const colors: Record<string, string> = {
  application: '#657ea8',
  gateway: '#7b87a3',
  service: '#579b98',
  database: '#ba965d',
  queue: '#9a7eaa',
  worker: '#748f70',
  library: '#9099ac',
};
export function getNodeColor(type: string): string {
  return Object.hasOwn(colors, type) ? colors[type]! : '#8b95a4';
}
/** Geometry is local to the node origin. The viewer owns positioning, selection and labels. */
export function DefaultNodeRenderer({
  node,
  selected,
  highlighted,
  color,
  opacity,
}: NodeRendererProps) {
  const size = node.visual?.size ?? 1;
  return (
    <mesh scale={size}>
      {node.type === 'database' ? (
        <cylinderGeometry args={[0.55, 0.55, 0.85, 32]} />
      ) : node.type === 'queue' ? (
        <capsuleGeometry args={[0.3, 0.65, 8, 16]} />
      ) : (
        <boxGeometry
          args={
            node.type === 'library' ? [0.65, 0.65, 0.65] : [1.15, 0.85, 0.85]
          }
        />
      )}
      <meshStandardMaterial
        color={color}
        roughness={0.65}
        metalness={0.08}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={selected || highlighted ? color : '#000000'}
        emissiveIntensity={selected ? 0.3 : highlighted ? 0.16 : 0}
      />
    </mesh>
  );
}
