import { useEffect, useState } from "react"
import { state$ } from "../00.types"
import { decycle } from "../01_helpers"
import { getAllSends, getRootObservables, getTopLevelSubscriptions } from "../06_queries"

export function DebuggerGrid() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const sub = state$.subscribe(() => forceUpdate(n => n + 1))
    return () => sub.unsubscribe()
  }, [])

  const store = state$.value.store
  const roots = getRootObservables(store)
  const subs = getTopLevelSubscriptions(store)
  const sends = getAllSends(store)
  return (
    <pre>
      <code>
        <div style={{ fontFamily: "monospace", fontSize: 12 }}>
          {/* Structure + Subscription columns */}
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 4, borderBottom: "1px solid #ccc" }}>Structure</th>
                {subs.map(s => (
                  <th key={s.id} style={{ padding: 4, borderBottom: "1px solid #ccc", minWidth: 80 }}>
                    Sub #{s.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roots.map(obs => (
                <RootRow key={obs.id} obsId={obs.id} subIds={subs.map(s => s.id)} />
              ))}
            </tbody>
          </table>

          {/* Sends table */}
          <div style={{ marginTop: 16, borderTop: "2px solid #666", paddingTop: 8 }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>Sends</div>
            <table style={{ borderCollapse: "collapse" }}>
              <tbody>
                {sends.map(send => (
                  <tr key={send.id}>
                    <td style={{ padding: 4, color: "#666" }}>#{send.id}</td>
                    <td style={{ padding: 4 }}>
                      <span
                        style={{ color: send.type === "error" ? "red" : send.type === "complete" ? "blue" : "green" }}
                      >
                        {send.type}
                      </span>
                      {send.type === "next" && `: ${decycle(send.value)}`}
                    </td>
                    <td style={{ padding: 4, color: "#999" }}>obs#{send.observable_id}</td>
                    <td style={{ padding: 4, color: "#999" }}>sub#{send.subscription_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </code>
    </pre>
  )
}

function RootRow({ obsId, subIds }: { obsId: string; subIds: string[] }) {
  const store = state$.value.store
  const obs = store.observable[obsId]
  if (!obs) return null

  // Find pipes for this observable
  const pipes = Object.values(store.pipe).filter(p => p.parent_observable_id === obsId)

  return (
    <>
      <tr>
        <td style={{ padding: 4 }}>
          {obs.name ?? "Observable"} #{obs.id}
        </td>
        {subIds.map(subId => (
          <SubCell key={subId} obsId={obsId} subId={subId} />
        ))}
      </tr>
      {pipes.map(pipe => (
        <PipeRows key={pipe.id} pipeId={pipe.id} subIds={subIds} depth={1} />
      ))}
    </>
  )
}

function PipeRows({ pipeId, subIds, depth }: { pipeId: string; subIds: string[]; depth: number }) {
  const store = state$.value.store
  const pipe = store.pipe[pipeId]
  if (!pipe) return null

  const operators = Object.values(store.operator)
    .filter(op => op.pipe_id === pipeId)
    .sort((a, b) => a.index - b.index)

  const indent = "  ".repeat(depth)

  return (
    <>
      <tr>
        <td style={{ padding: 4, color: "#666" }}>{indent}.pipe(</td>
        {subIds.map(subId => (
          <td key={subId} />
        ))}
      </tr>
      {operators.map(op => (
        <OperatorRow key={op.id} opId={op.id} subIds={subIds} depth={depth + 1} />
      ))}
      <tr>
        <td style={{ padding: 4, color: "#666" }}>
          {indent}) → #{pipe.observable_id}
        </td>
        {subIds.map(subId => (
          <td key={subId} />
        ))}
      </tr>
    </>
  )
}

function OperatorRow({ opId, subIds, depth }: { opId: string; subIds: string[]; depth: number }) {
  const store = state$.value.store
  const op = store.operator[opId]
  if (!op) return null

  const opFun = store.operator_fun[op.operator_fun_id]
  const indent = "  ".repeat(depth)

  return (
    <tr>
      <td style={{ padding: 4 }}>
        {indent}
        {opFun?.name ?? "op"}() → #{op.target_observable_id}
      </td>
      {subIds.map(subId => (
        <SubCell key={subId} obsId={op.target_observable_id} subId={subId} />
      ))}
    </tr>
  )
}

function SubCell({ obsId, subId }: { obsId: string; subId: string }) {
  const store = state$.value.store

  // Check if this subscription is for this observable or a descendant
  const sub = store.subscription[subId]
  if (!sub) return <td />

  // Walk up from sub to see if it touches this observable
  const touchesObs =
    sub.observable_id === obsId ||
    Object.values(store.subscription).some(s => s.parent_subscription_id === subId && s.observable_id === obsId)

  // Count sends for this obs+sub combo
  const sendCount = Object.values(store.send).filter(
    s => s.observable_id === obsId && s.subscription_id === subId,
  ).length

  return (
    <td style={{ padding: 4, textAlign: "center" }}>
      {touchesObs && <span style={{ color: "green" }}>●</span>}
      {sendCount > 0 && <span style={{ marginLeft: 4, color: "#999" }}>{sendCount}</span>}
    </td>
  )
}
