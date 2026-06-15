import React, { useState } from 'react';
import { Download, CheckCircle2, RefreshCw, Layers, ShieldCheck, AlertCircle, Calendar } from 'lucide-react';
import { Language, AgentProfile } from '../types';
import { translations } from '../translations';

interface RefillTabProps {
  language: Language;
  profile: AgentProfile;
  onRefillSubmit: (amount: number) => void;
}

interface RefillRecord {
  id: string;
  distributor: string;
  amount: number;
  method: string;
  reference: string;
  timestamp: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const RefillTab: React.FC<RefillTabProps> = ({
  language,
  profile,
  onRefillSubmit,
}) => {
  const t = translations[language];

  const [distributor, setDistributor] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Local state for list of refill requests
  const [refills, setRefills] = useState<RefillRecord[]>([
    {
      id: "REF-0982-1D",
      distributor: "Dhaka North Distribution Unit Ltd",
      amount: 50000,
      method: "Bank Wire Transfer",
      reference: "TXN9281039801",
      timestamp: new Date(new Date().setDate(new Date().getDate() - 2)),
      status: 'APPROVED',
    },
    {
      id: "REF-0371-2A",
      distributor: "City Bank Clearing House",
      amount: 25000,
      method: "Cash Deposit",
      reference: "DEP-827391- Dhaka",
      timestamp: new Date(new Date().setDate(new Date().getDate() - 5)),
      status: 'APPROVED',
    }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!distributor) {
      setValidationError(language === 'bn' ? 'ডিস্ট্রিবিউটর সিলেক্ট করুন' : 'Please select distributor name');
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum < 500) {
      setValidationError(language === 'bn' ? 'সরাসরি অন্তত ৫00 টাকা রিফিল করতে হবে' : 'Minimum refill amount is 500 Taka');
      return;
    }

    if (!reference.trim()) {
      setValidationError(language === 'bn' ? 'পেমেন্ট রেফারেন্স / রিসিট নম্বর দিন' : 'Please provide deposit slip or reference number');
      return;
    }

    // Submit refill
    onRefillSubmit(amtNum);

    const newRecord: RefillRecord = {
      id: "REF-" + Math.floor(Math.random() * 1000 + 1000) + "-9D",
      distributor: distributor,
      amount: amtNum,
      method: method === 'bank_transfer' ? 'Bank Wire Transfer' : 'Cash Deposit',
      reference: reference,
      timestamp: new Date(),
      status: 'PENDING',
    };

    setRefills(prev => [newRecord, ...prev]);
    setSuccess(true);
    setAmount('');
    setReference('');
    
    // reset success state after 4 seconds
    setTimeout(() => setSuccess(false), 4500);
  };

  const getFormatNum = (num: number) => {
    if (language === 'bn') {
      return num.toLocaleString('bn-BD');
    }
    return num.toLocaleString('en-US');
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in px-4 pt-1">
      {/* Intro Header */}
      <div className="glass-card bg-rose-500/10 border border-rose-500/20 rounded-3xl p-4 flex items-start space-x-3">
        <div className="p-2 bg-rose-500/20 border border-rose-500/20 rounded-2xl text-rose-300 shrink-0">
          <Download size={18} className="animate-bounce" />
        </div>
        <div>
          <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider">{t.refillTitle}</h4>
          <p className="text-[10px] text-white/60 leading-relaxed font-semibold mt-1">{t.refillIntro}</p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-xs font-bold p-4 rounded-2xl flex items-start space-x-2">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <p>{t.refillSuccess}</p>
            <span className="text-[9px] text-emerald-400 mt-1 block">
              {t.refillPending}
            </span>
          </div>
        </div>
      )}

      {/* Main Refill Request Form */}
      <div className="glass-card rounded-3xl p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="bg-rose-500/15 text-rose-300 text-xs font-bold p-3 rounded-2xl flex items-center space-x-2 border border-rose-500/20">
              <AlertCircle size={14} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Distributor Name Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-white/50 tracking-wider">
              {t.distributorName}
            </label>
            <select
              value={distributor}
              onChange={(e) => setDistributor(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-rose-450 focus:bg-slate-900 focus:outline-hidden"
            >
              <option value="" className="bg-slate-900 border-none text-white/40">{language === 'bn' ? '-- ডিস্ট্রিবিউটর সিলেক্ট করুন --' : '-- Select Partner --'}</option>
              <option value="Dhaka North Distribution Unit Ltd" className="bg-slate-900 text-white">Dhaka North Distribution Unit Ltd</option>
              <option value="Chittagong South HQ Center" className="bg-slate-900 text-white">Chittagong South HQ Center</option>
              <option value="City Bank Merchant Clearing Corp" className="bg-slate-900 text-white">City Bank Merchant Clearing Corp</option>
              <option value="Robi Airtel Territory Office" className="bg-slate-900 text-white">Robi Airtel Territory Office</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-white/50 tracking-wider">
                {t.amount}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="৳ ৫,০০০"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 px-3 pl-8 text-xs font-black text-white placeholder-white/30 focus:outline-hidden focus:ring-1 focus:ring-rose-450 focus:bg-white/10"
                />
                <span className="absolute left-3 top-2.5 text-[11px] font-black text-rose-300">৳</span>
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-white/50 tracking-wider">
                {language === 'bn' ? 'রিসিট / ট্রানজেকশন নং' : 'Receipt / Ref No.'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                placeholder="TXN..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 px-3 text-xs font-black text-white placeholder-white/30 focus:outline-hidden focus:ring-1 focus:ring-rose-450 focus:bg-white/10"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-white/50 tracking-wider block">
              {t.paymentMethod}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('bank_transfer')}
                className={`py-2.5 px-3 text-[10px] font-black rounded-xl border-2 text-center transition-all cursor-pointer ${
                  method === 'bank_transfer'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-xs'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {t.bankTransfer}
              </button>
              <button
                type="button"
                onClick={() => setMethod('cash_deposit')}
                className={`py-2.5 px-3 text-[10px] font-black rounded-xl border-2 text-center transition-all cursor-pointer ${
                  method === 'cash_deposit'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-xs'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {t.cashDeposit}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-xs py-3.5 rounded-2xl shadow-md transition-all active:scale-[98%] active-glow flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
          >
            <RefreshCw size={14} className="animate-spin-slow" />
            <span>{t.refillRequestBtn}</span>
          </button>
        </form>
      </div>

      {/* Historic requests list */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-black text-white/70 uppercase tracking-widest flex items-center">
          <Calendar size={14} className="mr-1.5 text-rose-300" />
          {language === 'bn' ? 'রিফিল রিকোয়েস্ট হিস্টোরি' : 'Replenish Requests History'}
        </h4>

        <div className="space-y-2">
          {refills.map((ref) => (
            <div
              key={ref.id}
              className="glass-card glass-card-hover rounded-2xl p-3.5 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  ref.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  <Layers size={14} />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-black text-white truncate max-w-[150px]">{ref.distributor}</span>
                  </div>
                  <span className="text-[9px] text-white/40 font-bold block mt-0.5">ID: {ref.id} • {ref.method}</span>
                  <span className="text-[8px] text-white/30 font-semibold block mt-0.5">Ref: {ref.reference}</span>
                </div>
              </div>

              <div className="flex flex-col items-end text-right">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                  ref.status === 'APPROVED' 
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' 
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                }`}>
                  {ref.status}
                </span>
                <span className="text-xs font-black text-white mt-1">
                  +৳ {getFormatNum(ref.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
