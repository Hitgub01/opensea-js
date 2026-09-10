import { afterEach, describe, expect, test, vi } from "vitest"
import { OpenSeaSDK as EthersSDK } from "../../src"
import { OpenSeaAPI } from "../../src/api/api"
import { OpenSeaSDK as ViemSDK } from "../../src/viem"

/**
 * `OpenSeaSDK.requestInstantApiKey` is the entrypoint the README hands new consumers, and it is
 * the first call an app makes, before any SDK instance exists to carry a configured transport.
 * It has to accept the same options as the `OpenSeaAPI` static it delegates to: when it dropped
 * them, a consumer routing every request through its own transport had to abandon the documented
 * entrypoint for the lower-level helper. Both entrypoints inherit the static from
 * `BaseOpenSeaSDK`, so cover both rather than trusting inheritance to keep them equal.
 */
describe.each([
  ["ethers", EthersSDK],
  ["viem", ViemSDK],
  ["api", OpenSeaAPI],
])("%s requestInstantApiKey", (_name, entrypoint) => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })

  test("uses the transport passed to it", async () => {
    const injected = vi.fn().mockResolvedValue(ok({ api_key: "from-injected" }))
    const globalFetch = vi.spyOn(globalThis, "fetch")

    const result = await entrypoint.requestInstantApiKey(undefined, {
      fetch: injected,
    })

    expect(result.apiKey).toBe("from-injected")
    expect(injected).toHaveBeenCalledTimes(1)
    expect(globalFetch).not.toHaveBeenCalled()
  })

  test("forwards the base URL override alongside the transport", async () => {
    const injected = vi.fn().mockResolvedValue(ok({ api_key: "from-injected" }))

    await entrypoint.requestInstantApiKey("https://testnets-api.opensea.io", {
      fetch: injected,
    })

    expect(String(injected.mock.calls[0][0])).toBe(
      "https://testnets-api.opensea.io/api/v2/auth/keys",
    )
  })

  test("falls back to the global fetch when no transport is passed", async () => {
    const globalFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok({ api_key: "from-global" }))

    const result = await entrypoint.requestInstantApiKey()

    expect(result.apiKey).toBe("from-global")
    expect(globalFetch).toHaveBeenCalledTimes(1)
    expect(String(globalFetch.mock.calls[0][0])).toBe(
      "https://api.opensea.io/api/v2/auth/keys",
    )
  })

  test("surfaces a server error rather than the raw body", async () => {
    const injected = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 429 }))

    await expect(
      entrypoint.requestInstantApiKey(undefined, { fetch: injected }),
    ).rejects.toThrow(/429/)
  })
})

/**
 * `describe.each` widens `entrypoint` enough that TypeScript stops checking the real signature,
 * so the loop above pins runtime forwarding but not the declared arity. The issue had a
 * compile-time half too: passing the options to the SDK method failed with
 * `TS2554: Expected 0-1 arguments, but got 2`. These call each concrete class directly, so
 * `pnpm check-types` fails if either entrypoint loses the second parameter.
 */
describe("accepts the options argument at the type level", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const ok = () =>
    new Response(JSON.stringify({ api_key: "from-injected" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })

  test("on the ethers entrypoint", async () => {
    const injected = vi.fn().mockResolvedValue(ok())

    await expect(
      EthersSDK.requestInstantApiKey(undefined, { fetch: injected }),
    ).resolves.toEqual({ apiKey: "from-injected" })
  })

  test("on the viem entrypoint", async () => {
    const injected = vi.fn().mockResolvedValue(ok())

    await expect(
      ViemSDK.requestInstantApiKey(undefined, { fetch: injected }),
    ).resolves.toEqual({ apiKey: "from-injected" })
  })
})
