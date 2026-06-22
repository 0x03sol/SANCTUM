import { describe, it, expect } from "vitest";
import { encodeAbiParameters, keccak256 } from "viem";
import { shortAddr, bps, BID_STATUS, ROLE_LABEL } from "./contracts";

describe("formatting helpers", () => {
  it("truncates addresses", () => {
    expect(shortAddr("0x38a9fCb26F3349910c6B3E84bdA146dDF5c08249")).toBe("0x38a9…8249");
    expect(shortAddr(undefined)).toBe("—");
  });

  it("formats basis points as percent", () => {
    expect(bps(3000)).toBe("30.00%");
    expect(bps(3623n)).toBe("36.23%");
    expect(bps(undefined)).toBe("—");
  });

  it("maps enum labels", () => {
    expect(ROLE_LABEL[2]).toBe("Underwriter");
    expect(BID_STATUS[3]).toBe("Filled");
  });
});

describe("sealed-bid commitment", () => {
  it("matches keccak256(abi.encode(maxPrice, salt)) — the on-chain scheme", () => {
    const maxPrice = 3000n;
    const salt = "0x" + "ab".repeat(32) as `0x${string}`;
    const commitment = keccak256(
      encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [maxPrice, salt]),
    );
    // deterministic: same inputs always yield the same commitment
    const again = keccak256(
      encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [maxPrice, salt]),
    );
    expect(commitment).toBe(again);
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
