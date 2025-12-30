import type { State } from "./00.types"

type Store = State["store"]

// Get root observables (not operator targets, not runtime created)
export function getRootObservables(store: Store) {
  const runtimeObsIds = new Set(
    Object.values(store.arg_call)
      .map(ac => ac.observable_id)
      .filter(Boolean),
  )
  const operatorTargets = new Set(Object.values(store.operator).map(op => op.target_observable_id))

  return Object.values(store.observable)
    .filter(obs => !operatorTargets.has(obs.id) && !runtimeObsIds.has(obs.id))
    .sort((a, b) => a.created_at - b.created_at)
}

// Get pipes for an observable
export function getPipesFor(store: Store, obsId: string) {
  return Object.values(store.pipe)
    .filter(p => p.parent_observable_id === obsId)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get operators in a pipe, sorted by index
export function getOperatorsIn(store: Store, pipeId: string) {
  return Object.values(store.operator)
    .filter(op => op.pipe_id === pipeId)
    .sort((a, b) => a.index - b.index)
}

// Get args for an operator_fun
export function getArgsFor(store: Store, operatorFunId: string) {
  return Object.values(store.arg).filter(a => a.owner_id === operatorFunId)
}

// Get top-level subscriptions (no parent)
export function getTopLevelSubscriptions(store: Store) {
  return Object.values(store.subscription)
    .filter(s => !s.parent_subscription_id)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get child subscriptions
export function getChildSubscriptions(store: Store, parentSubId: string) {
  return Object.values(store.subscription)
    .filter(s => s.parent_subscription_id === parentSubId)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get sends for a subscription
export function getSendsFor(store: Store, subId: string) {
  return Object.values(store.send)
    .filter(s => s.subscription_id === subId)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get all sends sorted by time
export function getAllSends(store: Store) {
  return Object.values(store.send).sort((a, b) => a.created_at - b.created_at)
}

// Get dynamic observables created by an arg during a subscription
export function getDynamicObs(store: Store, argId: string, subId?: string) {
  return Object.values(store.arg_call)
    .filter(ac => ac.arg_id === argId && (!subId || ac.subscription_id === subId))
    .map(ac => (ac.observable_id ? store.observable[ac.observable_id] : null))
    .filter(Boolean)
}

// Check if observable is a runtime-created one (from arg_call)
export function isRuntimeObs(store: Store, obsId: string) {
  return Object.values(store.arg_call).some(ac => ac.observable_id === obsId)
}

// Get the arg_call that created an observable
export function getArgCallForObs(store: Store, obsId: string) {
  return Object.values(store.arg_call).find(ac => ac.observable_id === obsId)
}
