import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org";

export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.ritualfoundation.org" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [ritualChain],
  connectors: [injected()],
  transports: { [ritualChain.id]: http(RPC_URL) },
  ssr: true,
});
