import { describe, expect, test } from "vitest"
import type { AccountsAPI } from "../../src/api/accounts"
import type { OpenSeaAPI } from "../../src/api/api"
import type { AssetsAPI } from "../../src/api/assets"
import type { ChainsAPI } from "../../src/api/chains"
import type { CollectionsAPI } from "../../src/api/collections"
import type { DropsAPI } from "../../src/api/drops"
import type { EventsAPI } from "../../src/api/events"
import type { ListingsAPI } from "../../src/api/listings"
import type { NFTsAPI } from "../../src/api/nfts"
import type { OffersAPI } from "../../src/api/offers"
import type { OrdersAPI } from "../../src/api/orders"
import type { SearchAPI } from "../../src/api/search"
import type { TokensAPI } from "../../src/api/tokens"
import type { TransactionsAPI } from "../../src/api/transactions"
import {
  type ForwardedAs,
  NO_FLAT_SURFACE,
  subClientPrototypes,
} from "../utils/forwarderContract"

/**
 * Signature drift between a sub-client method and the `OpenSeaAPI` forwarder that delegates to it.
 *
 * `subclientReachability.spec.ts` covers the half that broke in
 * [opensea-sdk#2007](https://github.com/ProjectOpenSea/opensea-sdk/issues/2007): a method with no
 * forwarder at all. It cannot see the other half, where a forwarder exists but no longer accepts
 * what the method accepts. That is the quieter failure of the same design, because the parameter a
 * forwarder omits is not missing from the SDK, it is missing only from the way anyone calls it.
 * `getAllListings` dropping `includePrivateListings` would leave every caller silently unable to
 * ask for private listings, with the method still present and every existing test still passing.
 *
 * There is no drift today. These assertions exist so that stays true: `tsconfig.check.json`
 * includes `test`, so a mismatch fails `check-types` rather than reaching a release.
 *
 * The check is compile-time because parameter and return types are erased at runtime, so no
 * runtime assertion can see them. That means the sub-client list here is written out rather than
 * read off an instance the way the reachability test does. The reachability test is what covers a
 * sub-client added and forgotten; the `coversEverySubClient` assertion below ties this list to that
 * one so the two cannot disagree about which sub-clients exist.
 */

type AnyFn = (...args: never[]) => unknown

/**
 * `any` is mutually assignable with every type, so it would satisfy `Exact` against anything. A
 * forwarder whose signature had degraded to `any` would then pass the very check that is supposed
 * to pin it, which is why the comparisons below reject it on either side rather than treating it
 * as a match.
 *
 * No sub-client or forwarder uses `any` today, and biome's `noExplicitAny` keeps anyone from
 * writing one, so the realistic route in is inference from an untyped value rather than an
 * annotation. That is also the limit of this guard: it covers a parameter or return type that is
 * `any`, including under a `Promise`, and not an `any` nested deeper inside an object type.
 */
type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * True if any element of the parameter list is `any`.
 *
 * The `T[number]` test comes first because it is the only one that sees an array-shaped list.
 * `Parameters<(...args: any[]) => R>` is `any[]`, not a tuple, so it never matches the head/tail
 * pattern and the walk alone would report it clean. It also catches `any` in a rest element of an
 * otherwise ordinary tuple. `Required` then strips optionality, so `[a: string, b?: number]` walks
 * to completion rather than failing to match.
 */
type HasAnyElement<T extends readonly unknown[]> =
  IsAny<T[number]> extends true
    ? true
    : Required<T> extends readonly [infer H, ...infer R]
      ? IsAny<H> extends true
        ? true
        : HasAnyElement<R>
      : false

/** Mutual assignability, so neither a widened nor a narrowed signature passes. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/** `Exact`, plus a rejection of `any` at any position on either side. */
type ExactParams<A extends readonly unknown[], B extends readonly unknown[]> =
  HasAnyElement<A> extends true
    ? false
    : HasAnyElement<B> extends true
      ? false
      : Exact<A, B>

/** `Exact`, plus a rejection of `any` on either side, including as a `Promise`'s value. */
type ExactReturn<A, B> =
  IsAny<Awaited<A>> extends true
    ? false
    : IsAny<Awaited<B>> extends true
      ? false
      : Exact<A, B>

/** The public name of `Sub.K` on `OpenSeaAPI`, accounting for a deliberate rename. */
type ExposedName<
  N extends string,
  K extends string,
