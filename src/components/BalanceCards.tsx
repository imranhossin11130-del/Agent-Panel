import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Sparkles, Receipt } from 'lucide-react';
import { AgentProfile, Language } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';

interface BalanceCardsProps {
  profile: AgentProfile;
  language: Language;
  onWithdrawCommission: () => void;
}

export const BalanceCards: React.FC<BalanceCardsProps> = ({
  profile,
  language,
  onWithdrawCommission,
}) => {
  const t = translations[language];

  const [showWallet, setShowWallet] = useState(false);
  const [showCommission, setShowCommission] = useState(false);

  // Auto-hide balances after 4 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showWallet) {
      timer = setTimeout(() => setShowWallet(false), 4400);
    }
    return () => clearTimeout(timer);
  }, [showWallet]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showCommission) {
      timer = setTimeout(() => setShowCommission(false), 4400);
    }
    return () => clearTimeout(timer);
  }, [showCommission]);

  const formatBalance = (amount: number) => {
    return amount.toLocaleString('bn-BD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getFormatNum = (amount: number) => {
    if (language === 'bn') {
      return formatBalance(amount);
    }
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pt-4">
      {/* WALLET BALANCE CARD (Blue Frosted Glass) */}
      <div 
        id="wallet-balance-card"
        className="relative overflow-hidden rounded-2xl glass-card bg-blue-500/10 hover:bg-blue-500/15 border border-blue-400/20 px-3.5 py-4 text-white hover:active-glow flex flex-col justify-between aspect-[1.12/11/1] min-h-[160px] cursor-pointer active:scale-95 transition-all"
        onClick={() => setShowWallet(!showWallet)}
      >
        {/* Abstract glass glow background circles */}
        <div className="absolute right-[-10px] bottom-[-15px] opacity-10 text-blue-300 w-20 h-20 rounded-full border-[6px] border-blue-400 blur-xs"></div>
        <div className="absolute right-[-25px] bottom-[-2px] opacity-5 text-indigo-200 w-20 h-20 rounded-full border-[8px] border-indigo-400 blur-xs"></div>

        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 block">
            {t.walletBalance}
          </span>
          
          <div className="mt-3.5 relative min-h-[36px] flex items-center">
            <AnimatePresence mode="wait">
              {showWallet ? (
                <motion.div
                  key="balance"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline space-x-1"
                >
                  <span className="text-xl font-black text-white">৳ {getFormatNum(profile.walletBalance)}</span>
                </motion.div>
              ) : (
                <motion.div
                  key="tap_reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1.5 px-3 flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-blue-200">
                    {t.tapToViewBalance}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4">
          <span className="inline-flex items-center text-[9px] bg-sky-400/10 text-sky-300 py-1 px-2 rounded-lg font-black leading-tight border border-sky-450/20">
            <Sparkles size={10} className="mr-1 text-sky-400 animate-pulse" />
            {t.cashInNote}
          </span>
        </div>
      </div>

      {/* COMMISSION BALANCE CARD (Pink Frosted Glass) */}
      <div 
        id="commission-balance-card"
        className="relative overflow-hidden rounded-2xl glass-card bg-rose-500/10 hover:bg-rose-500/15 border border-rose-450/20 px-3.5 py-4 text-white hover:active-glow flex flex-col justify-between min-h-[160px] active:scale-95 transition-all"
        onClick={() => setShowCommission(!showCommission)}
      >
        {/* Abstract pink glow circle */}
        <div className="absolute right-[-10px] bottom-[-20px] opacity-10 w-24 h-24 rounded-full border-4 border-rose-400 blur-xs"></div>

        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-300 block">
            {t.commissionBalance}
          </span>

          <div className="mt-3.5 relative min-h-[36px] flex items-center">
            <AnimatePresence mode="wait">
              {showCommission ? (
                <motion.div
                  key="commission"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline space-x-1"
                >
                  <span className="text-xl font-black text-rose-100">৳ {getFormatNum(profile.commissionBalance)}</span>
                </motion.div>
              ) : (
                <motion.div
                  key="tap_reveal_cmt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1.5 px-3 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <div className="w-2 h-2 rounded-full bg-rose-450 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-rose-200">
                    {t.tapToViewCommission}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Withdraw Commission Button */}
        <div className="mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onWithdrawCommission}
            className="w-full bg-white/10 text-rose-200 hover:text-white font-black text-[11px] py-2 px-1.5 rounded-xl hover:bg-white/15 active:scale-[97%] transition-all shadow-xs flex items-center justify-center space-x-1 border border-white/15"
          >
            <Receipt size={12} className="text-rose-300" />
            <span>{t.withdrawCommissionBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
