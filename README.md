# AgentTrace

**Wallet Exposure Scanner for X Layer** — an AI agent skill that analyzes on-chain risk using OnchainOS and Uniswap AI Skills.

Built for the [OKX Build X AI Hackathon](https://www.moltbook.com/m/buildx) (Skill Arena Track).

## What It Does

AgentTrace takes any wallet address on X Layer and produces a comprehensive risk assessment across 6 weighted categories:

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Wallet Activity | 18% | Age, tx volume, fail rates, blacklist hits |
| Address Linkability | 22% | Counterparty graph, concentration risk |
| Financial Footprint | 20% | Portfolio value, token diversity, risky tokens |
| Behavioral Profile | 17% | Timing patterns, burst activity, automation |
| Counterparty Risk | 13% | Who this wallet interacts with |
| DeFi Exposure | 10% | Uniswap positions and pool interactions |

Returns a score from 0–100 with risk level (LOW / MEDIUM / HIGH / CRITICAL), detailed signals per category, and specific risk flags.

## Quick Start

```bash
# Install
npm install

# Configure (copy .env.example to .env and fill in your OnchainOS credentials)
cp .env.example .env

# Scan a wallet
npm run scan -- 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18

# JSON output
npx tsx src/cli.ts scan 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 --json
```

## Use as a Module

```typescript
import { scanWallet, initClient } from 'agent-trace';

initClient({
  apiKey: process.env.OKX_API_KEY,
  secretKey: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE,
});

const result = await scanWallet('0x...');
// result.overallScore → 0-100
// result.riskLevel → LOW | MEDIUM | HIGH | CRITICAL
// result.categories → detailed breakdown
// result.flags → specific risk flags
```

## OnchainOS Integration

AgentTrace uses these OnchainOS modules:

- **Wallet API** — Token balances via `/api/v6/dex/balance/all-token-balances-by-address`
- **Transaction History** — Full tx history via `/api/v6/dex/post-transaction/transactions-by-address`
- **Market API** — Token info and holder data via `/api/v6/dex/market/token/*`

All requests are authenticated with HMAC-SHA256 signing per OKX API spec.

## Uniswap AI Skills Integration

Detects and analyzes Uniswap V3 interactions:
- Swap frequency and patterns
- Liquidity position tracking
- Failed transaction flagging
- Pool exposure estimation

## Architecture

```
src/
├── cli.ts        # CLI entry point with pretty-printed output
├── index.ts      # Public API exports for module usage
├── scanner.ts    # Core orchestrator — fetches data, runs scoring
├── onchainos.ts  # OnchainOS API client with HMAC auth
├── scoring.ts    # 6-category weighted risk scoring engine
├── uniswap.ts    # Uniswap pool exposure analyzer
└── types.ts      # TypeScript type definitions
```

## Tech Stack

- TypeScript 5.6
- Node.js (no framework dependencies)
- OnchainOS API (X Layer chain 196)
- Uniswap V3 contract analysis

## License

MIT
