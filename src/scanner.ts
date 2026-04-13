// ── AgentTrace Core Scanner ──
// Orchestrates OnchainOS data fetching, Uniswap analysis, and risk scoring

import {
  getTokenBalances,
  getTransactionHistory,
} from './onchainos.js';
import {
  scoreWalletActivity,
  scoreAddressLinkability,
  scoreFinancialFootprint,
  scoreBehavioralProfile,
  scoreCounterpartyRisk,
  scoreDeFiExposure,
  calculateOverallScore,
  getRiskLevel,
  generateFlags,
  generateSummary,
} from './scoring.js';
import { analyzeUniswapExposure } from './uniswap.js';
import type {
  ScanResult,
  TransactionSummary,
  CounterpartyAnalysis,
  CounterpartyInfo,
  TransactionData,
} from './types.js';

const TX_FETCH_LIMIT = 100;

export async function scanWallet(address: string): Promise<ScanResult> {
  // Validate address format (basic EVM check)
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }

  // Fetch data in parallel from OnchainOS
  const [tokenBalances, transactions] = await Promise.all([
    getTokenBalances(address),
    getTransactionHistory(address, TX_FETCH_LIMIT),
  ]);

  // Build transaction summary
  const summary = buildTransactionSummary(address, transactions);

  // Analyze counterparties
  const counterparties = analyzeCounterparties(address, transactions);

  // Analyze Uniswap exposure
  const uniswapExposure = analyzeUniswapExposure(transactions);

  // Run all 6 scoring categories
  const categories = [
    scoreWalletActivity(summary),
    scoreAddressLinkability(counterparties, summary),
    scoreFinancialFootprint(tokenBalances, summary),
    scoreBehavioralProfile(transactions),
    scoreCounterpartyRisk(counterparties),
    scoreDeFiExposure(uniswapExposure),
  ];

  const overallScore = calculateOverallScore(categories);
  const riskLevel = getRiskLevel(overallScore);
  const flags = generateFlags(summary, counterparties, tokenBalances);
  const summaryText = generateSummary(overallScore, riskLevel, flags);

  return {
    address,
    chain: 'xlayer',
    chainId: 196,
    timestamp: new Date().toISOString(),
    overallScore,
    riskLevel,
    categories,
    summary: summaryText,
    tokenBalances,
    transactionSummary: summary,
    counterparties,
    uniswapExposure,
    flags,
  };
}

function buildTransactionSummary(address: string, transactions: TransactionData[]): TransactionSummary {
  const addr = address.toLowerCase();
  const counterpartySet = new Set<string>();

  let successCount = 0;
  let failCount = 0;
  let blacklistHits = 0;
  let firstTxTime: number | null = null;
  let lastTxTime: number | null = null;

  for (const tx of transactions) {
    if (tx.txStatus === 'success') successCount++;
    if (tx.txStatus === 'fail') failCount++;
    if (tx.hitBlacklist) blacklistHits++;

    // Track counterparties
    const other = tx.from.toLowerCase() === addr ? tx.to : tx.from;
    if (other) counterpartySet.add(other.toLowerCase());

    // Track time range
    if (tx.txTime) {
      if (firstTxTime === null || tx.txTime < firstTxTime) firstTxTime = tx.txTime;
      if (lastTxTime === null || tx.txTime > lastTxTime) lastTxTime = tx.txTime;
    }
  }

  const walletAgeDays = firstTxTime
    ? Math.floor((Date.now() - firstTxTime) / (1000 * 60 * 60 * 24))
    : null;

  return {
    totalTxCount: transactions.length,
    successCount,
    failCount,
    uniqueCounterparties: counterpartySet.size,
    firstTxTime,
    lastTxTime,
    walletAgeDays,
    blacklistHits,
  };
}

function analyzeCounterparties(address: string, transactions: TransactionData[]): CounterpartyAnalysis {
  const addr = address.toLowerCase();
  const counterpartyCounts = new Map<string, { count: number; isContract: boolean }>();

  for (const tx of transactions) {
    const other = tx.from.toLowerCase() === addr ? tx.to : tx.from;
    if (!other) continue;

    const key = other.toLowerCase();
    const existing = counterpartyCounts.get(key) || { count: 0, isContract: false };
    existing.count++;
    // Heuristic: if we've seen a methodId, the target is likely a contract
    if (tx.methodId && tx.methodId !== '0x') {
      existing.isContract = true;
    }
    counterpartyCounts.set(key, existing);
  }

  // Sort by interaction count
  const sorted = Array.from(counterpartyCounts.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const topCounterparties: CounterpartyInfo[] = sorted.slice(0, 10).map(([addr, data]) => ({
    address: addr,
    txCount: data.count,
    type: data.isContract ? 'contract' : 'wallet',
  }));

  // Concentration risk: what % of total txs are with top 3 counterparties
  const top3Count = sorted.slice(0, 3).reduce((sum, [, data]) => sum + data.count, 0);
  const concentrationRisk = transactions.length > 0 ? top3Count / transactions.length : 0;

  const contractInteractions = sorted.filter(([, d]) => d.isContract).length;
  const walletInteractions = sorted.filter(([, d]) => !d.isContract).length;

  return {
    total: counterpartyCounts.size,
    topCounterparties,
    contractInteractions,
    walletInteractions,
    concentrationRisk,
  };
}
