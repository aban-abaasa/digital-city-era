// Ported from mybodaguy's src/mybodaguy/services/icanWalletService.ts. Both
// apps read/write the same shared ican_user_wallets / ican_coin_transactions
// tables, so this re-exports digital-city-era's own service instead of
// duplicating it.
export { getBalance, getTransactions, ugxToICAN, formatICAN, ICAN_TO_UGX, sendICAN } from '@/services/icanWalletService';

export type ICANBalance = {
  ican: number;
  ugx: number;
  address: string | null;
  totalEarned: number;
  totalSpent: number;
  totalTithe: number;
};
