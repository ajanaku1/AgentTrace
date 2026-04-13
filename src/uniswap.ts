// ── Uniswap Pool Exposure Analysis for X Layer ──
// Checks wallet's Uniswap V3 liquidity positions and pool interactions

import type { TransactionData, UniswapExposure, Signal } from './types.js';

// Known Uniswap V3 contract addresses on X Layer
const UNISWAP_CONTRACTS: Record<string, string> = {
  '0x1F98431c8aD98523631AE4a59f267346ea31F984': 'UniswapV3Factory',
  '0xE592427A0AEce92De3Edee1F18E0157C05861564': 'SwapRouter',
  '0xC36442b4a4522E871399CD717aBDD847Ab11FE88': 'NonfungiblePositionManager',
  '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6': 'Quoter',
};

// Uniswap method signatures
const UNISWAP_METHODS: Record<string, string> = {
  '0x414bf389': 'exactInputSingle',
  '0xc04b8d59': 'exactInput',
  '0xdb3e2198': 'exactOutputSingle',
  '0xf28c0498': 'exactOutput',
  '0x88316456': 'mint',      // Add liquidity
  '0x219f5d17': 'increaseLiquidity',
  '0x0c49ccbe': 'decreaseLiquidity',
  '0xfc6f7865': 'collect',
  '0x49404b7c': 'burn',
};

export function analyzeUniswapExposure(transactions: TransactionData[]): UniswapExposure {
  const uniswapTxs = transactions.filter((tx) =>
    isUniswapInteraction(tx.to) || isUniswapInteraction(tx.from)
  );

  if (uniswapTxs.length === 0) {
    return {
      hasPositions: false,
      poolCount: 0,
      totalValueUsd: 0,
      pools: [],
      riskFactors: [],
    };
  }

  const riskFactors: Signal[] = [];
  const poolAddresses = new Set<string>();

  // Analyze Uniswap interactions
  let swapCount = 0;
  let liquidityCount = 0;

  for (const tx of uniswapTxs) {
    const method = UNISWAP_METHODS[tx.methodId] || '';

    if (['exactInputSingle', 'exactInput', 'exactOutputSingle', 'exactOutput'].includes(method)) {
      swapCount++;
    }

    if (['mint', 'increaseLiquidity'].includes(method)) {
      liquidityCount++;
      poolAddresses.add(tx.to);
    }

    // Flag failed Uniswap txs
    if (tx.txStatus === 'fail') {
      riskFactors.push({
        label: 'Failed Uniswap tx',
        severity: 'warning',
        detail: `Failed ${method || 'unknown'} transaction: ${tx.txHash.slice(0, 16)}...`,
      });
    }
  }

  // High swap frequency indicates active trading
  if (swapCount > 20) {
    riskFactors.push({
      label: 'High swap frequency',
      severity: 'info',
      detail: `${swapCount} Uniswap swaps — active trader with significant DEX footprint`,
    });
  }

  // Estimate pool exposure (limited without direct position query)
  const estimatedValue = uniswapTxs.reduce((sum, tx) => {
    const amount = parseFloat(tx.amount) || 0;
    return sum + amount;
  }, 0);

  return {
    hasPositions: liquidityCount > 0,
    poolCount: poolAddresses.size,
    totalValueUsd: estimatedValue,
    pools: Array.from(poolAddresses).map((addr) => ({
      poolAddress: addr,
      token0: 'unknown',
      token1: 'unknown',
      valueUsd: 0,
      share: 0,
    })),
    riskFactors: riskFactors.slice(0, 5), // Cap at 5 risk factors
  };
}

function isUniswapInteraction(address: string): boolean {
  return Object.keys(UNISWAP_CONTRACTS).some(
    (contract) => contract.toLowerCase() === address.toLowerCase()
  );
}
