import { describe, expect, it } from "vitest"
import * as apiPaths from "../../src/api/apiPaths"
import {
  API_V2_PREFIX,
  getCollectionStatsPath,
  segment,
} from "../../src/api/apiPaths"

describe("segment", () => {
  it("leaves every legitimate path value unchanged", () => {
    const untouched = [
      "boredapeyachtclub",
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      "1234",
      "0x0e3a2cfb6bd2a2b0dfb4d0a0e2e14e0e5f0e6b7c8d9e0f1a2b3c4d5e6f708192",
    ]
    for (const value of untouched) {
      expect(segment(value)).toBe(value)
    }
    expect(segment(42)).toBe("42")
  })

  it.each([".", ".."])("rejects the bare dot segment %s", value => {
    // Encoding cannot fix these: the WHATWG URL parser decodes percent-escapes before removing
    // dot segments, so "%2E%2E" collapses exactly as ".." does. Verified below.
    expect(() => segment(value)).toThrow(RangeError)
    expect(() => getCollectionStatsPath(value)).toThrow(RangeError)
  })

  it("is right that encoding a bare dot segment would not have worked", () => {
    const base = "https://api.opensea.io"
    for (const encoded of ["%2E%2E", "%2e%2e", ".%2e"]) {
      expect(
        new URL(`/api/v2/collections/${encoded}/stats`, base).pathname,
      ).toBe("/api/v2/stats")
    }
  })

  it("still encodes values that merely contain dots", () => {
    expect(segment("...")).toBe("...")
    expect(segment("%2e%2e")).toBe("%252e%252e")
    expect(
      new URL(
        `/api/v2/collections/${segment("%2e%2e")}/stats`,
        "https://api.opensea.io",
      ).pathname,
    ).toBe("/api/v2/collections/%252e%252e/stats")
  })

  it("neutralizes a traversal attempt instead of re-targeting the request", () => {
    const path = getCollectionStatsPath("../../../api/v2/collections/other")

    expect(path).not.toContain("/../")
    expect(new URL(path, "https://api.opensea.io").pathname).toBe(
      "/api/v2/collections/..%2F..%2F..%2Fapi%2Fv2%2Fcollections%2Fother/stats",
    )
  })
})

describe("path builders", () => {
  // A sweep rather than a case list: a builder added later without segment() fails here, which is
  // the only thing that keeps 100 interpolation sites encoded as the file grows.
  const builders = Object.entries(apiPaths).filter(
    (entry): entry is [string, (...args: unknown[]) => string] =>
      typeof entry[1] === "function" && entry[0] !== "segment",
  )

  it("covers every exported builder", () => {
    expect(builders.length).toBeGreaterThan(50)
  })

  it.each(
    builders,
  )("%s encodes each caller-supplied value", (_name, builder) => {
    const arity = builder.length
    if (arity === 0) {
      return
    }
    const probe = "a/b"
    const path = builder(...Array.from({ length: arity }, () => probe))
    const withoutPrefix = path.slice(API_V2_PREFIX.length)

    expect(path.startsWith(API_V2_PREFIX)).toBe(true)
    expect(withoutPrefix).toContain("a%2Fb")
    expect(withoutPrefix).not.toContain("a/b")
  })
})
