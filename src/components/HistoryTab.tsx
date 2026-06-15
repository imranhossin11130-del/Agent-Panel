import React, { useState } from 'react';
import { Search, ArrowDownLeft, ArrowUpRight, Smartphone, FileText, CheckCircle2, TrendingUp, Info, X, ShieldCheck, Clock, Layers, Copy, Check } from 'lucide-react';
import { Transaction, Language, TransactionType } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryTabProps {
  transactions: Transaction[];
  language: Language;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ transactions, language }) => {
  const t = translations[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | TransactionType>('all');
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const getFormatNum = (amount: number) => {
    if (language === 'bn') {
      return amount.toLocaleString('bn-BD', { minimumFractionDigits: 2 });
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const filteredTransactions = transactions.filter((trx) => {
    // 1. Filter by category
    if (selectedFilter !== 'all' && trx.type !== selectedFilter) return false;
    
    // 2. Search query matches
    const query = searchQuery.toLowerCase();
    const phoneMatch = trx.phoneOrAccount.toLowerCase().includes(query);
    const idMatch = trx.id.toLowerCase().includes(query);
    const opMatch = trx.operatorOrBiller?.toLowerCase().includes(query) || false;
    
    return phoneMatch || idMatch || opMatch;
  });

  const getTrxTypeDetails = (type: TransactionType) => {
    switch (type) {
      case 'cash_in':
        return {
          label: t.actionCashIn,
          icon: ArrowDownLeft,
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/25',
          textColor: 'text-rose-300'
        };
      case 'cash_out':
        return {
          label: t.actionCashOut,
          icon: ArrowUpRight,
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/25',
          textColor: 'text-emerald-300'
        };
      case 'recharge':
        return {
          label: t.actionMobileRecharge,
          icon: Smartphone,
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/25',
          textColor: 'text-sky-300'
        };
      case 'bill_pay':
        return {
          label: t.actionBillLive,
          icon: FileText,
          color: 'bg-pink-500/20 text-pink-300 border-pink-500/25',
          textColor: 'text-pink-300'
        };
      case 'commission_withdraw':
        return {
          label: t.actionCommissionWithdraw,
          icon: TrendingUp,
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/25',
          textColor: 'text-amber-300'
        };
      case 'refill':
        return {
          label: language === 'bn' ? 'ফান্ড রিফিল' : 'Wallet Refill',
          icon: ShieldCheck,
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/25',
          textColor: 'text-indigo-300'
        };
      default:
        return {
          label: language === 'bn' ? 'অন্যান্য' : 'Others',
          icon: Info,
          color: 'bg-white/10 text-white/85 border-white/20',
          textColor: 'text-white/80'
        };
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in px-4 pt-1">
      {/* Search Header */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'bn' ? 'নম্বর বা ট্রানজেকশন আইডি খুঁজুন...' : 'Search number, account ID, or Trx ID...'}
          className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 rounded-2xl py-3 px-4 pl-11 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-450 focus:border-rose-450 focus:bg-white/10 shadow-xs"
        />
        <Search className="absolute left-4 top-3.5 text-white/40" size={16} />
      </div>

      {/* Filter Quick Pill bar */}
      <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0 text-[10px] uppercase font-black tracking-wider">
        {[
          { key: 'all', label: language === 'bn' ? 'সব' : 'All' },
          { key: 'cash_in', label: t.actionCashIn },
          { key: 'cash_out', label: t.actionCashOut },
          { key: 'recharge', label: t.actionMobileRecharge },
          { key: 'bill_pay', label: t.actionBillLive },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setSelectedFilter(item.key as any)}
            className={`px-3.5 py-2.5 rounded-xl border text-nowrap transition-all active:scale-95 cursor-pointer ${
              selectedFilter === item.key
                ? 'bg-rose-550 border-rose-500/30 text-white shadow-xs font-black'
                : 'bg-white/5 border-white/10 text-white/60 font-semibold hover:bg-white/10 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Ledger list */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center">
            <Info className="mx-auto text-white/20 mb-2" size={32} />
            <p className="text-xs text-white/50 font-bold">
              {language === 'bn' ? 'কোনো লেনদেন রেকর্ড পাওয়া যায়নি!' : 'No matching transactions found!'}
            </p>
          </div>
        ) : (
          filteredTransactions.map((trx) => {
            const details = getTrxTypeDetails(trx.type);
            const TrxIcon = details.icon;
            
            return (
              <div 
                key={trx.id}
                onClick={() => {
                  setSelectedTrx(trx);
                  setIsCopied(false);
                }}
                className="glass-card glass-card-hover rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all select-none"
              >
                {/* Left icon & info */}
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${details.color}`}>
                    <TrxIcon size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-black text-white">{details.label}</span>
                      {trx.operatorOrBiller && (
                        <span className="text-[9px] bg-white/5 text-white/70 font-extrabold px-1.5 py-0.5 rounded-full border border-white/10">
                          {trx.operatorOrBiller}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/50 font-black tracking-wider mt-0.5">
                      {trx.phoneOrAccount}
                    </span>
                    <span className="text-[9px] text-white/40 font-semibold mt-1">
                      {trx.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {trx.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                      • {trx.id}
                    </span>
                  </div>
                </div>

                {/* Right amounts */}
                <div className="flex flex-col items-end text-right justify-between h-full min-h-[44px]">
                  {/* Status badge */}
                  <span className={`flex items-center text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                    trx.status === 'SUCCESS' 
                      ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/25'
                      : trx.status === 'PENDING'
                      ? 'text-amber-300 bg-amber-500/15 border border-amber-500/25'
                      : 'text-rose-300 bg-rose-500/15 border border-rose-500/25'
                  }`}>
                    <CheckCircle2 size={7} className={`mr-0.5 fill-current`} />
                    {trx.status}
                  </span>

                  {/* Principal money impact */}
                  <span className="text-xs font-black text-white mt-1.5">
                    {trx.type === 'cash_out' || trx.type === 'refill' ? '+' : '-'}৳ {getFormatNum(trx.amount)}
                  </span>

                  {/* Agent Commission gained */}
                  {trx.commission > 0 && (
                    <span className="text-[9px] text-emerald-355 font-black tracking-tight flex items-center mt-1">
                      <TrendingUp size={10} className="mr-0.5" />
                      +{t.takaSymbol}{getFormatNum(trx.commission)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Details Modal Slider */}
      <AnimatePresence>
        {selectedTrx && (() => {
          const details = getTrxTypeDetails(selectedTrx.type);
          const TrxIcon = details.icon;
          const isSuccess = selectedTrx.status === 'SUCCESS';
          const isPending = selectedTrx.status === 'PENDING';
          const isFailed = selectedTrx.status === 'FAILED';

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 select-none"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col space-y-5"
              >
                {/* Modal Header & Close Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2.5 rounded-xl border ${details.color}`}>
                      <TrxIcon size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        {language === 'bn' ? 'লেনদেনের বিবরণ রসিদ' : 'TRANSACTION RECEIPT'}
                      </h4>
                      <span className="text-[9px] text-white/40 font-bold block mt-0.5">
                        {language === 'bn' ? 'ডিজিটাল পিওএস ভাউচার' : 'Digital POS Voucher'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTrx(null)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full border border-white/10 transition-all cursor-pointer active:scale-90"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Amount Display & Status badge */}
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center space-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-1.5">
                    <span className={`inline-flex items-center text-[7px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                      isSuccess 
                        ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/25'
                        : isPending
                        ? 'text-amber-300 bg-amber-500/15 border border-amber-500/25'
                        : 'text-rose-300 bg-rose-500/15 border border-rose-500/25'
                    }`}>
                      {selectedTrx.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40 font-bold block uppercase tracking-wider">
                    {language === 'bn' ? 'মোট স্থানান্তরিত টাকা' : 'TOTAL AMOUNT TRANSFERRED'}
                  </span>
                  <p className="text-2xl font-black text-white tracking-tight">
                    ৳ {getFormatNum(selectedTrx.amount)}
                  </p>
                  {selectedTrx.commission > 0 && (
                    <span className="inline-flex items-center text-[9px] text-emerald-350 font-black tracking-tight mt-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <TrendingUp size={11} className="mr-0.5 text-emerald-400" />
                      {language === 'bn' ? 'অর্জিত কমিশন: ' : 'Com. Earned: '} +৳ {getFormatNum(selectedTrx.commission)}
                    </span>
                  )}
                </div>

                {/* Voucher Specs Grid */}
                <div className="space-y-3.5 divide-y divide-white/5 text-[11px] font-semibold text-white/80">
                  {/* Trx ID row */}
                  <div className="flex items-center justify-between pt-0">
                    <span className="text-white/40 font-bold uppercase tracking-wider">{language === 'bn' ? 'ট্রানজেকশন আইডি' : 'TRANSACTION ID'}</span>
                    <button 
                      onClick={() => handleCopyId(selectedTrx.id)}
                      className="flex items-center space-x-1 font-mono font-black text-white px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-all active:scale-95 text-xs text-rose-300"
                    >
                      <span>{selectedTrx.id}</span>
                      {isCopied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    </button>
                  </div>

                  {/* Type / Category */}
                  <div className="flex items-center justify-between pt-2.5">
                    <span className="text-white/40 font-bold uppercase tracking-wider">{language === 'bn' ? 'লেনদেনের ধরণ' : 'TRANSACTION TYPE'}</span>
                    <span className="font-extrabold text-white">{details.label}</span>
                  </div>

                  {/* Destination phone / Account */}
                  <div className="flex items-center justify-between pt-2.5">
                    <span className="text-white/40 font-bold uppercase tracking-wider">{language === 'bn' ? 'গ্রাহক নম্বর/হিসাব' : 'RECIPIENT ACCOUNT'}</span>
                    <span className="font-mono font-black text-white">{selectedTrx.phoneOrAccount}</span>
                  </div>

                  {/* Operator / Provider if any */}
                  {selectedTrx.operatorOrBiller && (
                    <div className="flex items-center justify-between pt-2.5">
                      <span className="text-white/40 font-bold uppercase tracking-wider">{language === 'bn' ? 'অপারেটর/প্রোভাইডার' : 'SERVICE PROVIDER'}</span>
                      <span className="font-extrabold text-rose-350">{selectedTrx.operatorOrBiller}</span>
                    </div>
                  )}

                  {/* Initiation Timestamp */}
                  <div className="flex items-center justify-between pt-2.5">
                    <span className="text-white/40 font-bold uppercase tracking-wider">{language === 'bn' ? 'তারিখ ও সময়' : 'DATE & TIMESTAMP'}</span>
                    <span className="font-extrabold text-white/70">
                      {selectedTrx.timestamp.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}{' '}
                      {selectedTrx.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Audit Approval/Rejection Gate Interface */}
                <div className={`p-3.5 rounded-2xl border text-[10px] space-y-1.5 ${
                  isSuccess 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                    : isPending 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  <div className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-white/90">
                    <ShieldCheck size={13} className={isSuccess ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-rose-455'} />
                    <span>{language === 'bn' ? 'গেটওয়ে নিরাপত্তা ও অনুমোদন অডিট' : 'GATEWAY GATE & APPROVAL AUDIT'}</span>
                  </div>

                  <p className="font-semibold leading-relaxed text-white/70">
                    {selectedTrx.type === 'refill' ? (
                      isSuccess 
                        ? (language === 'bn' 
                            ? 'অনুমোদন সূত্র: প্রধান ডিস্ট্রিবিউটর দ্বারা ব্যাঙ্ক ট্র্যান্সফার ভেরিফিকেশন সফলভাবে সম্পন্ন। রিফান্ড বা ফান্ড তাৎক্ষনিক জমা।' 
                            : 'Approval Path: Bank Transfer verification completed successfully by the distributor. Funds added instantly.')
                        : (language === 'bn'
                            ? 'প্রত্যাখ্যাত বা বাতিল: ডিস্ট্রিবিউটর দ্বারা ব্যাংকিং ডিপোজিটে অমিল সনাক্ত করা হয়েছে।'
                            : 'Decline Path: Deposit unmatched detected by the distributor dashboard.')
                    ) : (
                      isSuccess 
                        ? (language === 'bn' 
                            ? 'অনুমোদন সূত্র: টেলিগ্রাম সুপার এডমিন বোট (@BDWalletAgentBot) দ্বারা পিন ও এপিআই গেটওয়ে দিয়ে সুরক্ষিত অটো-এপ্রুভড।' 
                            : 'Approval Path: Secured auto-approval using PIN & API credentials via Telegram Super Admin controller (@BDWalletAgentBot).')
                        : (language === 'bn'
                            ? 'অডিট স্টেটমেন্ট: সেশন অবৈধ বা ট্রানজেকশন রিকোয়েস্ট বাতিল করা হয়েছে।'
                            : 'Audit Statement: Session marked invalid or transaction request explicitly declined.')
                    )}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 font-mono text-[9px] text-white/30">
                    <span>STATUS: {isSuccess ? 'OK_APPROVED' : isPending ? 'AWAITING_QUEUE' : 'LOCK_DECLINED'}</span>
                    <span>ROUTE: {selectedTrx.type === 'refill' ? 'DIST_REFILL_CH_0' : 'API_TG_SECURE'}</span>
                  </div>
                </div>

                {/* Bottom confirmation action button */}
                <button
                  onClick={() => setSelectedTrx(null)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95 border border-white/10"
                >
                  {language === 'bn' ? 'বন্ধ করুন (CLOSE)' : 'Close Voucher'}
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
