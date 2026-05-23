/**
 * MomAIO v0.1 — Deploy to Giwa Sepolia using viem
 *
 * Usage:
 *   npx tsx scripts/deploy-aio.ts
 *
 * Requires .env.local with:
 *   MASTER_WALLET_PRIVATE_KEY
 *   NEXT_PUBLIC_GIWA_RPC_URL
 *   NEXT_PUBLIC_GIWA_CHAIN_ID
 */

import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

// ─── Load .env.local ───────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return vars;
}

const env = loadEnv();

const PRIVATE_KEY = env.MASTER_WALLET_PRIVATE_KEY;
const RPC_URL = env.NEXT_PUBLIC_GIWA_RPC_URL || "https://sepolia-rpc.giwa.io";
const CHAIN_ID = Number(env.NEXT_PUBLIC_GIWA_CHAIN_ID || "91342");

if (!PRIVATE_KEY) {
  console.error("❌ MASTER_WALLET_PRIVATE_KEY not found in .env.local");
  process.exit(1);
}

// ─── Chain Definition ──────────────────────────

const giwaSepolia = defineChain({
  id: CHAIN_ID,
  name: "Giwa Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "Giwa Explorer",
      url: env.NEXT_PUBLIC_GIWA_EXPLORER_URL || "https://sepolia-explorer.giwa.io",
    },
  },
});

// ─── MomAIO Compiled Bytecode & ABI ────────────
// Compiled with solc 0.8.20 — bytecode generated from MomAIO.sol
// We'll compile inline using solc if available, otherwise use pre-compiled

async function compileSol(): Promise<{ abi: unknown[]; bytecode: `0x${string}` }> {
  // Try to use solcjs
  try {
    const solc = await import("solc");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "contracts/MomAIO.sol"),
      "utf-8",
    );

    const input = JSON.stringify({
      language: "Solidity",
      sources: { "MomAIO.sol": { content: source } },
      settings: {
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        optimizer: { enabled: true, runs: 200 },
      },
    });

    const output = JSON.parse(solc.default.compile(input));

    if (output.errors?.some((e: { severity: string }) => e.severity === "error")) {
      console.error("Compilation errors:", output.errors);
      process.exit(1);
    }

    const contract = output.contracts["MomAIO.sol"]["MomAIO"];
    return {
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}`,
    };
  } catch {
    console.error("❌ solc not found. Install with: npm install -D solc");
    console.error("   Or run: npx solcjs --optimize --abi --bin contracts/MomAIO.sol");
    process.exit(1);
  }
}

// ─── Deploy ────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  MomAIO v0.1 — Deploy to Giwa Sepolia");
  console.log("═══════════════════════════════════════");
  console.log();

  // Compile
  console.log("⏳ Compiling MomAIO.sol...");
  const { abi, bytecode } = await compileSol();
  console.log("✅ Compiled successfully");

  // Save ABI
  const abiDir = path.resolve(process.cwd(), "contracts/abi");
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });
  fs.writeFileSync(
    path.join(abiDir, "MomAIO.json"),
    JSON.stringify(abi, null, 2),
  );
  console.log("✅ ABI saved to contracts/abi/MomAIO.json");

  // Setup wallet
  const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace(/^0x/, "")}`);
  console.log(`📍 Deployer: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: giwaSepolia,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(RPC_URL),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);

  if (balance === 0n) {
    console.error("❌ No ETH balance. Fund the deployer first.");
    process.exit(1);
  }

  // Deploy
  console.log();
  console.log("⏳ Deploying MomAIO...");

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [],
  });

  console.log(`📝 TX Hash: ${hash}`);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    console.error("❌ Deployment failed — no contract address in receipt");
    process.exit(1);
  }

  console.log();
  console.log("═══════════════════════════════════════");
  console.log("✅ MomAIO deployed successfully!");
  console.log(`📍 Contract: ${receipt.contractAddress}`);
  console.log(`🔗 Explorer: ${giwaSepolia.blockExplorers.default.url}/address/${receipt.contractAddress}`);
  console.log(`⛽ Gas Used: ${receipt.gasUsed}`);
  console.log("═══════════════════════════════════════");
  console.log();
  console.log("Add to .env.local:");
  console.log(`NEXT_PUBLIC_AIO_ORACLE_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error("❌ Deploy failed:", err);
  process.exit(1);
});
