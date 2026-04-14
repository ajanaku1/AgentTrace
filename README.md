# AgentTrace

**Wallet Exposure Scanner for X Layer** — a reusable AI agent skill that analyzes on-chain risk using OnchainOS and Uniswap AI Skills.

Built for the [OKX Build X AI Hackathon](https://web3.okx.com/xlayer/buildx-hackathon) — **Skills Arena** track.

## Project Intro

AgentTrace scans any wallet address on X Layer and produces a comprehensive risk assessment. It fetches on-chain data via OnchainOS APIs, analyzes Uniswap V3 interactions, and runs a weighted scoring engine across 6 risk categories — returning a 0–100 risk score with detailed signals that other agents can act on.

**Use cases:** Pre-trade counterparty checks, DeFi lending risk assessment, governance voter verification, portfolio risk monitoring.

## Architecture Overview

```
                    ┌─────────────────┐
                    │   Agent / CLI   │
                    │  scanWallet()   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    Scanner      │
                    │  (Orchestrator) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───────┐ ┌───▼────┐ ┌───────▼───────┐
     │  OnchainOS API │ │Uniswap │ │   Scoring     │
     │  Client (HMAC) │ │Analyzer│ │   Engine      │
     └────────┬───────┘ └───┬────┘ └───────┬───────┘
              │             │              │
     ┌────────▼───────┐     │     ┌────────▼────────┐
     │ X Layer (196)  │     │     │  6 Categories   │
     │ • Balances     │     │     │  • Activity     │
     │ • Tx History   │     │     │  • Linkability  │
     │ • Token Info   │     │     │  • Financial    │
     │ • Holders      │     │     │  • Behavioral   │
     └────────────────┘     │     │  • Counterparty │
                            │     │  • DeFi         │
                            │     └─────────────────┘
                      ┌─────▼──────┐
                      │ Uniswap V3 │
                      │ Contracts  │
                      └────────────┘
```

### Source Structure

```
src/
├── cli.ts        # CLI entry point with pretty-printed output
├── index.ts      # Public API exports for module usage
├── scanner.ts    # Core orchestrator — parallel data fetch + scoring pipeline
├── onchainos.ts  # OnchainOS API client with HMAC-SHA256 auth
├── scoring.ts    # 6-category weighted risk scoring engine
├── uniswap.ts    # Uniswap V3 pool exposure analyzer
└── types.ts      # TypeScript type definitions
```

## Deployment Address

**Agentic Wallet:** `0xc11bf6e5809835213fcd64e2e45409117bdd36cc` (X Layer, Ethereum, Polygon, 16+ EVM chains)

## OnchainOS / Uniswap Skill Usage

### OnchainOS Modules

| Module | Endpoint | Purpose |
|--------|----------|---------|
| **Wallet API** | `/api/v6/dex/balance/all-token-balances-by-address` | Fetch all token balances with risk flags and USD pricing |
| **Transaction History API** | `/api/v6/dex/post-transaction/transactions-by-address` | Full paginated tx history with blacklist detection |
| **Market API** | `/api/v6/dex/market/token/basic-info` | Token metadata and community recognition status |
| **Market API** | `/api/v6/dex/market/token/holder` | Top holder analysis with PnL and funding sources |

All requests use HMAC-SHA256 authenticated signing per OKX API spec. The client handles timestamp generation, signature computation, and pagination automatically.

### Uniswap V3 Integration

AgentTrace detects Uniswap V3 contract interactions by cross-referencing transaction addresses and method signatures:

- **Contracts tracked:** UniswapV3Factory, SwapRouter, NonfungiblePositionManager, Quoter
- **Methods classified:** exactInputSingle, exactInput, mint, increaseLiquidity, decreaseLiquidity, collect
- **Analysis output:** Swap frequency, liquidity position count, pool exposure estimation, failed tx flagging

## Working Mechanics

1. **Input** — Accepts any EVM wallet address
2. **Data Fetch** — Parallel calls to OnchainOS APIs for token balances and transaction history on X Layer (chain 196)
3. **Analysis** — Raw data processed into: transaction velocity, counterparty graphs, time-of-day patterns, financial footprint, Uniswap exposure
4. **Scoring** — 6 weighted categories each produce a 0–100 score with specific signals:

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Wallet Activity | 18% | Age, tx volume, fail rates, blacklist hits |
| Address Linkability | 22% | Counterparty graph, concentration risk |
| Financial Footprint | 20% | Portfolio value, token diversity, risky tokens |
| Behavioral Profile | 17% | Timing patterns, burst activity, automation signals |
| Counterparty Risk | 13% | Who this wallet interacts with |
| DeFi Exposure | 10% | Uniswap positions and pool interactions |

5. **Output** — Structured JSON with overall score, risk level (LOW/MEDIUM/HIGH/CRITICAL), category breakdowns, risk flags, and human-readable summary

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Fill in OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE

# Scan a wallet
npx tsx src/cli.ts scan 0xc11bf6e5809835213fcd64e2e45409117bdd36cc

# JSON output (for programmatic use)
npx tsx src/cli.ts scan 0xc11bf6e5809835213fcd64e2e45409117bdd36cc --json
```

## Use as a Module

Other agents can import AgentTrace directly:

```typescript
import { scanWallet, initClient } from 'agent-trace';

initClient({
  apiKey: process.env.OKX_API_KEY,
  secretKey: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE,
});

const result = await scanWallet('0x...');
console.log(result.overallScore); // 0-100
console.log(result.riskLevel);    // LOW | MEDIUM | HIGH | CRITICAL
console.log(result.flags);        // Specific risk flags
console.log(result.categories);   // Detailed per-category breakdown
```

## Team

- **Ajanaku Dahunsi** — Developer

## X Layer Ecosystem Positioning

AgentTrace fills the **safety infrastructure** gap in the X Layer agent ecosystem. Every agent that trades, lends, or interacts with other wallets on X Layer needs to assess counterparty risk before transacting. AgentTrace provides this as a single function call, enabling:

- **Trading agents** — Check counterparty wallet safety before executing trades
- **Lending protocols** — Evaluate borrower risk profile before extending credit
- **Governance systems** — Verify voter legitimacy and detect sybil wallets
- **Portfolio managers** — Monitor wallet risk exposure over time
- **Other skills** — Compose with AgentTrace for risk-aware decision making

## Tech Stack

- TypeScript 5.6
- Node.js (zero framework dependencies)
- OnchainOS API (X Layer chain 196)
- Uniswap V3 contract analysis

## License

MIT
