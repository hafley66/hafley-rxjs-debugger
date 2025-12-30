import { state$ } from "../00.types"
import { decycle } from "../01_helpers"
import { flattenSubTree, getSubTree, getTimeRange, type FlatSubRow } from "../06_queries"

type Props = {
  subId: string
  onBack: () => void
}

export function MarbleDiagram({ subId, onBack }: Props) {
  state$.use$()

  const store = state$.value.store
  const tree = getSubTree(store, subId)
  if (!tree) return <div>Subscription not found</div>

  const rows = flattenSubTree(tree)
  const timeRange = getTimeRange(rows)
  const width = timeRange.max - timeRange.min || 1

  return (
    <pre>
      <code>
        <div style={{ fontFamily: "monospace", fontSize: 12 }}>
          <button onClick={onBack} style={{ marginBottom: 8, cursor: "pointer" }}>
            ← Back to Overview
          </button>

          <div style={{ marginBottom: 8, fontWeight: "bold" }}>Sub #{subId} Tree</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map(row => (
              <MarbleLane key={row.sub.id} row={row} timeRange={timeRange} width={width} />
            ))}
          </div>

          <TimeAxis timeRange={timeRange} />
        </div>
      </code>
    </pre>
  )
}

function MarbleLane({
  row,
  timeRange,
  width,
}: {
  row: FlatSubRow
  timeRange: { min: number; max: number }
  width: number
}) {
  const store = state$.value.store
  const { sub, depth, sends } = row
  const obs = store.observable[sub.observable_id]

  const startPct = ((sub.created_at - timeRange.min) / width) * 100
  const endTime = sub.unsubscribed_at ?? sub.created_at_end ?? timeRange.max
  const widthPct = ((endTime - sub.created_at) / width) * 100

  return (
    <div style={{ display: "flex", alignItems: "center", height: 24 }}>
      {/* Tree indentation + label */}
      <div style={{ paddingLeft: depth * 16, width: 150, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {"└─".repeat(depth ? 1 : 0)}#{sub.id} ({obs?.name ?? "obs"})
      </div>

      {/* Marble timeline */}
      <div style={{ position: "relative", flex: 1, height: 24 }}>
        {/* Subscription lifespan line */}
        <div
          style={{
            position: "absolute",
            left: `${startPct}%`,
            width: `${widthPct}%`,
            height: 2,
            background: "#666",
            top: 11,
          }}
        />

        {/* Marble events */}
        {sends.map(send => {
          const leftPct = ((send.created_at - timeRange.min) / width) * 100
          return <Marble key={send.id} send={send} leftPct={leftPct} />
        })}
      </div>
    </div>
  )
}

function Marble({
  send,
  leftPct,
}: {
  send: { id: string; type: string; value?: any; created_at: number }
  leftPct: number
}) {
  const color = send.type === "error" ? "red" : send.type === "complete" ? "blue" : "green"
  const symbol = send.type === "complete" ? "|" : send.type === "error" ? "✗" : "●"
  const title = send.type === "next" ? JSON.stringify(decycle(send.value)) : send.type

  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        transform: "translateX(-50%)",
        top: 4,
        cursor: "pointer",
      }}
      title={title}
    >
      <span style={{ color }}>{symbol}</span>
    </div>
  )
}

function TimeAxis({ timeRange }: { timeRange: { min: number; max: number } }) {
  const width = timeRange.max - timeRange.min
  if (width === 0) return null

  // Generate tick marks (roughly 5 ticks)
  const step = Math.ceil(width / 5 / 100) * 100 || 1
  const ticks: number[] = []
  for (let t = Math.ceil(timeRange.min / step) * step; t <= timeRange.max; t += step) {
    ticks.push(t)
  }

  return (
    <div style={{ display: "flex", marginTop: 8, marginLeft: 150, position: "relative", height: 20 }}>
      {ticks.map(t => {
        const leftPct = ((t - timeRange.min) / width) * 100
        return (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              transform: "translateX(-50%)",
              fontSize: 10,
              color: "#999",
            }}
          >
            {t}ms
          </div>
        )
      })}
    </div>
  )
}