> = `${N}.${K}` extends keyof ForwardedAs ? ForwardedAs[`${N}.${K}`] : K

/**
 * The methods of `Sub` whose forwarder signature disagrees with theirs, as object keys.
 *
 * A method with no forwarder is not reported here; that is the reachability test's job. Reporting
 * it in both places would mean one gap failing two suites with two different explanations.
 */
type SignatureDrift<N extends string, Sub> = {
  [K in Extract<keyof Sub, string> as Sub[K] extends AnyFn
    ? Extract<ExposedName<N, K>, keyof OpenSeaAPI> extends infer E
      ? [E] extends [never]
        ? never
        : OpenSeaAPI[Extract<E, keyof OpenSeaAPI>] extends AnyFn
          ? ExactParams<
              Parameters<Sub[K]>,
              Parameters<
                Extract<OpenSeaAPI[Extract<E, keyof OpenSeaAPI>], AnyFn>
              >
            > extends true
            ? ExactReturn<
                ReturnType<Sub[K]>,
                ReturnType<
                  Extract<OpenSeaAPI[Extract<E, keyof OpenSeaAPI>], AnyFn>
                >
              > extends true
              ? never
              : K
            : K
          : never
      : never
    : never]: true
}

/**
 * Each entry fails `check-types` if that sub-client has a forwarder whose signature drifted, and
 * names the method in the error.
 */
type Drift = {
  AccountsAPI: SignatureDrift<"AccountsAPI", AccountsAPI>
  AssetsAPI: SignatureDrift<"AssetsAPI", AssetsAPI>
  ChainsAPI: SignatureDrift<"ChainsAPI", ChainsAPI>
  CollectionsAPI: SignatureDrift<"CollectionsAPI", CollectionsAPI>
  DropsAPI: SignatureDrift<"DropsAPI", DropsAPI>
  EventsAPI: SignatureDrift<"EventsAPI", EventsAPI>
  ListingsAPI: SignatureDrift<"ListingsAPI", ListingsAPI>
  NFTsAPI: SignatureDrift<"NFTsAPI", NFTsAPI>
  OffersAPI: SignatureDrift<"OffersAPI", OffersAPI>
  OrdersAPI: SignatureDrift<"OrdersAPI", OrdersAPI>
  SearchAPI: SignatureDrift<"SearchAPI", SearchAPI>
  TokensAPI: SignatureDrift<"TokensAPI", TokensAPI>
  TransactionsAPI: SignatureDrift<"TransactionsAPI", TransactionsAPI>
}

/**
 * Empty at every key while no forwarder has drifted. A drifted method makes its sub-client's entry
 * non-empty, and the annotation reports the method name.
 */
const noDrift: { [N in keyof Drift]: Record<keyof Drift[N] & string, never> } =
  {
    AccountsAPI: {},
    AssetsAPI: {},
    ChainsAPI: {},
    CollectionsAPI: {},
    DropsAPI: {},
    EventsAPI: {},
    ListingsAPI: {},
    NFTsAPI: {},
    OffersAPI: {},
    OrdersAPI: {},
    SearchAPI: {},
    TokensAPI: {},
    TransactionsAPI: {},
  }

describe("forwarder signatures", () => {
  test("no OpenSeaAPI forwarder has drifted from the method it forwards to", () => {
    // The real assertion is the annotation on `noDrift`, checked by `check-types`. This keeps the
    // file a test rather than a type-only module that a reader could mistake for dead code, and
    // fails loudly if an entry is ever given a non-empty value by hand.
    for (const [client, drifted] of Object.entries(noDrift)) {
      expect({ client, drifted: Object.keys(drifted) }).toEqual({
        client,
        drifted: [],
      })
    }
  })

  test("covers every sub-client OpenSeaAPI installs", () => {
    // The `Drift` keys are written by hand because types are erased at runtime. Adding a
    // sub-client and not adding it here would leave its forwarders unchecked while this file still
    // passed, which is the reachability gap one level up. Compared against the same live
    // enumeration the reachability test uses, so the two lists cannot disagree.
    const withFlatForwarders = [...subClientPrototypes().keys()].filter(
      name => !(name in NO_FLAT_SURFACE),
    )

    expect(Object.keys(noDrift).sort()).toEqual(withFlatForwarders.sort())
  })
})
