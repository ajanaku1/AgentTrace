#!/usr/bin/env node
// ── AgentTrace CLI ──
// Usage: agent-trace scan <address>
//        agent-trace scan <address> --json

import { initClient } from './onchainos.js';
import { scanWallet } from './scanner.js';
import type { ScanResult, CategoryScore, RiskLevel } from './types.js';

// Load .env if present
async function loadEnv() {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const envPath = path.resolve(process.cwd(), '.env');
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No .env file, that's fine
  }
}

// ── Pretty Printing ──

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function colorForLevel(level: RiskLevel): string {
  switch (level) {
    case 'LOW': return COLORS.green;
    case 'MEDIUM': return COLORS.yellow;
    case 'HIGH': return COLORS.red;
    case 'CRITICAL': return `${COLORS.bgRed}${COLORS.white}`;
  }
}

function progressBar(score: number, width: number = 20): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const level = score < 25 ? COLORS.green : score < 50 ? COLORS.yellow : COLORS.red;
  return `${level}${'█'.repeat(filled)}${COLORS.dim}${'░'.repeat(empty)}${COLORS.reset}`;
}

function printResult(result: ScanResult) {
  const c = COLORS;
  const levelColor = colorForLevel(result.riskLevel);

  console.log();
  console.log(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║        AgentTrace — Wallet Exposure Scanner      ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════╝${c.reset}`);
  console.log();
  console.log(`  ${c.dim}Address:${c.reset}  ${result.address}`);
  console.log(`  ${c.dim}Chain:${c.reset}    X Layer (ID: ${result.chainId})`);
  console.log(`  ${c.dim}Scanned:${c.reset}  ${result.timestamp}`);
  console.log();

  // Overall score
  console.log(`  ${c.bold}Overall Risk Score${c.reset}`);
  console.log(`  ${progressBar(result.overallScore, 30)}  ${levelColor}${c.bold}${result.overallScore}/100 ${result.riskLevel}${c.reset}`);
  console.log();

  // Summary
  console.log(`  ${c.dim}${result.summary}${c.reset}`);
  console.log();

  // Flags
  if (result.flags.length > 0) {
    console.log(`  ${c.bold}${c.red}Flags${c.reset}`);
    for (const flag of result.flags) {
      const icon = flag.severity === 'danger' ? '🚨' : '⚠️';
      console.log(`  ${icon}  ${flag.detail}`);
    }
    console.log();
  }

  // Category scores
  console.log(`  ${c.bold}Category Breakdown${c.reset}`);
  console.log(`  ${'─'.repeat(50)}`);
  for (const cat of result.categories) {
    printCategory(cat);
  }

  // Transaction summary
  const ts = result.transactionSummary;
  console.log();
  console.log(`  ${c.bold}Transaction Summary${c.reset}`);
  console.log(`  ${c.dim}Total:${c.reset} ${ts.totalTxCount}  ${c.dim}Success:${c.reset} ${ts.successCount}  ${c.dim}Failed:${c.reset} ${ts.failCount}`);
  console.log(`  ${c.dim}Counterparties:${c.reset} ${ts.uniqueCounterparties}  ${c.dim}Wallet Age:${c.reset} ${ts.walletAgeDays ?? 'unknown'} days`);
  if (ts.blacklistHits > 0) {
    console.log(`  ${c.red}Blacklist hits: ${ts.blacklistHits}${c.reset}`);
  }

  // Token balances
  if (result.tokenBalances.length > 0) {
    console.log();
    console.log(`  ${c.bold}Token Holdings${c.reset}`);
    const totalValue = result.tokenBalances.reduce((s, t) => s + t.valueUsd, 0);
    console.log(`  ${c.dim}Total value:${c.reset} $${totalValue.toFixed(2)}`);
    for (const token of result.tokenBalances.slice(0, 10)) {
      const risk = token.isRiskToken ? ` ${c.red}[RISKY]${c.reset}` : '';
      console.log(`  ${c.dim}•${c.reset} ${token.symbol}: ${token.balance} ($${token.valueUsd.toFixed(2)})${risk}`);
    }
    if (result.tokenBalances.length > 10) {
      console.log(`  ${c.dim}... and ${result.tokenBalances.length - 10} more tokens${c.reset}`);
    }
  }

  // Uniswap
  if (result.uniswapExposure?.hasPositions) {
    console.log();
    console.log(`  ${c.bold}Uniswap Exposure${c.reset}`);
    console.log(`  ${c.dim}Pools:${c.reset} ${result.uniswapExposure.poolCount}  ${c.dim}Estimated Value:${c.reset} $${result.uniswapExposure.totalValueUsd.toFixed(2)}`);
  }

  console.log();
  console.log(`  ${c.dim}Powered by OnchainOS × Uniswap AI Skills${c.reset}`);
  console.log();
}

function printCategory(cat: CategoryScore) {
  const c = COLORS;
  const levelColor = colorForLevel(cat.level);
  console.log(`  ${progressBar(cat.score, 15)} ${levelColor}${cat.score.toString().padStart(3)}${c.reset} ${c.bold}${cat.name}${c.reset} ${c.dim}(${(cat.weight * 100).toFixed(0)}%)${c.reset}`);
  for (const signal of cat.signals) {
    const icon = signal.severity === 'danger' ? '🔴' : signal.severity === 'warning' ? '🟡' : '🔵';
    console.log(`              ${icon} ${c.dim}${signal.detail}${c.reset}`);
  }
}

// ── Main ──

async function main() {
  await loadEnv();

  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
AgentTrace — Wallet Exposure Scanner for X Layer

Usage:
  agent-trace scan <address>          Scan a wallet address
  agent-trace scan <address> --json   Output raw JSON
  agent-trace --help                  Show this help

Environment:
  OKX_API_KEY        OnchainOS API key
  OKX_SECRET_KEY     OnchainOS secret key
  OKX_PASSPHRASE     OnchainOS passphrase

Examples:
  agent-trace scan 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
  agent-trace scan 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 --json
`);
    process.exit(0);
  }

  if (command === 'scan') {
    const address = args[1];
    const jsonOutput = args.includes('--json');

    if (!address) {
      console.error('Error: Provide a wallet address to scan.');
      console.error('Usage: agent-trace scan <address>');
      process.exit(1);
    }

    try {
      console.log(`\nScanning ${address} on X Layer...`);
      const result = await scanWallet(address);

      if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printResult(result);
      }
    } catch (err) {
      console.error(`\nScan failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "agent-trace --help" for usage.');
    process.exit(1);
  }
}

main();
