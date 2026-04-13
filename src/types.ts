// ── Core Types for AgentTrace Wallet Exposure Scanner ──

export interface ScanResult {
  address: string;
  chain: 'xlayer';
  chainId: 196;
  timestamp: string;
  overallScore: number;
  riskLevel: RiskLevel;
  categories: CategoryScore[];
  summary: string;
  tokenBalances: TokenBalance[];
  transactionSummary: TransactionSummary;
  counterparties: CounterpartyAnalysis;
  uniswapExposure: UniswapExposure | null;
  flags: RiskFlag[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CategoryScore {
  name: string;
  score: number; // 0-100, higher = more exposed/risky
  weight: number;
  level: RiskLevel;
  signals: Signal[];
  description: string;
}

export interface Signal {
  label: string;
  severity: 'info' | 'warning' | 'danger';
  detail: string;
}

export interface TokenBalance {
  symbol: string;
  contractAddress: string;
  balance: string;
  rawBalance: string;
  priceUsd: number;
  valueUsd: number;
  isRiskToken: boolean;
}

export interface TransactionData {
  txHash: string;
  txTime: number; // unix ms
  from: string;
  to: string;
  amount: string;
  symbol: string;
  tokenContract: string;
  txStatus: 'success' | 'fail' | 'pending';
  methodId: string;
  txFee: string;
  hitBlacklist: boolean;
}

export interface TransactionSummary {
  totalTxCount: number;
  successCount: number;
  failCount: number;
  uniqueCounterparties: number;
  firstTxTime: number | null;
  lastTxTime: number | null;
  walletAgeDays: number | null;
  blacklistHits: number;
}

export interface CounterpartyAnalysis {
  total: number;
  topCounterparties: CounterpartyInfo[];
  contractInteractions: number;
  walletInteractions: number;
  concentrationRisk: number; // 0-1, how concentrated interactions are
}

export interface CounterpartyInfo {
  address: string;
  txCount: number;
  type: 'contract' | 'wallet' | 'unknown';
  label?: string;
}

export interface UniswapExposure {
  hasPositions: boolean;
  poolCount: number;
  totalValueUsd: number;
  pools: PoolInfo[];
  riskFactors: Signal[];
}

export interface PoolInfo {
  poolAddress: string;
  token0: string;
  token1: string;
  valueUsd: number;
  share: number;
}

export interface RiskFlag {
  type: 'blacklist_interaction' | 'high_concentration' | 'new_wallet' | 'dust_attack' | 'wash_trading' | 'single_counterparty' | 'high_fail_rate' | 'risky_tokens';
  severity: 'warning' | 'danger';
  detail: string;
}

export interface TokenHolderInfo {
  holderAddress: string;
  holdPercent: number;
  holdAmount: string;
  avgBuyPrice: number;
  avgSellPrice: number;
  totalPnlUsd: number;
  fundingSource: string;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  contractAddress: string;
  chainId: string;
  logoUrl: string;
  decimals: number;
  isCommunityRecognized: boolean;
}

// ── OnchainOS API Response Types ──

export interface OKXApiResponse<T> {
  code: string;
  msg: string;
  data: T[];
}

export interface OKXBalanceData {
  tokenContractAddress: string;
  symbol: string;
  balance: string;
  rawBalance: string;
  tokenPrice: string;
  isRiskToken: boolean;
  address: string;
  chainIndex: string;
}

export interface OKXTransactionData {
  chainIndex: string;
  txHash: string;
  txTime: string;
  txStatus: string;
  from: { address: string; amount: string }[];
  to: { address: string; amount: string }[];
  tokenContractAddress: string;
  symbol: string;
  amount: string;
  txFee: string;
  hitBlacklist: boolean;
  methodId: string;
  itype: string;
  cursor: string;
}

export interface OKXTokenInfo {
  chainIndex: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl: string;
  decimal: string;
  tagList: { communityRecognized: boolean }[];
}

export interface OKXTokenHolder {
  holderWalletAddress: string;
  holdPercent: string;
  holdAmount: string;
  avgBuyPrice: string;
  avgSellPrice: string;
  totalPnlUsd: string;
  fundingSource: string;
  cursor: string;
}
