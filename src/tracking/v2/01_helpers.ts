import type { Observable } from "rxjs"
import { v7 } from "uuid"

let _idCounter = 0
const isTest = process.env.NODE_ENV === "test" || import.meta.env?.MODE === "test"

export function resetIdCounter() {
  _idCounter = 0
}

export function createId(): string {
  if (isTest) {
    return String(_idCounter++)
  }
  return v7()
}

export function now(): number {
  return performance.now()
}

export const observableIdMap = new WeakMap<Observable<any>, string>()
