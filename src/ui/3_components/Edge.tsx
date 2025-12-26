/**
 * Graph Edge Component
 *
 * Renders a connection between nodes.
 * - pipe: Solid line (observable -> piped observable)
 * - subscribe: Dashed line (observable -> subscription)
 * - trigger: Dotted line (subscription -> child subscription)
 */

import type { GraphEdge } from '../0_types';

interface EdgeProps {
  edge: GraphEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Edge style configurations
const EDGE_STYLES: Record<GraphEdge['type'], { stroke: string; dashArray: string }> = {
  pipe: { stroke: '#60a5fa', dashArray: 'none' }, // blue solid
  subscribe: { stroke: '#22c55e', dashArray: '6,3' }, // green dashed
  trigger: { stroke: '#a78bfa', dashArray: '2,2' }, // purple dotted
};

export function Edge({ edge, x1, y1, x2, y2 }: EdgeProps) {
  const style = EDGE_STYLES[edge.type];
  const opacity = edge.isActive ? 0.8 : 0.3;

  // Calculate arrow head position
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLength = 8;

  // Arrow head points
  const arrowX1 = x2 - arrowLength * Math.cos(angle - Math.PI / 6);
  const arrowY1 = y2 - arrowLength * Math.sin(angle - Math.PI / 6);
  const arrowX2 = x2 - arrowLength * Math.cos(angle + Math.PI / 6);
  const arrowY2 = y2 - arrowLength * Math.sin(angle + Math.PI / 6);

  return (
    <g style={{ opacity }}>
      {/* Main line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={style.stroke}
        strokeWidth={2}
        strokeDasharray={style.dashArray}
      />

      {/* Arrow head */}
      <polygon
        points={`${x2},${y2} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
        fill={style.stroke}
      />
    </g>
  );
}
