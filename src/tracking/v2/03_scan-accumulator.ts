import { observableEventsEnabled$, state$ } from "./00.types"
import { now, observableIdMap } from "./01_helpers"
import { crawlArgs } from "./02_arg-crawler"

observableEventsEnabled$
  .pipe(
    state$.scanEager((state, event) => {
      switch (event.type) {
        case "constructor-call": {
          state.stack.observable.push({
            id: event.id,
            created_at: now(),
            name: `new ${event.source}`,
          })
          state.store.observable[event.id] = state.stack.observable[state.stack.observable.length - 1]!
          break
        }

        case "constructor-call-return": {
          const entity = state.stack.observable.pop()
          observableIdMap.set(event.observable, event.id)

          if (!entity) break
          entity.created_at_end = now()
          break
        }

        case "pipe-get": {
          state.stack.pipe.push({
            id: event.id,
            created_at: now(),
            parent_observable_id: event.observable_id,
            observable_id: "", // Will be set on pipe-call-return
          })
          state.store.pipe[event.id] = state.stack.pipe[state.stack.pipe.length - 1]!

          break
        }

        case "pipe-call": {
          const pipeEntity = state.stack.pipe[state.stack.pipe.length - 1]
          if (pipeEntity) {
          }
          break
        }

        case "pipe-call-return": {
          const entity = state.stack.pipe.pop()
          if (!entity) break
          entity.created_at_end = now()
          entity.observable_id = event.observable_id
          break
        }

        case "subscribe-call": {
          state.store.subscription[event.id] = {
            id: event.id,
            created_at: now(),
            observable_id: event.observable_id,
            parent_subscription_id: state.stack.subscription[state.stack.subscription.length - 1]?.id,
            is_sync: false, // Will be updated if complete/error fires before subscribe-call-return
          }
          state.stack.subscription.push(state.store.subscription[event.id]!)
          break
        }

        case "subscribe-call-return": {
          const subEntity = state.stack.subscription.pop()
          if (subEntity) {
            subEntity.created_at_end = now()
            // TODO: Check is_sync flag (did complete/error fire before this?)
          }

          break
        }

        case "unsubscribe-call": {
          const subEntity = state.store.subscription[event.id]
          if (subEntity) {
            subEntity.unsubscribed_at = now()
          }
          break
        }

        case "unsubscribe-call-return": {
          const entity = state.store.subscription[event.id]
          if (entity) {
            entity.unsubscribed_at_end = now()
          }
          break
        }

        case "send-call": {
          state.store.send[event.id] = {
            created_at: now(),
            id: event.id,
            observable_id: event.observable_id,
            subscription_id: event.subscription_id,
            type: event.kind,
            ...(event.kind === "next" ? { value: event.value } : event.kind === "error" ? { error: event.error } : {}),
          }
          state.stack.send.push(state.store.send[event.id]!)
          break
        }

        case "send-call-return": {
          const val = state.stack.send.pop()
          if (!val) break
          val.created_at_end = now()
          break
        }

        case "operator-fun-call": {
          state.store.operator_fun[event.id] = {
            created_at: now(),
            id: event.id,
            name: event.name,
          }
          state.stack.operator.push(state.store.operator[event.id]!)
          break
        }
        case "operator-fun-call-return": {
          const val = state.stack.operator_fun.pop()
          if (!val) break
          val.created_at_end = now()
          break
        }
        case "operator-call": {
          state.store.operator[event.id] = {
            created_at: now(),
            id: event.id,
            operator_fun_id: event.operator_fun_id,
            source_observable_id: event.source_observable_id,
            target_observable_id: "",
            pipe_id: state.stack.pipe[state.stack.pipe.length - 1]?.id ?? "UNKNOWN",
            index: event.index,
          }
          state.stack.operator.push(state.store.operator[event.id]!)
          break
        }
        case "operator-call-return": {
          const val = state.stack.operator.pop()
          if (!val) break
          val.created_at_end = now()
          val.target_observable_id = event.target_observable_id
          break
        }

        case "arg-call": {
          state.store.arg_call[event.id] = {
            arg_id: event.arg_id,
            created_at: now(),
            id: event.id,
            input_values: event.args,
            subscription_id: state.stack.subscription[state.stack.subscription.length - 1]?.id ?? "unknown",
          }
          break
        }
        case "arg-call-return": {
          const val = state.stack.arg_call.pop()
          if (!val) break
          val.created_at_end = now()
          val.observable_id = event.observable_id
          break
        }
        case "factory-call-return": {
          const obsId = observableIdMap.get(event.observable) ?? "unknown"
          const args = crawlArgs(event.args, obsId)
          for (const arg of args) {
            state.store.arg[arg.id] = arg
            arg.observable_id = obsId
          }
          break
        }
      }

      return state
    }),
  )
  .subscribe()
