/**
 * MomAIO v0.1 — Contract utilities
 * Provides ABI, chain config, and helper functions for the AIO Oracle contract.
 */

import {
  createPublicClient,
  http,
  defineChain,
  type Hex,
  keccak256,
  toHex,
  pad,
} from "viem";

// ─── Chain ──────────────────────────────────────

export const giwaSepolia = defineChain({
  id: Number(process.env.NEXT_PUBLIC_GIWA_CHAIN_ID || "91342"),
  name: "Giwa Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_GIWA_RPC_URL || "https://sepolia-rpc.giwa.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Giwa Explorer",
      url: process.env.NEXT_PUBLIC_GIWA_EXPLORER_URL || "https://sepolia-explorer.giwa.io",
    },
  },
});

// ─── Contract Address ───────────────────────────

export const AIO_ORACLE_ADDRESS = (
  process.env.NEXT_PUBLIC_AIO_ORACLE_ADDRESS || "0x7482f2b8d5c85de8037145a6b0282be66163ae8a"
) as `0x${string}`;

export const MOCK_USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xbe39d68b83b32c35a9800ab15b785e848e706528"
) as `0x${string}`;

// ─── ABI (minimal — read functions only for frontend) ────

export const MOM_AIO_ABI = [
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "assertions",
    outputs: [
      { name: "assertionHash", type: "bytes32" },
      { name: "ruleHash", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "timestamp", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "verifications",
    outputs: [
      { name: "llmBundleHash", type: "bytes32" },
      { name: "verdict", type: "bytes32" },
      { name: "confidence", type: "uint16" },
      { name: "timestamp", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "resolutions",
    outputs: [
      { name: "resolutionHash", type: "bytes32" },
      { name: "finalOutcome", type: "bytes32" },
      { name: "timestamp", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "isAssertionSealed",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "isVerificationSealed",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "isResolutionSealed",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssertions",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalVerifications",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalResolutions",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "VERSION",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Full ABI including write functions (for server-side seal operations)
export const MOM_AIO_ABI_FULL = [
  ...MOM_AIO_ABI,
  {
    inputs: [
      { name: "assertionId", type: "bytes32" },
      { name: "assertionHash", type: "bytes32" },
      { name: "ruleHash", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    name: "sealAssertion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "assertionId", type: "bytes32" },
      { name: "llmBundleHash", type: "bytes32" },
      { name: "verdict", type: "bytes32" },
      { name: "confidence", type: "uint16" },
    ],
    name: "sealVerification",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "assertionId", type: "bytes32" },
      { name: "resolutionHash", type: "bytes32" },
      { name: "finalOutcome", type: "bytes32" },
    ],
    name: "sealResolution",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── Public Client ──────────────────────────────

export function getAioPublicClient() {
  return createPublicClient({
    chain: giwaSepolia,
    transport: http(),
  });
}

// ─── Helpers ────────────────────────────────────

/** Convert a UUID string to bytes32 for the contract */
export function uuidToBytes32(uuid: string): Hex {
  const hex = uuid.replace(/-/g, "");
  return pad(`0x${hex}` as Hex, { size: 32 });
}

/** Hash a string to bytes32 using keccak256 */
export function hashString(s: string): Hex {
  return keccak256(toHex(s));
}

/** Read on-chain seal status for an assertion */
export async function getOnChainSealStatus(assertionId: string) {
  const client = getAioPublicClient();
  const id = uuidToBytes32(assertionId);

  const [assertionSealed, verificationSealed, resolutionSealed] = await Promise.all([
    client.readContract({
      address: AIO_ORACLE_ADDRESS,
      abi: MOM_AIO_ABI,
      functionName: "isAssertionSealed",
      args: [id],
    }),
    client.readContract({
      address: AIO_ORACLE_ADDRESS,
      abi: MOM_AIO_ABI,
      functionName: "isVerificationSealed",
      args: [id],
    }),
    client.readContract({
      address: AIO_ORACLE_ADDRESS,
      abi: MOM_AIO_ABI,
      functionName: "isResolutionSealed",
      args: [id],
    }),
  ]);

  return {
    assertionSealed: assertionSealed as boolean,
    verificationSealed: verificationSealed as boolean,
    resolutionSealed: resolutionSealed as boolean,
  };
}

/** Get explorer URL for contract */
export function getContractExplorerUrl() {
  return `${giwaSepolia.blockExplorers.default.url}/address/${AIO_ORACLE_ADDRESS}`;
}

/** Get explorer URL for a transaction */
export function getTxExplorerUrl(txHash: string) {
  return `${giwaSepolia.blockExplorers.default.url}/tx/${txHash}`;
}
