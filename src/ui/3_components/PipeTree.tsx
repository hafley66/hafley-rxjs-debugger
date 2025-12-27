/**
 * PipeTree - JSX-style top-down tree visualization of observable pipe chains
 */

import type { ObservableMetadata } from '../../tracking/types';

interface PipeNode {
  observable: ObservableMetadata;
  children: PipeNode[];
}

interface PipeTreeProps {
  observables: ObservableMetadata[];
}

/**
 * Build tree from flat observable list using parent references
 *
 * Strategy:
 * 1. Roots: observables with no parent, no triggeredBy*, and not internal
 * 2. Pipe children: observables with `parent` field (from .pipe())
 * 3. Dynamic children: observables with `triggeredByObservable` (from switchMap, etc.)
 */
function buildTree(observables: ObservableMetadata[]): PipeNode[] {
  // Build lookup map by ID
  const byId = new Map<string, ObservableMetadata>();
  for (const obs of observables) {
    byId.set(obs.id, obs);
  }

  // Build children map
  const childrenByParentId = new Map<string, ObservableMetadata[]>();
  const roots: ObservableMetadata[] = [];

  // Categorize each observable
  for (const obs of observables) {
    // Skip internal subjects (from share/shareReplay)
    if (obs.isInternalSubject) continue;

    const hasParent = obs.parent !== undefined;
    const hasDynamicParent = obs.triggeredByObservable !== undefined;

    if (!hasParent && !hasDynamicParent) {
      // Root observable
      roots.push(obs);
    } else if (hasDynamicParent && obs.triggeredByObservable) {
      // Dynamic child (from switchMap, etc.) - link to triggering observable
      const parentId = obs.triggeredByObservable;
      const children = childrenByParentId.get(parentId) || [];
      children.push(obs);
      childrenByParentId.set(parentId, children);
    } else if (hasParent) {
      // Pipe child - find parent by walking backwards through observables
      // Parent should be the observable with operators.length = this.operators.length - 1
      // and matching prefix
      const parentOperatorCount = obs.operators.length - 1;

      // Find the observable that this was piped from
      for (const candidate of observables) {
        if (candidate.id === obs.id) continue;
        if (candidate.isInternalSubject) continue;

        // Check if candidate could be the parent:
        // - Same pipeGroupId, OR
        // - Candidate's operators are a prefix of this observable's operators
        if (candidate.pipeGroupId === obs.pipeGroupId &&
            candidate.operators.length === parentOperatorCount) {
          const children = childrenByParentId.get(candidate.id) || [];
          children.push(obs);
          childrenByParentId.set(candidate.id, children);
          break;
        }

        // Alternative: check operator prefix match
        if (parentOperatorCount >= 0 &&
            candidate.operators.length === parentOperatorCount) {
          const isPrefix = candidate.operators.every(
            (op, i) => obs.operators[i] === op
          );
          if (isPrefix) {
            const children = childrenByParentId.get(candidate.id) || [];
            children.push(obs);
            childrenByParentId.set(candidate.id, children);
            break;
          }
        }
      }
    }
  }

  // Build tree nodes recursively
  function buildNode(obs: ObservableMetadata, visited: Set<string>): PipeNode {
    visited.add(obs.id);
    const children: PipeNode[] = [];

    const childObs = childrenByParentId.get(obs.id) || [];
    for (const child of childObs) {
      if (!visited.has(child.id)) {
        children.push(buildNode(child, visited));
      }
    }

    return { observable: obs, children };
  }

  const visited = new Set<string>();
  return roots.map(root => buildNode(root, visited));
}

/**
 * Get the single operator that created this observable
 * (the last one in the chain, since operators accumulate)
 */
function getOwnOperator(obs: ObservableMetadata): string | undefined {
  if (obs.operators.length === 0) return undefined;
  return obs.operators[obs.operators.length - 1];
}

/**
 * Single tree node - observable with its children
 */
