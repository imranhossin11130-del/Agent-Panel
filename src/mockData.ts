import { Transaction, AgentProfile, DailyStats } from './types';

// Helper to generate Bangladeshi phone numbers
const generateBDNumber = (prefix: string, suffix: string) => `01${prefix}${suffix}`;

export const INITIAL_PROFILE: AgentProfile = {
  name: 'Meghla Maya',
  agentId: '30149028',
  phone: '+880 1792-345678',
  isVerified: true,
  walletBalance: 0.00,
  commissionBalance: 0.00,
};

// Generate 31 realistic transactions that sum up to exactly ৳795 dynamic commission
// 12 Cash In, 6 Cash Out, 10 Recharge, 3 Bill Pay
export const generateInitialTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const now = new Date();
  
  // Commission distributions:
  // Recharges: 10 transactions. Let's make commission sum to ৳100 (e.g. 10 * ৳10)
  // Cash In: 12 transactions. Let's make commission sum to ৳450 (mostly around ৳30-৳50 each)
  // Cash Out: 6 transactions. Let's make commission sum to ৳200 (mostly around ৳33-৳34 each)
  // Bill Pay: 3 transactions. Let's make commission sum to ৳45 (exactly ৳15 each)
  // Total = 100 + 450 + 200 + 45 = ৳795 commission/earnings
  
  const generateTrxId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BN';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 1. Mobile Recharges (10 transactions)
  const telcos = ['Grameenphone', 'Robi', 'Banglalink', 'Airtel', 'Teletalk'];
  const rechargeAmounts = [400, 350, 450, 500, 300, 250, 400, 350, 200, 300]; // Sum 3500
  // Each recharge has a 2.85% average commission, let's just force exact values to sum to ৳100 in total
  const rechargeCommissions = [11, 10, 13, 14, 9, 7, 11, 10, 6, 9]; // Sum 100
  
  for (let i = 0; i < 10; i++) {
    const time = new Date(now);
    time.setHours(now.getHours() - (1 + i * 2));
    transactions.push({
      id: generateTrxId(),
      type: 'recharge',
      phoneOrAccount: generateBDNumber(String(7 + (i % 3)), String(1234567 + i)),
      operatorOrBiller: telcos[i % telcos.length],
      amount: rechargeAmounts[i],
      commission: rechargeCommissions[i],
      timestamp: time,
      status: 'SUCCESS',
    });
  }

  // 2. Cash In (12 transactions)
  // Commission mostly around 0.3% of transaction amount
  const cashInAmounts = [15000, 10000, 20000, 12000, 18000, 8000, 15000, 9000, 11000, 13000, 7000, 12000]; // Sum 150,000
  const cashInCommissions = [45, 30, 60, 36, 54, 24, 45, 27, 33, 39, 21, 36]; // Sum 450 (exactly 0.3%)
  
  for (let i = 0; i < 12; i++) {
    const time = new Date(now);
    time.setHours(now.getHours() - (i % 5));
    time.setMinutes(now.getMinutes() - (i * 4));
    transactions.push({
      id: generateTrxId(),
      type: 'cash_in',
      phoneOrAccount: generateBDNumber('9', String(3456789 + i)),
      amount: cashInAmounts[i],
      commission: cashInCommissions[i],
      timestamp: time,
      status: 'SUCCESS',
    });
  }

  // 3. Cash Out (6 transactions)
  const cashOutAmounts = [12000, 15000, 10000, 18000, 15000, 10000]; // Sum 80,000
  const cashOutCommissions = [30, 37, 25, 45, 38, 25]; // Sum 200 (approx 0.25%)
  
  for (let i = 0; i < 6; i++) {
    const time = new Date(now);
    time.setHours(now.getHours() - (2 + i * 3));
    transactions.push({
      id: generateTrxId(),
      type: 'cash_out',
      phoneOrAccount: generateBDNumber('8', String(4567891 - i)),
      amount: cashOutAmounts[i],
      commission: cashOutCommissions[i],
      timestamp: time,
      status: 'SUCCESS',
    });
  }

  // 4. Pay Bill (3 transactions)
  const billers = ['DESCO (Electricity)', 'WASA (Water)', 'Link3 (Internet)'];
  const billAmounts = [1500, 1200, 1800];
  const billCommissions = [15, 15, 15]; // Sum 45
  
  for (let i = 0; i < 3; i++) {
    const time = new Date(now);
    time.setHours(now.getHours() - (4 + i * 5));
    transactions.push({
      id: generateTrxId(),
      type: 'bill_pay',
      phoneOrAccount: `ACCT-2026-${549 + i}`,
      operatorOrBiller: billers[i],
      amount: billAmounts[i],
      commission: billCommissions[i],
      timestamp: time,
      status: 'SUCCESS',
    });
  }

  // Sort by timestamp descending
  return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const getStoredTransactions = (): Transaction[] => {
  const stored = localStorage.getItem('mfs_transactions');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.map((t: any) => ({
        ...t,
        timestamp: new Date(t.timestamp),
      }));
    } catch (e) {
      console.error(e);
    }
  }
  const initial = generateInitialTransactions();
  localStorage.setItem('mfs_transactions', JSON.stringify(initial));
  return initial;
};

export const getStoredProfile = (): AgentProfile => {
  const stored = localStorage.getItem('mfs_profile');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      parsed.walletBalance = 0.00;
      parsed.commissionBalance = 0.00;
      return parsed;
    } catch (e) {
      console.error(e);
    }
  }
  localStorage.setItem('mfs_profile', JSON.stringify(INITIAL_PROFILE));
  return INITIAL_PROFILE;
};

export const saveState = (profile: AgentProfile, transactions: Transaction[]) => {
  localStorage.setItem('mfs_profile', JSON.stringify(profile));
  localStorage.setItem('mfs_transactions', JSON.stringify(transactions));
};

export const getDailyStatsFromTransactions = (transactions: Transaction[]): DailyStats => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const todayTransactions = transactions.filter(t => t.timestamp >= startOfDay && t.status === 'SUCCESS');
  
  const todayCount = todayTransactions.length;
  const todayIncome = todayTransactions.reduce((acc, t) => acc + t.commission, 0);
  
  // In our simulation, let's keep monthly profit as the accumulation of commission of all transactions in our log
  const monthlyProfit = transactions
    .filter(t => t.status === 'SUCCESS' && t.timestamp.getMonth() === now.getMonth())
    .reduce((acc, t) => acc + t.commission, 0);

  return {
    todayTransactionsCount: todayCount,
    todayIncome: todayIncome,
    currentMonthProfit: monthlyProfit,
  };
};
