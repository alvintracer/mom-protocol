/**
 * Deploy MockUSDC to Giwa Sepolia testnet.
 *
 * Usage:
 *   npx tsx scripts/deploy-mock-usdc.ts
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_GIWA_RPC_URL=https://sepolia-rpc.giwa.io
 *   MASTER_WALLET_PRIVATE_KEY=<hex without 0x prefix>
 */

import { createWalletClient, createPublicClient, http, defineChain, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, appendFileSync, existsSync } from "fs";
import { resolve } from "path";

// ─── Load .env.local ───
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Config ───
const RPC_URL = process.env.NEXT_PUBLIC_GIWA_RPC_URL || "https://sepolia-rpc.giwa.io";
const PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("❌ MASTER_WALLET_PRIVATE_KEY not found in .env.local");
  process.exit(1);
}

// Giwa Sepolia chain definition
const giwaSepolia = defineChain({
  id: 91342,
  name: "Giwa Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// ─── ABI & Bytecode (compiled inline) ───
// Minimal ERC-20: constructor(uint256 initialSupply)
// Compiled with solc 0.8.20 — bytecode below is the compiled MockUSDC contract.
// We'll compile on-the-fly using solc if available, otherwise use pre-compiled.

// Pre-compiled bytecode for the MockUSDC contract
// To regenerate: solc --bin --abi contracts/MockUSDC.sol
const MOCK_USDC_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "initialSupply", type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
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
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  console.log("🚀 Deploying MockUSDC to Giwa Sepolia...\n");

  const account = privateKeyToAccount(`0x${PRIVATE_KEY}` as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);

  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: giwaSepolia,
    transport: http(RPC_URL),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${formatUnits(balance, 18)} ETH`);

  if (balance === 0n) {
    console.error("❌ No ETH for gas. Fund the wallet first.");
    process.exit(1);
  }

  // $100,000 USDC with 6 decimals = 100_000 * 10^6 = 100_000_000_000
  const INITIAL_SUPPLY = 100_000n * 10n ** 6n;
  console.log(`📦 Initial supply: ${formatUnits(INITIAL_SUPPLY, 6)} mUSDC ($100,000)`);

  // Compile the contract using solc-js
  let bytecode: `0x${string}`;

  const solcModule = await import("solc") as any;
  const solc = solcModule.default || solcModule;
  const source = readFileSync(resolve(process.cwd(), "contracts/MockUSDC.sol"), "utf-8");

  const input = JSON.stringify({
    language: "Solidity",
    sources: { "MockUSDC.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  });

  const output = JSON.parse(solc.compile(input));

  if (output.errors?.some((e: any) => e.severity === "error")) {
    console.error("❌ Compilation errors:");
    output.errors.forEach((e: any) => console.error(e.formattedMessage));
    process.exit(1);
  }

  const compiled = output.contracts["MockUSDC.sol"]["MockUSDC"];
  bytecode = `0x${compiled.evm.bytecode.object}` as `0x${string}`;
  console.log(`✅ Contract compiled (${bytecode.length / 2} bytes)`);

  // Deploy
  console.log("\n📤 Sending deployment transaction...");

  const hash = await walletClient.deployContract({
    abi: MOCK_USDC_ABI,
    bytecode,
    args: [INITIAL_SUPPLY],
  });

  console.log(`⏳ Tx hash: ${hash}`);
  console.log("   Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    console.error("❌ Deployment failed — no contract address in receipt");
    process.exit(1);
  }

  const contractAddress = receipt.contractAddress;
  console.log(`\n✅ MockUSDC deployed!`);
  console.log(`📍 Contract: ${contractAddress}`);
  console.log(`🔗 Block: ${receipt.blockNumber}`);

  // Verify deployment
  const name = await publicClient.readContract({
    address: contractAddress,
    abi: MOCK_USDC_ABI,
    functionName: "name",
  });
  const supply = await publicClient.readContract({
    address: contractAddress,
    abi: MOCK_USDC_ABI,
    functionName: "totalSupply",
  });
  const ownerBalance = await publicClient.readContract({
    address: contractAddress,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log(`\n📋 Verification:`);
  console.log(`   Name: ${name}`);
  console.log(`   Total Supply: ${formatUnits(supply as bigint, 6)} mUSDC`);
  console.log(`   Owner Balance: ${formatUnits(ownerBalance as bigint, 6)} mUSDC`);

  // Write to .env.local
  const envLine = `\nNEXT_PUBLIC_MOCK_USDC_ADDRESS=${contractAddress}\nNEXT_PUBLIC_GIWA_CHAIN_ID=91342\n`;
  appendFileSync(envPath, envLine);
  console.log(`\n📝 Added to .env.local:`);
  console.log(`   NEXT_PUBLIC_MOCK_USDC_ADDRESS=${contractAddress}`);
  console.log(`   NEXT_PUBLIC_GIWA_CHAIN_ID=91342`);
  console.log("\n🎉 Done!");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
