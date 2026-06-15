import React from 'react';
import { DailyStats, Language } from '../types';
import { translations } from '../translations';

interface StatsGridProps {
  stats: DailyStats;
  language: Language;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, language }) => {
  const t = translations[language];

  const getFormatNum = (amount: number) => {
    if (language === 'bn') {
      return amount.toLocaleString('bn-BD');
    }
    return amount.toLocaleString('en-US');
  };

  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-3">
      {/* Today's Transactions Card */}
      <div 
        id="stat-card-transactions"
        className="relative glass-card glass-card-hover rounded-2xl p-3 flex flex-col justify-between overflow-hidden min-h-[92px] transition-all"
      >
        {/* Colorful left border indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-sm"></div>
        
        <div className="pl-1.5">
          <span className="text-[10px] font-black text-white/60 leading-tight block uppercase tracking-wider">
            {t.todayTransactions}
          </span>
        </div>
        
        <div className="pl-1.5 mt-2">
          <span className="text-base font-black text-white">
            {getFormatNum(stats.todayTransactionsCount)}{' '}
            <span className="text-xs font-bold text-white/40">
              {t.unitTimes}
            </span>
          </span>
        </div>
      </div>

      {/* Today's Earnings Card */}
      <div 
        id="stat-card-earnings"
        className="relative glass-card glass-card-hover rounded-2xl p-3 flex flex-col justify-between overflow-hidden min-h-[92px] transition-all"
      >
        {/* Colorful left border indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-r-sm"></div>
        
        <div className="pl-1.5">
          <span className="text-[10px] font-black text-white/60 leading-tight block uppercase tracking-wider">
            {t.todayIncomeLabel}
          </span>
        </div>
        
        <div className="pl-1.5 mt-2">
          <span className="text-base font-black text-emerald-350">
            ৳{getFormatNum(stats.todayIncome)}
          </span>
        </div>
      </div>

      {/* Current Month's Profit Card */}
      <div 
        id="stat-card-profit"
        className="relative glass-card glass-card-hover rounded-2xl p-3 flex flex-col justify-between overflow-hidden min-h-[92px] transition-all"
      >
        {/* Colorful left border indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-fuchsia-400 to-purple-500 rounded-r-sm"></div>
        
        <div className="pl-1.5">
          <span className="text-[10px] font-black text-white/60 leading-tight block uppercase tracking-wider">
            {t.currentMonthProfitLabel}
          </span>
        </div>
        
        <div className="pl-1.5 mt-2">
          <span className="text-base font-black text-fuchsia-350">
            ৳{getFormatNum(stats.currentMonthProfit)}
          </span>
        </div>
      </div>
    </div>
  );
};
