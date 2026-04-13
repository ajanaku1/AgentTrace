---
name: agent-trace
version: 1.0.0
description: "Wallet exposure scanner skill for X Layer. Analyzes on-chain risk by scanning transaction history, token holdings, counterparty patterns, behavioral signatures, and Uniswap pool exposure via OnchainOS and Uniswap AI Skills. Returns a weighted risk score (0-100) across 6 categories. Use when evaluating wallet safety, checking counterparty risk, or performing due diligence on X Layer addresses."
---

# AgentTrace — Wallet Exposure Scanner

## What It Does

AgentTrace scans any wallet address on X Layer and returns a comprehensive risk assessment. It uses OnchainOS APIs for on-chain data and analyzes Uniswap interactions to produce a weighted score across 6 categories:

1. **Wallet Activity** (18%) — Age, tx volume, fail rates, blacklist hits
2. **Address Linkability** (22%) — Counterparty graph, concentration risk
3. **Financial Footprint** (20%) — Portfolio value, token diversity, risky tokens
4. **Behavioral Profile** (17%) — Timing patterns, burst activity, automation signals
5. **Counterparty Risk** (13%) — Who this wallet interacts with
6. **DeFi Exposure** (10%) — Uniswap positions and pool interactions

## Usage

### As a CLI

```bash
# Scan a wallet
agent-trace scan 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18

# JSON output for programmatic use
agent-trace scan 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 --json
```

### As a Module (for other agents)

```typescript
import { scanWallet, initClient } from 'agent-trace';

// Initialize with OnchainOS credentials
initClient({
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key',
  passphrase: 'your-passphrase',
});

// Scan a wallet
const result = await scanWallet('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
console.log(result.overallScore); // 0-100
console.log(result.riskLevel);    // LOW | MEDIUM | HIGH | CRITICAL
console.log(result.flags);        // Array of specific risk flags
```

## Environment Variables

```
OKX_API_KEY=your-api-key
OKX_SECRET_KEY=your-secret-key
OKX_PASSPHRASE=your-passphrase
```

## Output Format

```json
{
  "address": "0x...",
  "chain": "xlayer",
  "chainId": 196,
  "overallScore": 45,
  "riskLevel": "MEDIUM",
  "categories": [...],
  "flags": [...],
  "summary": "Moderate risk — some exposure signals detected...",
  "tokenBalances": [...],
  "transactionSummary": {...},
  "counterparties": {...},
  "uniswapExposure": {...}
}
```

## Risk Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0-24 | LOW | Normal on-chain behavior |
| 25-49 | MEDIUM | Some exposure signals warrant monitoring |
| 50-74 | HIGH | Significant exposure across categories |
| 75-100 | CRITICAL | Strong indicators of suspicious activity |
