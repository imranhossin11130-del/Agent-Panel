export type TransactionType = 'cash_in' | 'cash_out' | 'recharge' | 'bill_pay' | 'agent_cash' | 'commission_withdraw' | 'refill';

export interface Transaction {
  id: string;
  type: TransactionType;
  phoneOrAccount: string;
  operatorOrBiller?: string;
  amount: number;
  commission: number;
  timestamp: Date;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  fee?: number;
}

export interface AgentProfile {
  name: string;
  agentId: string;
  phone: string;
  isVerified: boolean;
  walletBalance: number;
  commissionBalance: number;
  avatarUrl?: string;
}

export interface DailyStats {
  todayTransactionsCount: number;
  todayIncome: number;
  currentMonthProfit: number;
}

export type ActiveTab = 'home' | 'history' | 'refill' | 'profile';

export type Language = 'bn' | 'en';

