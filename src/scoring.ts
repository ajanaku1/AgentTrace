// ── Risk Scoring Engine for AgentTrace ──
// Adapted from Trace's 6-category weighted scoring system for X Layer

import type {
  CategoryScore,
  Signal,
  RiskLevel,
  RiskFlag,
  TokenBalance,
  TransactionData,
  TransactionSummary,
  CounterpartyAnalysis,
  UniswapExposure,
} from './types.js';

// ── Helpers ──

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getRiskLevel(score: number): RiskLevel {
  if (score < 25) return 'LOW';
  if (score < 50) return 'MEDIUM';
  if (score < 75) return 'HIGH';
  return 'CRITICAL';
}

function makeSignal(label: string, severity: Signal['severity'], detail: string): Signal {
  return { label, severity, detail };
}

// ── Category 1: Wallet Activity (weight 0.18) ──

export function scoreWalletActivity(summary: TransactionSummary): CategoryScore {
  const signals: Signal[] = [];
  let score = 0;

  // Wallet age
  if (summary.walletAgeDays === null || summary.walletAgeDays < 7) {
    score += 30;
    signals.push(makeSignal('New wallet', 'warning', `Wallet is ${summary.walletAgeDays ?? 0} days old — new wallets are harder to assess`));
  } else if (summary.walletAgeDays < 30) {
    score += 15;
    signals.push(makeSignal('Young wallet', 'info', `Wallet is ${summary.walletAgeDays} days old`));
  }

  // Transaction volume
  if (summary.totalTxCount < 5) {
    score += 20;
    signals.push(makeSignal('Low activity', 'info', `Only ${summary.totalTxCount} transactions`));
  } else if (summary.totalTxCount > 500) {
    score += 10;
    signals.push(makeSignal('High activity', 'info', `${summary.totalTxCount} transactions — high on-chain footprint`));
  }

  // Fail rate
  const failRate = summary.totalTxCount > 0 ? summary.failCount / summary.totalTxCount : 0;
  if (failRate > 0.3) {
    score += 25;
    signals.push(makeSignal('High fail rate', 'danger', `${(failRate * 100).toFixed(0)}% of transactions failed — possible bot or exploit probing`));
  } else if (failRate > 0.1) {
    score += 10;
    signals.push(makeSignal('Elevated fail rate', 'warning', `${(failRate * 100).toFixed(0)}% transaction failure rate`));
  }

  // Blacklist hits
  if (summary.blacklistHits > 0) {
    score += 25;
    signals.push(makeSignal('Blacklist interaction', 'danger', `${summary.blacklistHits} transactions flagged by blacklist`));
  }

  return {
    name: 'Wallet Activity',
    score: clamp(score, 0, 100),
    weight: 0.18,
    level: getRiskLevel(clamp(score, 0, 100)),
    signals,
    description: 'Transaction history patterns, wallet age, and activity volume',
  };
}

// ── Category 2: Address Linkability (weight 0.22) ──

export function scoreAddressLinkability(
  counterparties: CounterpartyAnalysis,
  summary: TransactionSummary
): CategoryScore {
  const signals: Signal[] = [];
  let score = 0;

  // Unique counterparties
  if (summary.uniqueCounterparties < 3) {
    score += 15;
    signals.push(makeSignal('Few counterparties', 'info', `Only ${summary.uniqueCounterparties} unique addresses interacted`));
  } else if (summary.uniqueCounterparties > 50) {
    score += 20;
    signals.push(makeSignal('Many counterparties', 'warning', `${summary.uniqueCounterparties} unique addresses — large on-chain graph`));
  }

  // Concentration risk
  if (counterparties.concentrationRisk > 0.7) {
    score += 30;
    signals.push(makeSignal('High concentration', 'danger', `${(counterparties.concentrationRisk * 100).toFixed(0)}% of activity with top counterparties`));
  } else if (counterparties.concentrationRisk > 0.4) {
    score += 15;
    signals.push(makeSignal('Moderate concentration', 'warning', 'Activity moderately concentrated among few addresses'));
  }

  // Contract vs wallet ratio
  const contractRatio = counterparties.total > 0 ? counterparties.contractInteractions / counterparties.total : 0;
  if (contractRatio > 0.8) {
    score += 10;
    signals.push(makeSignal('Contract-heavy', 'info', 'Most interactions are with smart contracts'));
  }

  return {
    name: 'Address Linkability',
    score: clamp(score, 0, 100),
    weight: 0.22,
    level: getRiskLevel(clamp(score, 0, 100)),
    signals,
    description: 'How easily this wallet can be linked to other addresses through on-chain patterns',
  };
}

// ── Category 3: Financial Footprint (weight 0.20) ──

