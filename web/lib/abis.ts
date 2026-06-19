// Minimal ABIs — only what the terminal reads/writes.

export const aegisAbi = [
  { type: "function", name: "agentCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "agentAt", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "score", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isRegistered", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "reputationOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "registered", type: "bool" },
          { name: "role", type: "uint8" },
          { name: "registeredAt", type: "uint64" },
          { name: "fills", type: "uint128" },
          { name: "volume", type: "uint128" },
          { name: "premiumsEarned", type: "uint128" },
          { name: "payoutsMade", type: "uint128" },
          { name: "settlements", type: "uint64" },
          { name: "defaults", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export const poolAbi = [
  { type: "function", name: "nextBidId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "clearingPrice", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "computeCommitment", stateMutability: "pure", inputs: [{ type: "uint256" }, { type: "bytes32" }], outputs: [{ type: "bytes32" }] },
  {
    type: "function",
    name: "submitBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "commitment", type: "bytes32" },
      { name: "encryptedBlob", type: "bytes" },
      { name: "quantity", type: "uint128" },
      { name: "expiryBlock", type: "uint64" },
    ],
    outputs: [{ type: "uint256" }],
  },
