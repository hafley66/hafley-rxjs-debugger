/**
 * its all just random scoping at this point. so mark and observe. have all have IDs and then snapshot what ids existed when since everything is ordered start/end
 * we just snapshot things by ids in table of all relations generically lmfao.
 *
 * so entity x has active id of A, y has B, no entity z, so no C, so we snapshot that new entity as being scoped by those relaitons by being in this table. we would
 *
 * decoarate all of observable class tree and catch those events in a buffer somewher on global.
 * use vite plugin to force parsing and bundling rxjs with code manip using ast-grep on matching class expressions and add decorators or proxies inlined
 */

import { BehaviorSubject } from "rxjs/internal/BehaviorSubject"
import { Observable } from "rxjs/internal/Observable"
import { Subject } from "rxjs/internal/Subject"
import { filter, scan, startWith } from "rxjs/operators"

type Prettify<T> = { [K in keyof T]: T[K] } & NonNullable<unknown>

export type ObservableRef = {
  observable_id: string
  path: string // lodash-style: "args.0.delay.$return"
}

export const _observableEvents$ = new Subject<
  | (
      | { type: "operator-fun-call"; id: string; name: string; args: any[] }
      | { type: "operator-fun-call-return"; id: string }
      | { type: "operator-call"; id: string; operator_fun_id: string; source_observable_id: string; index: number }
      | { type: "operator-call-return"; id: string; target_observable_id: string }
      | { type: "arg-call"; id: string; arg_id: string; args: any[] }
      | { type: "arg-call-return"; id: string; observable_id?: string; subscription_id?: string }
    )
  | ({ source: string } & ( // Auto id pre obs construction
      | { type: "constructor-call"; id: string }
      | { type: "constructor-call-return"; id: string; observable: Observable<any> }
    ))
  | { type: "factory-call-return"; id: string; observable: Observable<any>; args: any[] }
  | ({ observable_id: string; id: string } & (
      | { type: "pipe-get" }
      | { type: "pipe-call"; args: any[]; index: number }
      | { type: "pipe-call-return" }
      | { type: "subscribe-call"; args: any[]; index: number }
      | { type: "subscribe-call-return" }
      | ({ type: "send-call"; subscription_id: string } & (
          | { kind: "next"; value: any; index: number }
          | { kind: "error"; error: Error }
          | { kind: "complete" }
        ))
      | { type: "send-call-return" }
      | { type: "unsubscribe-call"; args: any[]; index: number }
      | { type: "unsubscribe-call-return" }
    ))
>()

type Hmm = {
  // Unified observable entity (collapse Subject/BehaviorSubject/creation ops)
  observable: {}
  // Operator factory call with bound args
  operator_fun: {}
  // Operator usage in pipe (references operator_fun)
  operator: {
    operator_fun_id: string
    pipe_id: string
    index: number // position in pipe chain
    source_observable_id: string
    target_observable_id: string
  }
  // Pipe call
  pipe: {
    parent_observable_id: string
    observable_id: string // final output
  }
  // Subscription (dual timespan: call-time scope AND async lifespan)
  subscription: {
    unsubscribed_at?: number // unsubscribe-call timestamp
    unsubscribed_at_end?: number // unsubscribe-call-return timestamp
    observable_id: string
    parent_subscription_id?: string
    is_sync: boolean
  }
  // Arg position (static observable refs + function positions)
  arg: {
    path: string // "args.0.delay" or "args.0.0"
    observable_id?: string // if static obs ref
    owner_id: string // generic - check stores dynamically
    is_function: boolean
  }
  // Arg function execution (dynamic observable creation)
  arg_call: {
    arg_id: string
    observable_id?: string // the observable returned
    subscription_id?: string // which subscription triggered this
    input_values?: any[]
  }
  // Emission (NOT implementing yet - focus on structure first)
  send: {
    observable_id: string
    subscription_id: string
    type: "next" | "error" | "complete"
    value?: any
  }
}

type Improved = {
  [K in keyof Hmm]: Prettify<Hmm[K] & { id: string; created_at: number; name?: string; created_at_end?: number }>
}

export type State = {
  isEnabled: boolean
  owner_id: string
  stack: { [K in keyof Improved]: Improved[K][] }
  store: { [K in keyof Improved]: Record<string, Improved[K]> }
  rel: ({ [K in keyof Improved as `${K}_id`]: string } & { owner_id: string })[]
}

export function scanEager<Event, State>(acc: (sum: State, next: Event) => State, defaultValue: State) {
  return (source$: Observable<Event>) => source$.pipe(scan(acc, defaultValue), startWith(defaultValue))
}

class EasierBS<T extends {}> extends BehaviorSubject<T> {
  set(partial: Partial<T>) {
    return this.next({
      ...this.value,
      ...partial,
    })
  }

  scanEager<Next>(accumulator: (sum: T, next: Next) => T) {
    return (source$: Observable<Next>) => {
      return source$.pipe(scanEager(accumulator, this.value))
    }
  }
}

export const state$ = new EasierBS<State>({
  isEnabled: false,
  owner_id: "",
  rel: [],
  stack: {
    observable: [],
    operator_fun: [],
    operator: [],
    pipe: [],
    subscription: [],
    arg: [],
    arg_call: [],
    send: [],
  },
  store: {
    observable: {},
    operator_fun: {},
    operator: {},
    pipe: {},
    subscription: {},
    arg: {},
    arg_call: {},
    send: {},
  },
})

export const observableEventsEnabled$ = _observableEvents$.pipe(filter(() => state$.value.isEnabled))

type EntityKey = keyof Improved

export function leftJoin<
  L extends EntityKey,
  R extends EntityKey,
  LKey extends keyof Improved[L] & string,
  RKey extends keyof Improved[R] & string,
>(
  left: { table: L; key: LKey },
  right: { table: R; key: RKey },
  state: State = state$.value,
): (Improved[L] & { [K in R]?: Improved[R] })[] {
  const leftRecords = Object.values(state.store[left.table]) as Improved[L][]
  const rightStore = state.store[right.table] as Record<string, Improved[R]>

  const rightIndex = new Map<unknown, Improved[R]>()
  for (const record of Object.values(rightStore)) {
    rightIndex.set(record[right.key as keyof Improved[R]], record)
  }

  return leftRecords.map(leftRow => {
    const leftVal = leftRow[left.key as keyof Improved[L]]
    const rightRow = rightIndex.get(leftVal)
    return {
      ...leftRow,
      [right.table]: rightRow,
    } as Improved[L] & { [K in R]?: Improved[R] }
  })
}
