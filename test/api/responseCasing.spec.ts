import type {
  AccountResolveResponse,
  AccountResponse,
} from "@opensea/api-types"
import { describe, expect, expectTypeOf, test } from "vitest"
import {
  type Camelize,
  camelizeKeysDeep,
  type OpenSeaAccount,
  type ResolveAccountResponse,
} from "../../src"

/**
 * The SDK rewrites response keys from snake_case to camelCase, so a raw
 * `@opensea/api-types` type describes the wire and not the value an SDK method
 * hands back. These assignments pin how much of that the compiler catches:
 * each one fails the type check if its verdict flips, which is what keeps the
 * README's claim honest.
 *
 * `check-types` is where this earns its keep. Vitest compiles the tests with
 * esbuild, which strips types without checking them, and the function is never
 * called.
 */
function _casingPairings(
  account: OpenSeaAccount,
  resolved: ResolveAccountResponse,
) {
  // Caught. `AccountResponse` requires `is_verified`, `is_agent` and four more
  // snake_case keys, none of which survive camelization under those names.
  // @ts-expect-error a camelCase SDK value is not the snake_case wire shape
  const wrongAccount: AccountResponse = account

  // Not caught, and this is the case the documentation exists for.
  // `AccountResolveResponse` requires only `address`, which has no underscore
  // to rewrite. Every other key is optional, so nothing is reported missing
  // and the camelCase keys pass as extras. The reader then writes
  // `account.ens_name` and gets undefined.
  const silentlyWrongResolve: AccountResolveResponse = resolved

  // Both correct spellings.
  const rightViaCamelize: Camelize<AccountResolveResponse> = resolved
  const rightViaSdkAlias: ResolveAccountResponse = resolved

  return [
    wrongAccount,
    silentlyWrongResolve,
    rightViaCamelize,
    rightViaSdkAlias,
  ]
}

describe("response casing contract", () => {
  test("the SDK's response aliases are the camelized view, not the wire type", () => {
    expectTypeOf<OpenSeaAccount>().toEqualTypeOf<Camelize<AccountResponse>>()
    expectTypeOf<ResolveAccountResponse>().toEqualTypeOf<
      Camelize<AccountResolveResponse>
    >()
    expectTypeOf<ResolveAccountResponse>().not.toEqualTypeOf<AccountResolveResponse>()
  })

  test("Camelize and camelizeKeysDeep are exported from the package root", () => {
    // The type-only assertions above already fail to compile without
    // `Camelize`, but this names the export so a reader of the failure knows
    // what moved.
    expect(typeof camelizeKeysDeep).toBe("function")
  })

  test("a wire-typed field is absent at runtime once the response is camelized", () => {
    const wire: AccountResolveResponse = {
      address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      ens_name: "vitalik.eth",
    }

    const view = camelizeKeysDeep(wire)

    expect(view.ensName).toBe("vitalik.eth")
    expect(view).not.toHaveProperty("ens_name")
  })
})