function TreeNode({ node, depth = 0 }: { node: PipeNode; depth?: number }) {
  const obs = node.observable;
  const indent = depth * 20;

  // Get just this observable's operator (last in chain)
  const ownOperator = getOwnOperator(obs);

  // Determine display name:
  // 1. Variable name if available
  // 2. Subject type for subjects
  // 3. Own operator for piped observables
  // 4. createdByOperator for dynamic inners (switchMap inner)
  // 5. ID as fallback
  const displayName = obs.variableName
    || obs.subjectType
    || ownOperator
    || obs.createdByOperator
    || obs.id;

  // Type label shows context info
  const typeLabel = obs.subjectType
    ? `(${obs.subjectType})`
    : obs.createdByOperator && !ownOperator
      ? `(inner of ${obs.createdByOperator})`
      : '';

  return (
    <div style={{ marginLeft: indent }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderLeft: depth > 0 ? '2px solid #374151' : 'none',
          marginBottom: 2,
        }}
      >
        {/* Tree connector */}
        {depth > 0 && (
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>└─</span>
        )}

        {/* Observable name */}
        <span
          style={{
            color: obs.subjectType ? '#60a5fa' : '#a78bfa',
            fontWeight: obs.subjectType ? 600 : 400,
            fontFamily: 'monospace',
          }}
        >
          {displayName}
        </span>

        {/* Type/operators label */}
        {typeLabel && (
          <span style={{ color: '#6b7280', fontSize: 12 }}>{typeLabel}</span>
        )}

        {/* ID badge */}
        <span
          style={{
            color: '#4b5563',
            fontSize: 10,
            background: '#1f2937',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          {obs.id}
        </span>
      </div>

      {/* Children */}
      {node.children.map((child) => (
        <TreeNode key={child.observable.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

/**
 * PipeTree - renders all observable pipe chains as a tree
 */
export function PipeTree({ observables }: PipeTreeProps) {
  const roots = buildTree(observables);

  // Debug: log observable metadata to understand structure
  console.log('[PipeTree] observables:', observables.map(o => ({
    id: o.id,
    subjectType: o.subjectType,
    ownOperator: getOwnOperator(o),
    operators: o.operators,
    hasParent: !!o.parent,
    triggeredByObs: o.triggeredByObservable,
    createdByOp: o.createdByOperator,
    isInternal: o.isInternalSubject,
    variableName: o.variableName,
  })));
  console.log('[PipeTree] roots:', roots.length);

  if (observables.length === 0) {
    return (
      <div style={{ color: '#6b7280', padding: 16 }}>
        No observables tracked yet.
      </div>
    );
  }

  // If tree building fails, show flat list as fallback
  if (roots.length === 0) {
    // Filter out internal subjects for cleaner view
    const visibleObs = observables.filter(o => !o.isInternalSubject);

    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
        <div style={{ color: '#9ca3af', marginBottom: 8 }}>
          {visibleObs.length} observables (flat view)
        </div>
        {visibleObs.map((obs) => {
          const ownOp = getOwnOperator(obs);
          const displayName = obs.variableName || obs.subjectType || ownOp || obs.createdByOperator || obs.id;
          const contextInfo = obs.createdByOperator && !ownOp ? `(inner of ${obs.createdByOperator})` : '';

          return (
            <div
              key={obs.id}
              style={{
                padding: '4px 8px',
                borderBottom: '1px solid #1f2937',
                display: 'flex',
                gap: 8,
              }}
            >
              <span style={{ color: obs.subjectType ? '#60a5fa' : '#a78bfa' }}>
                {displayName}
              </span>
              {contextInfo && (
                <span style={{ color: '#6b7280', fontSize: 12 }}>{contextInfo}</span>
              )}
              <span style={{ color: '#4b5563', fontSize: 11 }}>{obs.id}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      {roots.map((root) => (
        <TreeNode key={root.observable.id} node={root} />
      ))}
    </div>
  );
}
