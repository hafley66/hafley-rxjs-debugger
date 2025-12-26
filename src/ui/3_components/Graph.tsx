/**
 * Force-Directed Graph Component
 *
 * Uses D3's force simulation to layout nodes.
 * Renders edges and nodes as SVG elements.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphState, GraphNode, GraphEdge } from '../0_types';
import { Node, NODE_RADIUS, SUB_WIDTH } from './Node';
import { Edge } from './Edge';

interface GraphProps {
  state: GraphState;
  width: number;
  height: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  node: GraphNode;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  edge: GraphEdge;
}

export function Graph({ state, width, height }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // Node positions from simulation
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Tooltip state
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Initialize/update simulation
  useEffect(() => {
    if (state.nodes.length === 0) {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      return;
    }

    // Create simulation nodes
    const simNodes: SimNode[] = state.nodes.map((node) => ({
      id: node.id,
      node,
      x: positions.get(node.id)?.x ?? width / 2 + Math.random() * 100 - 50,
      y: positions.get(node.id)?.y ?? height / 2 + Math.random() * 100 - 50,
    }));

    // Create simulation links
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = state.edges
      .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
      .map((edge) => ({
        source: nodeById.get(edge.source)!,
        target: nodeById.get(edge.target)!,
        edge,
      }));

    // Create or update simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(NODE_RADIUS * 2))
      .alphaDecay(0.02);

    simulation.on('tick', () => {
      const newPositions = new Map<string, { x: number; y: number }>();
      simNodes.forEach((node) => {
        // Clamp positions to viewport
        const x = Math.max(NODE_RADIUS, Math.min(width - NODE_RADIUS, node.x ?? 0));
        const y = Math.max(NODE_RADIUS, Math.min(height - NODE_RADIUS, node.y ?? 0));
        newPositions.set(node.id, { x, y });
      });
      setPositions(newPositions);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [state.nodes.length, state.edges.length, width, height]);

  // Get edge endpoints
  const getEdgePositions = useCallback(
    (edge: GraphEdge) => {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      if (!sourcePos || !targetPos) return null;

      // Offset to edge of node
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return null;

      const sourceNode = state.nodes.find((n) => n.id === edge.source);
      const targetNode = state.nodes.find((n) => n.id === edge.target);

      const sourceRadius = sourceNode?.type === 'observable' ? NODE_RADIUS : SUB_WIDTH / 2;
      const targetRadius = targetNode?.type === 'observable' ? NODE_RADIUS : SUB_WIDTH / 2;

      return {
        x1: sourcePos.x + (dx / dist) * sourceRadius,
        y1: sourcePos.y + (dy / dist) * sourceRadius,
        x2: targetPos.x - (dx / dist) * targetRadius,
        y2: targetPos.y - (dy / dist) * targetRadius,
      };
    },
    [positions, state.nodes]
  );

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: '#1f2937', borderRadius: 8 }}
    >
      {/* Edges (render first, behind nodes) */}
      <g className="edges">
        {state.edges.map((edge) => {
          const pos = getEdgePositions(edge);
          if (!pos) return null;
          return <Edge key={edge.id} edge={edge} {...pos} />;
        })}
      </g>

      {/* Nodes */}
      <g className="nodes">
        {state.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          return (
            <Node
              key={node.id}
              node={node}
              x={pos.x}
              y={pos.y}
              onMouseEnter={setHoveredNode}
              onMouseLeave={() => setHoveredNode(null)}
            />
          );
        })}
      </g>

      {/* Tooltip */}
      {hoveredNode && (
        <g
          transform={`translate(${positions.get(hoveredNode.id)?.x ?? 0}, ${
            (positions.get(hoveredNode.id)?.y ?? 0) - NODE_RADIUS - 30
          })`}
        >
          <rect
            x={-60}
            y={-20}
            width={120}
            height={40}
            rx={4}
            fill="#374151"
            stroke="#6b7280"
          />
          <text
            y={-4}
            textAnchor="middle"
            fill="#e5e7eb"
            fontSize={11}
            fontFamily="monospace"
          >
            {hoveredNode.label}
          </text>
          <text
            y={12}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={9}
            fontFamily="monospace"
          >
            {hoveredNode.type}
            {hoveredNode.isRoot ? ' (root)' : ''}
          </text>
        </g>
      )}
    </svg>
  );
}
