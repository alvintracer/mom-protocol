/**
 * Mint additional mUSDC to reach 100M total supply.
 * 
 * Usage: npx tsx scripts/mint-additional-musdc.ts
 */

import { createWalletClient, createPublicClient, http, defineChain, formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1);
  }
}

const RPC_URL = process.env.NEXT_PUBLIC_GIWA_RPC_URL || "https://sepolia-rpc.giwa.io";
const PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
const CONTRACT = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

if (!PRIVATE_KEY || !CONTRACT) {
  console.error("❌ Missing MASTER_WALLET_PRIVATE_KEY or NEXT_PUBLIC_MOCK_USDC_ADDRESS");
  process.exit(1);
}

const giwaSepolia = defineChain({
  id: 91342,
  name: "Giwa Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  const account = privateKeyToAccount(`0x${PRIVATE_KEY}` as `0x${string}`);
  const contractAddress = CONTRACT as `0x${string}`;

  const publicClient = createPublicClient({ chain: giwaSepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: giwaSepolia, transport: http(RPC_URL) });

  // Check current supply
  const currentSupply = await publicClient.readContract({
    address: contractAddress, abi: MINT_ABI, functionName: "totalSupply",
  }) as bigint;

  console.log(`📊 Current supply: ${formatUnits(currentSupply, 6)} mUSDC`);

  // Target: 100,000,000 mUSDC (100M)
  const TARGET = parseUnits("100000000", 6);  // 100M with 6 decimals
  const mintAmount = TARGET - currentSupply;

  if (mintAmount <= 0n) {
    console.log("✅ Already at or above 100M. Nothing to mint.");
    process.exit(0);
  }

  console.log(`🔨 Minting: ${formatUnits(mintAmount, 6)} mUSDC`);
  console.log(`📍 To: ${account.address}`);

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: MINT_ABI,
    functionName: "mint",
    args: [account.address, mintAmount],
  });

  console.log(`⏳ Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  // Verify
  const newSupply = await publicClient.readContract({
    address: contractAddress, abi: MINT_ABI, functionName: "totalSupply",
  }) as bigint;
  const balance = await publicClient.readContract({
    address: contractAddress, abi: MINT_ABI, functionName: "balanceOf", args: [account.address],
  }) as bigint;

  console.log(`\n📋 Verification:`);
  console.log(`   Total Supply: ${formatUnits(newSupply, 6)} mUSDC`);
  console.log(`   Owner Balance: ${formatUnits(balance, 6)} mUSDC`);
  console.log(`\n🎉 Done!`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