export function scoreFinancialFootprint(
  tokenBalances: TokenBalance[],
  summary: TransactionSummary
): CategoryScore {
  const signals: Signal[] = [];
  let score = 0;

  const totalValue = tokenBalances.reduce((sum, t) => sum + t.valueUsd, 0);

  // Portfolio value
  if (totalValue > 100000) {
    score += 25;
    signals.push(makeSignal('High value wallet', 'warning', `Portfolio value >$100k — high-value target`));
  } else if (totalValue > 10000) {
    score += 15;
    signals.push(makeSignal('Moderate value', 'info', `Portfolio value >$10k`));
  } else if (totalValue < 10) {
    score += 10;
    signals.push(makeSignal('Dust wallet', 'info', 'Very low balance — possible sybil or abandoned'));
  }

  // Token diversity
  const tokenCount = tokenBalances.length;
  if (tokenCount > 20) {
    score += 15;
    signals.push(makeSignal('High token diversity', 'info', `${tokenCount} different tokens held`));
  } else if (tokenCount === 1) {
    score += 5;
    signals.push(makeSignal('Single token', 'info', 'Only one token type held'));
  }

  // Risk tokens
  const riskyTokens = tokenBalances.filter((t) => t.isRiskToken);
  if (riskyTokens.length > 0) {
    score += 20;
    signals.push(makeSignal('Risky tokens detected', 'danger', `${riskyTokens.length} tokens flagged as risky: ${riskyTokens.map((t) => t.symbol).join(', ')}`));
  }

  // Stablecoin ratio
  const stableSymbols = ['USDT', 'USDC', 'DAI', 'BUSD', 'FRAX'];
  const stableValue = tokenBalances
    .filter((t) => stableSymbols.includes(t.symbol.toUpperCase()))
    .reduce((sum, t) => sum + t.valueUsd, 0);
  const stableRatio = totalValue > 0 ? stableValue / totalValue : 0;
  if (stableRatio > 0.9) {
    signals.push(makeSignal('Stablecoin-heavy', 'info', `${(stableRatio * 100).toFixed(0)}% in stablecoins`));
  }

  return {
    name: 'Financial Footprint',
    score: clamp(score, 0, 100),
    weight: 0.20,
    level: getRiskLevel(clamp(score, 0, 100)),
    signals,
    description: 'Portfolio composition, token risk profile, and financial exposure',
  };
}

// ── Category 4: Behavioral Profiling (weight 0.17) ──

export function scoreBehavioralProfile(transactions: TransactionData[]): CategoryScore {
  const signals: Signal[] = [];
  let score = 0;

  if (transactions.length < 2) {
    return {
      name: 'Behavioral Profile',
      score: 10,
      weight: 0.17,
      level: 'LOW',
      signals: [makeSignal('Insufficient data', 'info', 'Not enough transactions to profile behavior')],
      description: 'Transaction timing patterns, activity bursts, and behavioral signatures',
    };
  }

  // Time-of-day analysis
  const hours = transactions.map((tx) => new Date(tx.txTime).getUTCHours());
  const hourCounts = new Array(24).fill(0);
  hours.forEach((h) => hourCounts[h]++);
  const maxHourCount = Math.max(...hourCounts);
  const peakHour = hourCounts.indexOf(maxHourCount);
  const peakConcentration = maxHourCount / transactions.length;

  if (peakConcentration > 0.5) {
    score += 20;
    signals.push(makeSignal('Time pattern detected', 'warning', `${(peakConcentration * 100).toFixed(0)}% of activity in hour ${peakHour}:00 UTC — timezone inference possible`));
  }

  // Transaction velocity / bursts
  const times = transactions.map((tx) => tx.txTime).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i] - times[i - 1]);
  }
  const avgGapMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const burstCount = gaps.filter((g) => g < 60_000).length; // < 1 min between txs
  const burstRatio = gaps.length > 0 ? burstCount / gaps.length : 0;

  if (burstRatio > 0.5) {
    score += 25;
    signals.push(makeSignal('Burst activity', 'warning', `${(burstRatio * 100).toFixed(0)}% of transactions in rapid succession — likely automated`));
  }

  // Method diversity (different contract methods called)
  const methods = new Set(transactions.filter((tx) => tx.methodId).map((tx) => tx.methodId));
  if (methods.size > 10) {
    score += 10;
    signals.push(makeSignal('Diverse contract usage', 'info', `${methods.size} unique contract methods called`));
  }

  return {
    name: 'Behavioral Profile',
    score: clamp(score, 0, 100),
    weight: 0.17,
    level: getRiskLevel(clamp(score, 0, 100)),
    signals,
    description: 'Transaction timing patterns, activity bursts, and behavioral signatures',
  };
}

// ── Category 5: Counterparty Risk (weight 0.13) ──

