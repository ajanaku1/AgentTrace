// ── AgentTrace Public API ──
// Importable module for other agents and skills

export { scanWallet } from './scanner.js';
export { initClient } from './onchainos.js';
export { getRiskLevel, calculateOverallScore } from './scoring.js';
export { analyzeUniswapExposure } from './uniswap.js';
export type {
  ScanResult,
  RiskLevel,
  CategoryScore,
  Signal,
  TokenBalance,
  TransactionData,
  TransactionSummary,
  CounterpartyAnalysis,
  UniswapExposure,
  RiskFlag,
} from './types.js';
