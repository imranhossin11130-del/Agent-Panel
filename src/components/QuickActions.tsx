import React from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Smartphone, 
  FileText, 
  Plus, 
  Coins, 
  HelpCircle, 
  Send,
  History,
  Gift
} from 'lucide-react';
import { TransactionType, Language } from '../types';
import { translations } from '../translations';

interface QuickActionsProps {
  language: Language;
  onActionClick: (action: any) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  language,
  onActionClick,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';

  const menuItems = [
    {
      id: 'cash_in',
      label: t.actionCashIn,
      icon: ArrowDownLeft,
      color: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
      actionKey: 'cash_in' as TransactionType,
    },
    {
      id: 'cash_out',
      label: t.actionCashOut,
      icon: ArrowUpRight,
      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
      actionKey: 'cash_out' as TransactionType,
    },
    {
      id: 'recharge',
      label: t.actionMobileRecharge,
      icon: Smartphone,
      color: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
      actionKey: 'recharge' as TransactionType,
    },
    {
      id: 'bill_pay',
      label: t.actionBillLive,
      icon: FileText,
      color: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
      actionKey: 'bill_pay' as TransactionType,
    },
    {
      id: 'agent_cash',
      label: t.actionAgentCash,
      icon: Plus,
      color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
      actionKey: 'agent_cash' as TransactionType,
    },
    {
      id: 'commission_withdraw',
      label: t.actionCommissionWithdraw,
      icon: Coins,
      color: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
      actionKey: 'commission_withdraw' as TransactionType,
    },
    {
      id: 'guidelines',
      label: t.actionGuidelines,
      icon: HelpCircle,
      color: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
      actionKey: 'guidelines' as const,
    },
    {
      id: 'support',
      label: t.actionSupport,
      icon: Send,
      color: 'bg-blue-500/25 text-white border-blue-400/35 hover:bg-blue-550/30',
      actionKey: 'support' as const,
    },
    {
      id: 'history_log',
      label: t.actionHistoryLog,
      icon: History,
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/25',
      actionKey: 'history_log' as const,
    },
    {
      id: 'refer',
      label: isBn ? 'রেফার' : 'Refer',
      icon: Gift,
      color: 'bg-orange-500/20 text-orange-300 border-orange-500/25',
      actionKey: 'refer' as const,
    },
  ];

  return (
    <div className="px-4 py-2">
      <div className="glass-card rounded-3xl p-5">
        {/* Panel Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-white tracking-tight flex items-center uppercase">
            {t.quickActionsTitle}
          </h3>
          <span className="text-[10px] bg-white/5 text-indigo-300 font-extrabold px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">
            {t.servicePanelLabel}
          </span>
        </div>

        {/* 4x2 Grid of Actions */}
        <div className="grid grid-cols-4 gap-y-6 gap-x-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onActionClick(item.actionKey)}
                className="flex flex-col items-center group cursor-pointer focus:outline-hidden"
              >
                {/* Outer Circular frame with hover expand state */}
                <div 
                  className={`
                    w-14 h-14 rounded-full flex items-center justify-center 
                    border transition-all duration-250 shadow-xs
                    group-active:scale-90 group-hover:scale-105 group-hover:active-glow
                    ${item.color}
                  `}
                >
                  <Icon 
                    size={20} 
                    className="transition-transform duration-250 group-hover:rotate-6" 
                  />
                </div>
                
                {/* Label text */}
                <span className="mt-2 text-[10px] font-bold text-center text-white/70 max-w-[70px] leading-tight break-words group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
