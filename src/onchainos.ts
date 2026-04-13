// ── OnchainOS API Client for X Layer (Chain 196) ──

import crypto from 'node:crypto';
import type {
  OKXApiResponse,
  OKXBalanceData,
  OKXTransactionData,
  OKXTokenInfo,
  OKXTokenHolder,
  TokenBalance,
  TransactionData,
  TokenInfo,
  TokenHolderInfo,
} from './types.js';

const BASE_URL = 'https://web3.okx.com';
const XLAYER_CHAIN_ID = '196';

interface OKXCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

let credentials: OKXCredentials | null = null;

export function initClient(creds: OKXCredentials) {
  credentials = creds;
}

function getCredentials(): OKXCredentials {
  if (!credentials) {
    credentials = {
      apiKey: process.env.OKX_API_KEY || '',
      secretKey: process.env.OKX_SECRET_KEY || '',
      passphrase: process.env.OKX_PASSPHRASE || '',
    };
  }
  if (!credentials.apiKey || !credentials.secretKey || !credentials.passphrase) {
    throw new Error('OKX credentials not configured. Set OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE.');
  }
  return credentials;
}

function sign(timestamp: string, method: string, path: string, body: string = ''): string {
  const creds = getCredentials();
  const prehash = timestamp + method.toUpperCase() + path + body;
  const hmac = crypto.createHmac('sha256', creds.secretKey);
  hmac.update(prehash);
  return hmac.digest('base64');
}

async function apiRequest<T>(method: string, path: string, body?: object): Promise<T> {
  const creds = getCredentials();
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = sign(timestamp, method, path, bodyStr);

  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': creds.apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-PASSPHRASE': creds.passphrase,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'Content-Type': 'application/json',
  };

  const url = `${BASE_URL}${path}`;
  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    opts.body = bodyStr;
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    throw new Error(`OKX API error: ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : '';
}

// ── Public API Methods ──

export async function getTokenBalances(address: string): Promise<TokenBalance[]> {
  const path = '/api/v6/dex/balance/all-token-balances-by-address';
  const query = buildQuery({ address, chains: XLAYER_CHAIN_ID });
  const res = await apiRequest<OKXApiResponse<OKXBalanceData>>('GET', path + query);

  if (res.code !== '0' || !res.data?.length) return [];

  return res.data.map((t) => ({
    symbol: t.symbol,
    contractAddress: t.tokenContractAddress,
    balance: t.balance,
    rawBalance: t.rawBalance,
    priceUsd: parseFloat(t.tokenPrice) || 0,
    valueUsd: parseFloat(t.balance) * (parseFloat(t.tokenPrice) || 0),
    isRiskToken: t.isRiskToken,
  }));
}

export async function getTransactionHistory(
  address: string,
  limit: number = 20
): Promise<TransactionData[]> {
  const allTxs: TransactionData[] = [];
  let cursor = '';

  // Paginate up to the requested limit
  while (allTxs.length < limit) {
    const params: Record<string, string> = {
      address,
      chains: XLAYER_CHAIN_ID,
      limit: String(Math.min(20, limit - allTxs.length)),
    };
    if (cursor) params.cursor = cursor;

    const path = '/api/v6/dex/post-transaction/transactions-by-address';
    const query = buildQuery(params);
    const res = await apiRequest<OKXApiResponse<OKXTransactionData>>('GET', path + query);

    if (res.code !== '0' || !res.data?.length) break;

    for (const tx of res.data) {
      allTxs.push({
        txHash: tx.txHash,
        txTime: parseInt(tx.txTime, 10),
        from: tx.from?.[0]?.address || '',
        to: tx.to?.[0]?.address || '',
        amount: tx.amount || tx.to?.[0]?.amount || '0',
        symbol: tx.symbol || '',
        tokenContract: tx.tokenContractAddress || '',
        txStatus: tx.txStatus as TransactionData['txStatus'],
        methodId: tx.methodId || '',
        txFee: tx.txFee || '0',
        hitBlacklist: tx.hitBlacklist || false,
      });
      cursor = tx.cursor || '';
    }

    if (!cursor || res.data.length < 20) break;
  }

  return allTxs;
}

export async function getTokenInfo(contractAddress: string): Promise<TokenInfo | null> {
  const path = '/api/v6/dex/market/token/basic-info';
  const body = { chainIndex: XLAYER_CHAIN_ID, tokenContractAddress: contractAddress };
  const res = await apiRequest<OKXApiResponse<OKXTokenInfo>>('POST', path, body);

  if (res.code !== '0' || !res.data?.length) return null;

  const t = res.data[0];
  return {
    name: t.tokenName,
    symbol: t.tokenSymbol,
    contractAddress,
    chainId: t.chainIndex,
    logoUrl: t.tokenLogoUrl,
    decimals: parseInt(t.decimal, 10),
    isCommunityRecognized: t.tagList?.some((tag) => tag.communityRecognized) || false,
  };
}

export async function getTopHolders(
  contractAddress: string,
  limit: number = 20
): Promise<TokenHolderInfo[]> {
  const path = '/api/v6/dex/market/token/holder';
  const query = buildQuery({
    chainIndex: XLAYER_CHAIN_ID,
    tokenContractAddress: contractAddress,
    limit: String(limit),
  });
  const res = await apiRequest<OKXApiResponse<OKXTokenHolder>>('GET', path + query);

  if (res.code !== '0' || !res.data?.length) return [];

  return res.data.map((h) => ({
    holderAddress: h.holderWalletAddress,
    holdPercent: parseFloat(h.holdPercent) || 0,
    holdAmount: h.holdAmount,
    avgBuyPrice: parseFloat(h.avgBuyPrice) || 0,
    avgSellPrice: parseFloat(h.avgSellPrice) || 0,
    totalPnlUsd: parseFloat(h.totalPnlUsd) || 0,
    fundingSource: h.fundingSource || '',
  }));
}
