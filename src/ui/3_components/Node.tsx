/**
 * Graph Node Component
 *
 * Renders an Observable or Subscription as an SVG node.
 * - Observable: Circle
 * - Subscription: Rectangle
 */

import type { GraphNode } from '../0_types';

interface NodeProps {
  node: GraphNode;
  x: number;
  y: number;
  onMouseEnter?: (node: GraphNode) => void;
  onMouseLeave?: () => void;
  onClick?: (node: GraphNode) => void;
}

const NODE_RADIUS = 24;
const SUB_WIDTH = 48;
const SUB_HEIGHT = 24;

export function Node({ node, x, y, onMouseEnter, onMouseLeave, onClick }: NodeProps) {
  const handleMouseEnter = () => onMouseEnter?.(node);
  const handleMouseLeave = () => onMouseLeave?.();
  const handleClick = () => onClick?.(node);

  // Colors based on node state
  const fillColor = node.isActive
    ? node.type === 'observable'
      ? '#3b82f6' // blue for observable
      : '#22c55e' // green for subscription
    : '#6b7280'; // gray for inactive

  const strokeColor = node.isRoot ? '#f59e0b' : '#ffffff'; // orange border for roots
  const strokeWidth = node.isRoot ? 3 : 1;
  const opacity = node.isActive ? 1 : 0.5;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer', opacity }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {node.type === 'observable' ? (
        // Observable: Circle
        <circle
          r={NODE_RADIUS}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        // Subscription: Rounded Rectangle
        <rect
          x={-SUB_WIDTH / 2}
          y={-SUB_HEIGHT / 2}
          width={SUB_WIDTH}
          height={SUB_HEIGHT}
          rx={4}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* Label */}
      <text
        y={node.type === 'observable' ? NODE_RADIUS + 14 : SUB_HEIGHT / 2 + 14}
        textAnchor="middle"
        fill="#e5e7eb"
        fontSize={10}
        fontFamily="monospace"
      >
        {node.label}
      </text>
    </g>
  );
}

export { NODE_RADIUS, SUB_WIDTH, SUB_HEIGHT };