export function scoreCounterpartyRisk(counterparties: CounterpartyAnalysis): CategoryScore {
  const signals: Signal[] = [];
  let score = 0;

  // Single dominant counterparty
  if (counterparties.topCounterparties.length > 0) {
    const top = counterparties.topCounterparties[0];
    const topRatio = counterparties.total > 0 ? top.txCount / counterparties.total : 0;
    if (topRatio > 0.5) {
      score += 25;
      signals.push(makeSignal('Single counterparty dominance', 'warning',
        `${(topRatio * 100).toFixed(0)}% of interactions with ${top.address.slice(0, 10)}...`));
    }
  }

  // Known vs unknown counterparties
  const unknownCount = counterparties.topCounterparties.filter((c) => !c.label).length;
  const unknownRatio = counterparties.topCounterparties.length > 0
    ? unknownCount / counterparties.topCounterparties.length
    : 0;
  if (unknownRatio > 0.8) {
    score += 15;
    signals.push(makeSignal('Mostly unknown counterparties', 'warning', 'Most interacted addresses are unidentified'));
  }

  return {
    name: 'Counterparty Risk',
    score: clamp(score, 0, 100),
    weight: 0.13,
    level: getRiskLevel(clamp(score, 0, 100)),
    signals,
    description: 'Risk profile of addresses this wallet interacts with',
  };
}

// ── Category 6: DeFi Exposure (weight 0.10) ──

export function scoreDeFiExposure(uniswap: UniswapExposure | null): CategoryScore {
  const signals: Signal[] = [];
  let score = 0;

  if (!uniswap || !uniswap.hasPositions) {
    return {
      name: 'DeFi Exposure',
      score: 0,
      weight: 0.10,
      level: 'LOW',
      signals: [makeSignal('No DeFi positions', 'info', 'No Uniswap liquidity positions detected')],
      description: 'Exposure through DeFi protocol positions on Uniswap',
    };
  }

  if (uniswap.totalValueUsd > 50000) {
    score += 25;
    signals.push(makeSignal('Large DeFi positions', 'warning', `$${uniswap.totalValueUsd.toFixed(0)} in Uniswap pools`));
  } else if (uniswap.totalValueUsd > 5000) {
    score += 10;
    signals.push(makeSignal('Active DeFi user', 'info', `$${uniswap.totalValueUsd.toFixed(0)} in Uniswap pools`));
  }

  if (uniswap.poolCount > 5) {
    score += 10;
    signals.push(makeSignal('Multiple pools', 'info', `Active in ${uniswap.poolCount} Uniswap pools`));
  }

  // Pass through any risk factors from Uniswap analysis
  if (uniswap.riskFactors.length > 0) {
    score += uniswap.riskFactors.length * 10;
    signals.push(...uniswap.riskFactors);
  }

  return {
    name: 'DeFi Exposure',
    score: clamp(score, 0, 100),
    weight: 0.10,
    level: getRiskLevel(clamp(score, 0, 100)),
    signals,
    description: 'Exposure through DeFi protocol positions on Uniswap',
  };
}

// ── Aggregate Scoring ──

export function calculateOverallScore(categories: CategoryScore[]): number {
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
  return clamp(Math.round(weightedSum / totalWeight), 0, 100);
}

export function generateFlags(
  summary: TransactionSummary,
  counterparties: CounterpartyAnalysis,
  tokenBalances: TokenBalance[]
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (summary.blacklistHits > 0) {
    flags.push({
      type: 'blacklist_interaction',
      severity: 'danger',
      detail: `${summary.blacklistHits} transactions with blacklisted addresses`,
    });
  }

  if (summary.walletAgeDays !== null && summary.walletAgeDays < 7) {
    flags.push({
      type: 'new_wallet',
      severity: 'warning',
      detail: `Wallet is only ${summary.walletAgeDays} days old`,
    });
  }

  if (counterparties.concentrationRisk > 0.7) {
    flags.push({
      type: 'high_concentration',
      severity: 'warning',
      detail: 'Activity highly concentrated among few addresses',
    });
  }

  const failRate = summary.totalTxCount > 0 ? summary.failCount / summary.totalTxCount : 0;
  if (failRate > 0.3) {
    flags.push({
      type: 'high_fail_rate',
      severity: 'danger',
      detail: `${(failRate * 100).toFixed(0)}% transaction failure rate`,
    });
  }

  const riskyTokens = tokenBalances.filter((t) => t.isRiskToken);
  if (riskyTokens.length > 0) {
    flags.push({
      type: 'risky_tokens',
      severity: 'warning',
      detail: `Holds ${riskyTokens.length} flagged tokens`,
    });
  }

  return flags;
}

export function generateSummary(score: number, level: RiskLevel, flags: RiskFlag[]): string {
  const riskDesc = {
    LOW: 'Low risk — wallet shows normal on-chain behavior with minimal exposure signals.',
    MEDIUM: 'Moderate risk — some exposure signals detected that warrant monitoring.',
    HIGH: 'High risk — significant exposure signals detected across multiple categories.',
    CRITICAL: 'Critical risk — wallet shows strong indicators of suspicious or high-exposure activity.',
  };

  let summary = riskDesc[level];
  if (flags.length > 0) {
    summary += ` Key flags: ${flags.map((f) => f.detail).join('; ')}.`;
  }
  return summary;
}
