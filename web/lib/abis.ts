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
  { type: "function", name: "cancelBid", stateMutability: "nonpayable", inputs: [{ name: "bidId", type: "uint256" }], outputs: [] },
  { type: "function", name: "revealAndFill", stateMutability: "nonpayable", inputs: [{ name: "bidId", type: "uint256" }, { name: "maxPrice", type: "uint256" }, { name: "salt", type: "bytes32" }], outputs: [] },
  {
    type: "function",
    name: "getBid",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "bidder", type: "address" },
          { name: "assetId", type: "bytes32" },
          { name: "commitment", type: "bytes32" },
          { name: "quantity", type: "uint128" },
          { name: "expiryBlock", type: "uint64" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  { type: "event", name: "BidSubmitted", inputs: [
    { name: "bidId", type: "uint256", indexed: true },
    { name: "bidder", type: "address", indexed: true },
    { name: "assetId", type: "bytes32", indexed: true },
    { name: "quantity", type: "uint128", indexed: false },
    { name: "expiryBlock", type: "uint64", indexed: false },
  ] },
  { type: "event", name: "BidCancelled", inputs: [
    { name: "bidId", type: "uint256", indexed: true },
    { name: "bidder", type: "address", indexed: true },
  ] },
  { type: "event", name: "BidFilled", inputs: [
    { name: "bidId", type: "uint256", indexed: true },
    { name: "bidder", type: "address", indexed: true },
    { name: "assetId", type: "bytes32", indexed: true },
    { name: "maxPrice", type: "uint256", indexed: false },
    { name: "clearingPrice", type: "uint256", indexed: false },
  ] },
] as const;

export const sentinelAbi = [
  { type: "function", name: "assetId", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "triggerBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "payoutMultiplierBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "windowHigh", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentDrawdownBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "triggered", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "settled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "poolBalance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalCoverage", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "policyCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastReport", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "buyPolicy", stateMutability: "payable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "holder", type: "address" },
          { name: "premium", type: "uint128" },
          { name: "payout", type: "uint128" },
          { name: "boughtAt", type: "uint64" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  { type: "event", name: "PolicyBought", inputs: [
    { name: "policyId", type: "uint256", indexed: true },
    { name: "holder", type: "address", indexed: true },
    { name: "premium", type: "uint128", indexed: false },
    { name: "payout", type: "uint128", indexed: false },
  ] },
  { type: "event", name: "PriceRecorded", inputs: [
    { name: "price", type: "uint256", indexed: false },
    { name: "windowHigh", type: "uint256", indexed: false },
    { name: "drawdownBps", type: "uint256", indexed: false },
  ] },
  { type: "event", name: "Triggered", inputs: [
    { name: "windowHigh", type: "uint256", indexed: false },
    { name: "price", type: "uint256", indexed: false },
    { name: "drawdownBps", type: "uint256", indexed: false },
  ] },
  { type: "event", name: "PolicySettled", inputs: [
    { name: "policyId", type: "uint256", indexed: true },
    { name: "holder", type: "address", indexed: true },
    { name: "payout", type: "uint128", indexed: false },
  ] },
] as const;
