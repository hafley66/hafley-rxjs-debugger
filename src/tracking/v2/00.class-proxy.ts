import { BehaviorSubject } from "rxjs/internal/BehaviorSubject"
import { Observable } from "rxjs/internal/Observable"
import { Subject } from "rxjs/internal/Subject"
import { SafeSubscriber } from "rxjs/internal/Subscriber"
import { _observableEvents$ as events$, state$ } from "./00.types"
import { createId, observableIdMap } from "./01_helpers"

export function proxyClass<
  T extends { new (...args: any[]): Observable<any>; create(...args: any[]): Observable<any> },
>(class_: T): T {
  const source = class_.name
  return new Proxy<T>(class_, {
    get(target, p) {
      if (p === "create") {
        // @ts-expect-error sentinel value
        if (target.create._wrapped) {
          return target.create
        }
        // We must not track lift it will cause hella noise.
        const old = target.create.bind(target)
        target.create = (...args) => {
          const og = state$.value.isEnabled
          // state$.set({ isEnabled: false })

          try {
            return old(...args)
          } catch (e) {
            // state$.set({ isEnabled: og })
            throw e
          }
        }
        // @ts-expect-error sentinel value
        target.create._wrapped = true
        return target.create
      }
      // @ts-expect-error symbol
      return target[p]
    },
    construct: (target, args) => {
      const id = createId()
      const observable_id = id
      events$.next({ source, type: "constructor-call", id })
      const next = new target(...args)
      events$.next({ source, type: "constructor-call-return", id, observable: next })

      return new Proxy<Observable<any>>(next, {
        get(target, p) {
          if (p === "lift") {
            // @ts-expect-error sentinel value
            if (target.lift._wrapped) {
              return target.lift
            }
            // We must not track lift it will cause hella noise.
            const old = target.lift.bind(target)
            target.lift = (...args) => {
              const og = state$.value.isEnabled
              // state$.set({ isEnabled: false })

              try {
                return old(...args)
              } catch (e) {
                // state$.set({ isEnabled: og })
                throw e
              }
            }
            // @ts-expect-error sentinel value
            target.lift._wrapped = true
            return target.lift
          }
          if (p === "pipe") {
            const id = createId()
            events$.next({ observable_id, type: "pipe-get", id })
            let index = 0
            return (...args: any[]) => {
              const ind = index++
              events$.next({ observable_id, type: "pipe-call", args, id, index: ind })
              const decoratedOps = args.map((op, index) => {
                return (source: any) => {
                  const id = createId()
                  events$.next({
                    type: "operator-call",
                    id,
                    operator_fun_id: op?.operator_fun_id,
                    source_observable_id: observableIdMap.get(source) ?? "UNKNOWN",
                    index,
                  })
                  const out = op(source)
                  console.log({ out })
                  events$.next({
                    type: "operator-call-return",
                    id,
                    target_observable_id: observableIdMap.get(out) ?? "UNKNOWN",
                  })
                  return out
                }
              })
              const out = target.pipe<any, any>(
                // @ts-expect-error something about spread.
                ...decoratedOps,
              )
              events$.next({
                observable_id: observableIdMap.get(out) ?? "UNKNOWN",
                type: "pipe-call-return",
                id,
              })
              return out
            }
          }
          if (p === "subscribe") {
            const id = createId()
            const subscription_id = id
            let index = 0
            const out = (...args: any[]) => {
              const ind = index++
              events$.next({ observable_id, type: "subscribe-call", args, id, index: ind })
              const safe = new SafeSubscriber(...args)
              const next = safe.next.bind(safe)
              let nextIndex = null as null | number
              safe.next = value => {
                const ndex = (nextIndex ??= 0)
                nextIndex++
                const id = createId()
                events$.next({
                  subscription_id,
                  type: "send-call",
                  id,
                  observable_id,
                  kind: "next",
                  value,
                  index: ndex,
                })
                next(value)
                events$.next({
                  type: "send-call-return",
                  id,
                  observable_id,
                })
              }
              const complete = safe.complete.bind(safe)
              safe.complete = () => {
                events$.next({
                  subscription_id,
                  type: "send-call",
                  id,
                  observable_id,
                  kind: "complete",
                })
                complete()
                events$.next({
                  type: "send-call-return",
                  id,
                  observable_id,
                })
              }

              const error = safe.error.bind(safe)
              safe.error = err => {
                events$.next({
                  subscription_id,
                  type: "send-call",
                  id,
                  observable_id,
                  kind: "error",
                  error: err,
                })
                error(err)
                events$.next({
                  type: "send-call-return",
                  id,
                  observable_id,
                })
              }

              const sub = target.subscribe(safe)
              events$.next({ observable_id, type: "subscribe-call-return", id })
              const originalUnsubscribe = sub.unsubscribe.bind(sub)
              Object.defineProperty(sub, "unsubscribe", {
                get() {
                  return () => {
                    events$.next({ observable_id, type: "unsubscribe-call", args, id, index: ind })
                    const result = originalUnsubscribe()
                    events$.next({ observable_id, type: "unsubscribe-call-return", id })
                    return result
                  }
                },
              })
              return sub
            }
            return out
          }

          // @ts-expect-error wtf its fine lol
          return target[p]
        },
      })
    },
  })
}

// Only way to trap pre-super call/prefix of constructor. tc39 stage 3 class decorators in the future but this works now.
export const ProxyObservable = proxyClass(Observable) as typeof Observable
export const ProxySubject = proxyClass(Subject) as typeof Subject
export const ProxyBehaviorSubject = proxyClass(BehaviorSubject) as typeof BehaviorSubject

export type ProxyObservable<T> = Observable<T>
export type ProxySubject<T> = Subject<T>
export type ProxyBehaviorSubject<T> = BehaviorSubject<T>

export const decorateOperatorFun = <T extends Function>(operator_fun: T, name = operator_fun.name) => {
  const decorated = {
    [name]: (...args: any[]) => {
      const id = createId()
      events$.next({
        type: "operator-fun-call",
        id,
        name,
        args,
      })
      const out = operator_fun(...args)
      events$.next({
        type: "operator-fun-call-return",
        id,
      })
      return out
    },
  }[name]

  ;(decorated! as any).displayName = name
  return decorated
}

export const decorateCreate = <T extends Function>(fun: T, name = fun.name) => {
  const decorated = (...args: any[]) => {
    const id = createId()
    const out = fun(...args)
    events$.next({
      type: "factory-call-return",
      id,
      observable: out,
      args,
    })
    return out
  }

  decorated.displayName = name

  return decorated
}

export const decorateHigherMap = <T extends Function>(operator_fun: T, name = operator_fun.name) => {}
