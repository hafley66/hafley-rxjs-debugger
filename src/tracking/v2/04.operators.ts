import { from, of, timer } from "rxjs"
import * as rx from "rxjs/operators"
import { decorateCreate, decorateOperatorFun } from "./01.patch-observable"

export const proxy = {
  // Creation operators
  from: decorateCreate(from),
  of: decorateCreate(of),
  timer: decorateCreate(timer),
  combineLatest: decorateCreate(rx.combineLatest),
  merge: decorateCreate(rx.merge),

  // Pipeable operators
  map: decorateOperatorFun(rx.map),
  filter: decorateOperatorFun(rx.filter),
  scan: decorateOperatorFun(rx.scan),
  take: decorateOperatorFun(rx.take),
  skip: decorateOperatorFun(rx.skip),
  tap: decorateOperatorFun(rx.tap),

  // Higher-order operators (return observables)
  switchMap: decorateOperatorFun(rx.switchMap),
  mergeMap: decorateOperatorFun(rx.mergeMap),
  concatMap: decorateOperatorFun(rx.concatMap),
  exhaustMap: decorateOperatorFun(rx.exhaustMap),

  // Timing operators
  debounceTime: decorateOperatorFun(rx.debounceTime),
  throttleTime: decorateOperatorFun(rx.throttleTime),
  delay: decorateOperatorFun(rx.delay),

  // Filtering operators
  distinctUntilChanged: decorateOperatorFun(rx.distinctUntilChanged),

  // Error handling
  catchError: decorateOperatorFun(rx.catchError),
  retry: decorateOperatorFun(rx.retry),

  // Multicasting
  share: decorateOperatorFun(rx.share),
  shareReplay: decorateOperatorFun(rx.shareReplay),

  // Repeat/Retry with config
  repeat: decorateOperatorFun(rx.repeat),
}
