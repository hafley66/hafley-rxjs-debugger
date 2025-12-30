import { from, of } from "rxjs"
import rx from "rxjs/operators"
import { decorateCreate, decorateOperatorFun } from "./00.class-proxy"

export const proxy = {
  map: decorateOperatorFun(rx.map),
  filter: decorateOperatorFun(rx.filter),
  scan: decorateOperatorFun(rx.scan),
  take: decorateOperatorFun(rx.take),
  skip: decorateOperatorFun(rx.skip),
  repeat: decorateOperatorFun(rx.repeat),
  share: decorateOperatorFun(rx.share),
  switchMap: decorateOperatorFun(rx.switchMap),
  combineLatest: decorateCreate(rx.combineLatest),
  merge: decorateCreate(rx.merge),
  from: decorateCreate(from),
  of: decorateCreate(of),
}
