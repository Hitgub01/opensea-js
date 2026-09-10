/**
 * Transport used to perform an HTTP request, defaulting to the global `fetch`.
 *
 * Accepted by {@link OpenSeaAPIConfig.fetch} and by the auth helpers' configs, so a consumer can
 * install a cache, a shared rate limiter, retries or request-level instrumentation once instead
 * of wrapping each call site.
 *
 * @category API Models
 */
export type FetchImpl = typeof globalThis.fetch

/**
 * Perform a request through `impl`, or through the global `fetch` when no transport was
 * configured.
 *
 * The receiver is always `globalThis`, so a caller can pass native fetch unbound
 * (`fetch: globalThis.fetch`). Per Web IDL, an operation hanging off the global replaces a `null`
 * or `undefined` receiver with the global object, so a bare `impl(...args)` happens to work for
 * unbound native fetch; a receiver that is some *other* object does not. Verified in Chrome 152:
 * `fetch.call(undefined, url)` and `fetch.call(null, url)` both resolve, while `fetch.call({}, url)`
 * rejects with "Failed to execute 'fetch' on 'Window': Illegal invocation". Passing `globalThis`
 * explicitly is what keeps that distinction from depending on how each call site is written.
 *
 * A bound function or an arrow ignores the `thisArg`, so a transport the caller deliberately bound
 * keeps its own receiver.
 *
 * The global is read at call time rather than captured, so a caller who swaps `globalThis.fetch`
 * after construction still takes effect.
 */
export function fetchWith(
  impl: FetchImpl | undefined,
  ...args: Parameters<FetchImpl>
): Promise<Response> {
  const transport = impl ?? globalThis.fetch
  return transport.call(globalThis, ...args)
}
