import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  CheckCircle, 
  ChevronRight, 
  AlertCircle, 
  ArrowRight,
  Info,
  Send,
  User,
  ShieldCheck,
  Coins,
  TrendingUp,
  CheckCircle2,
  Share2,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { TransactionType, Language, AgentProfile, Transaction } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { AgentCashFlow } from './AgentCashFlow';

interface ActionSheetsProps {
  activeAction: TransactionType | 'guidelines' | 'support' | null;
  onClose: () => void;
  language: Language;
  profile: AgentProfile;
  onNewTransaction: (type: TransactionType, amount: number, phoneOrAcc: string, operatorOrBiller: string) => void;
  onShowToast?: (message: string, type: 'success' | 'info') => void;
}

export const ActionSheets: React.FC<ActionSheetsProps> = ({
  activeAction,
  onClose,
  language,
  profile,
  onNewTransaction,
  onShowToast,
}) => {
  const t = translations[language];

  // Form states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedBiller, setSelectedBiller] = useState('');
  const [selectedConnType, setSelectedConnType] = useState('prepaid');
  const [billAccount, setBillAccount] = useState('');
  
  // Slide to confirm states
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Status and Flow states
  const [stage, setStage] = useState<'form' | 'confirm' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [newTrxDetails, setNewTrxDetails] = useState<any>(null);

  // Support chatbot states
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    { 
      sender: 'bot', 
      text: language === 'bn' 
        ? 'আসসালামু আলাইকুম! মেঘলা মায়া, হেল্পডেস্কে আপনাকে স্বাগত। আজ আপনাকে কীভাবে সাহায্য করতে পারি?' 
        : 'Assalamu Alaikum! Welcome Meghla Maya to the agent support helpdesk. How can I assist you today?',
      time: 'Just now' 
    }
  ]);
  const [userQuery, setUserQuery] = useState('');

  // Clear fields on action change
  useEffect(() => {
    setPhoneNumber('');
    setAmount('');
    setPin('');
    setSelectedOperator('');
    setSelectedBiller('');
    setSelectedConnType('prepaid');
    setBillAccount('');
    setSliderPosition(0);
    setStage('form');
    setErrorMessage('');
    setNewTrxDetails(null);
  }, [activeAction]);

  if (!activeAction) return null;

  // Validation before proceeding to confirmation
  const handleProceedToConfirm = () => {
    const needsPhone = ['cash_in', 'cash_out', 'recharge'].includes(activeAction);
    if (needsPhone) {
      if (!/^(01)[3-9]\d{8}$/.test(phoneNumber)) {
        setErrorMessage(t.invalidPhone);
        setStage('form');
        return;
      }
    }

    if (activeAction === 'bill_pay') {
      if (!selectedBiller) {
        setErrorMessage(language === 'bn' ? 'দয়া করে বিলার নির্বাচন করুন' : 'Please select a utility biller');
        return;
      }
      if (billAccount.trim().length < 4) {
        setErrorMessage(t.billNo);
        return;
      }
    }

    if (activeAction === 'recharge' && !selectedOperator) {
      setErrorMessage(language === 'bn' ? 'অপারেটর সিলেক্ট করুন' : 'Please select telecom operator');
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setErrorMessage(t.invalidAmount);
      return;
    }

    if (activeAction === 'cash_in' || activeAction === 'recharge' || activeAction === 'bill_pay') {
      if (amtNum > profile.walletBalance) {
        setErrorMessage(t.insufficientBalance);
        return;
      }
    }

    if (activeAction === 'commission_withdraw') {
      if (amtNum > profile.commissionBalance) {
        setErrorMessage(t.insufficientBalance);
        return;
      }
      
      if (profile.hasTakenSuperBalance) {
        const maxAllowed = profile.commissionBalance * 0.30;
        if (amtNum > maxAllowed) {
          setErrorMessage(language === 'bn' 
            ? `দুঃখিত! সুপার এজেন্টের থেকে ফান্ড নেওয়ার দরুন আপনি জমানো কমিশনের সর্বোচ্চ ৩০% (৳${maxAllowed.toFixed(2)}) তুলতে পারবেন। বাকি ৭০% সুপার এজেন্টের কমিশন হিসেবে থাকবে।` 
            : `Denied! Having used Super Agent funds, you are eligible to withdraw a maximum of 30% total commission (৳${maxAllowed.toFixed(2)}).`);
          return;
        }
      }
    }

    setErrorMessage('');
    setStage('confirm');
  };

  const handleFinalSubmit = () => {
    if (pin !== '1234') {
      setErrorMessage(t.invalidPin);
      setStage('confirm');
      setSliderPosition(0);
      return;
    }

    const amtNum = parseFloat(amount);
    const generatedTrxId = 'BN' + Math.random().toString(36).substr(2, 8).toUpperCase();
    
    let dest = phoneNumber;
    let operatorOrBillerName = '';
    
    if (activeAction === 'recharge') {
      operatorOrBillerName = selectedOperator + ` (${selectedConnType === 'prepaid' ? t.prepaid : t.postpaid})`;
    } else if (activeAction === 'bill_pay') {
      dest = billAccount;
      operatorOrBillerName = selectedBiller;
    } else if (activeAction === 'commission_withdraw') {
      dest = 'Wallet ' + profile.agentId;
    } else if (activeAction === 'agent_cash') {
      dest = 'Main Bank';
    }

    onNewTransaction(
      activeAction === 'commission_withdraw' ? 'commission_withdraw' : activeAction as TransactionType,
      amtNum,
      dest,
      operatorOrBillerName
    );

    setNewTrxDetails({
      trxId: generatedTrxId,
      amount: amtNum,
      dest: dest,
      extra: operatorOrBillerName,
      timestamp: new Date()
    });

    setStage('success');
  };

  // Slider controls
  const handleSliderMove = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const width = rect.width - 50;
    const relativeX = clientX - rect.left - 25;
    const percentage = Math.max(0, Math.min(100, (relativeX / width) * 100));
    setSliderPosition(percentage);

    if (percentage >= 99) {
      setIsSliding(false);
      handleFinalSubmit();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsSliding(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsSliding(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSliding) return;
      handleSliderMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSliding) return;
      if (e.touches.length > 0) {
        handleSliderMove(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => {
      if (isSliding) {
        setIsSliding(false);
        if (sliderPosition < 99) setSliderPosition(0);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isSliding, sliderPosition]);

  // Guidelines page
  const renderGuidelines = () => (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pb-8 pr-1">
      <div className="glass-card bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-2xl flex items-start space-x-3 text-xs leading-relaxed">
        <Info className="shrink-0 mt-0.5 text-rose-300" size={16} />
        <p>{t.guideIntro}</p>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 text-white/50 font-black">
              <th className="p-3 uppercase tracking-wider">{t.service}</th>
              <th className="p-3 text-right uppercase tracking-wider">{t.rate}</th>
              <th className="p-3 text-right uppercase tracking-wider">{t.limits}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/80 font-semibold">
            <tr>
              <td className="p-3 font-bold text-white">{t.actionCashIn}</td>
              <td className="p-3 text-right text-emerald-300">০.৩০% (৳৩.০০/হাজার)</td>
              <td className="p-3 text-right text-white/40">৳১০ - ৳২৫,০০০</td>
            </tr>
            <tr>
              <td className="p-3 font-bold text-white">{t.actionCashOut}</td>
              <td className="p-3 text-right text-emerald-300">০.২৫% (৳২.৫০/হাজার)</td>
              <td className="p-3 text-right text-white/40">৳১০ - ৳২৫,০০০</td>
            </tr>
            <tr>
              <td className="p-3 font-bold text-white">{t.actionMobileRecharge}</td>
              <td className="p-3 text-right text-emerald-300">২.৮৫% (৳২৮.৫০/হাজার)</td>
              <td className="p-3 text-right text-white/40">৳১০ - ৳১,০০০</td>
            </tr>
            <tr>
              <td className="p-3 font-bold text-white">{t.actionBillLive}</td>
              <td className="p-3 text-right text-emerald-300">৳১৫.০০ ফিক্সড</td>
              <td className="p-3 text-right text-white/40">৳৫০ - ৳৫০,০০০</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-3xl p-5 space-y-3.5">
        <h4 className="text-xs font-black text-rose-350 uppercase tracking-widest">গুরুত্বপূর্ণ নিয়মাবলি:</h4>
        <ul className="text-xs text-white/60 space-y-2.5 list-disc pl-4 font-semibold">
          <li>{t.rule1}</li>
          <li>{t.rule2}</li>
          <li>{t.rule3}</li>
          <li>{t.rule4}</li>
        </ul>
      </div>
    </div>
  );

  // Chat Support Bot Handler
  const handleSendChat = () => {
    if (!userQuery.trim()) return;
    const userMsg = { sender: 'user' as const, text: userQuery, time: 'Just now' };
    setChatMessages(prev => [...prev, userMsg]);
    setUserQuery('');

    setTimeout(() => {
      let botReply = '';
      const q = userQuery.toLowerCase();
      
      if (q.includes('commission') || q.includes('কমিশন') || q.includes('আয়')) {
        botReply = language === 'bn' 
          ? 'কমিশন রেট চার্ট দেখতে কুইক মেনু থেকে "নির্দেশিকা" বাটনে চাপুন। ক্যাশ-ইন-এ পাবেন হাজারে ৳৩ এবং রিচার্জে অসাধারণ ২.৮৫% কমিশন।'
          : 'To view commission rates, click the "Guidelines" button in Quick Actions. You earn 0.30% for Cash-In and an attractive 2.85% for Mobile Recharges!';
      } else if (q.includes('pin') || q.includes('পিন') || q.includes('লক')) {
        botReply = language === 'bn'
          ? 'নিরাপত্তার স্বার্থে পিন রিসেট করতে অনুগ্রহ করে হেল্পলাইন ১৬২৪৭ নম্বরে সরাসরি ডায়াল করুন অথবা নিকটস্থ ডিস্ট্রিবিউটর সেন্টারে যোগাযোগ করুন।'
          : 'For high security, to reset your Agent PIN, dial helpline 16247 or visit your nearest territory distributor outlet.';
      } else if (q.includes('refill') || q.includes('রিফিল') || q.includes('ব্যালেন্স')) {
        botReply = language === 'bn'
          ? 'ওয়ালেট রিফিল করতে নিচের মেনু থেকে "রিফিল" ট্যাবে যান এবং প্রয়োজনীয় এমাউন্ট ও ডিস্ট্রিবিউটর তথ্য দিয়ে সাবমিট করুন।'
          : 'To refill your agent wallet, navigate to the "Refill" tab at the bottom and submit a digital request directly to your bank distributor.';
      } else {
        botReply = language === 'bn'
          ? 'ধন্যবাদ! মেঘলা মায়া আপু, আপনার এই জিজ্ঞাসাটি আমাদের হেল্পডেস্কে রেজিস্টার করা হয়েছে। কিছুক্ষণের মধ্যে একজন রিপ্রেজেন্টেটিভ আপনার সাথে সরাসরি যোগাযোগ করবেন।'
          : 'Thank you! We have logged your support query successfully. A customer expert representative will reach out shortly.';
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: botReply, time: 'Just now' }]);
    }, 800);
  };

  const renderSupport = () => (
    <div className="flex flex-col h-[70vh] pb-8">
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pr-2 mb-4 scrollbar-none">
        {chatMessages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${
                msg.sender === 'user' ? 'bg-white/10 text-rose-300 border-white/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              }`}>
                {msg.sender === 'user' ? <User size={14} /> : <ShieldCheck size={14} />}
              </div>
              <div className={`p-3.5 rounded-2xl text-xs font-semibold leading-relaxed border ${
                msg.sender === 'user' 
                  ? 'bg-gradient-to-r from-rose-500 to-pink-650 border-rose-500/20 text-white rounded-tr-none' 
                  : 'glass-card bg-white/5 border-white/10 text-white rounded-tl-none'
              }`}>
                <p>{msg.text}</p>
                <span className={`text-[9px] mt-1.5 block opacity-50 ${msg.sender === 'user' ? 'text-white' : 'text-white/60'}`}>
                  {msg.time}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommended tags */}
      <div className="flex flex-wrap gap-1.5 mb-3.5 px-1">
        {['কমিশন রেট কত?', 'পিন লক হলে কী করব?', 'রিফিল কীভাবে করব?'].map((tag, idx) => (
          <button
            key={idx}
            onClick={() => setUserQuery(tag)}
            className="text-[10px] bg-white/5 border border-white/10 text-rose-300 px-3 py-1.5 rounded-full hover:bg-white/10 font-bold active:scale-95 transition-all text-left"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Input box */}
      <div className="flex space-x-2">
        <input
          type="text"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
          placeholder={language === 'bn' ? 'আপনার জিজ্ঞাসা এখানে লিখুন...' : 'Write your messages...'}
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-450 text-white bg-transparent"
        />
        <button
          onClick={handleSendChat}
          className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white p-3 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer active-glow"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );

  const getPlaceholderIconName = () => {
    switch (activeAction) {
      case 'recharge': return 'মোবাইল রিচার্জ';
      case 'bill_pay': return 'ইউটিলিটি বিল লাইভ';
      case 'cash_in': return 'ক্যাশ ইন এজেন্সী';
      case 'cash_out': return 'গ্রাহক ক্যাশ আউট';
      case 'commission_withdraw': return 'কমিশন মূল ওয়ালেটে স্থানান্তর';
      case 'agent_cash': return 'এড মানি / ওয়ালেট লোড';
      default: return 'লেনদেন';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-end justify-center z-50 p-0 sm:p-4">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-safe max-h-[92vh] flex flex-col"
      >
        {/* Sheet grabber */}
        <div className="mx-auto my-2.5 w-12 h-1.5 bg-white/15 rounded-full shrink-0"></div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-white/5 shrink-0">
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {activeAction === 'guidelines' && t.actionGuidelines}
              {activeAction === 'support' && t.actionSupport}
              {activeAction === 'cash_in' && t.actionCashIn}
              {activeAction === 'cash_out' && t.actionCashOut}
              {activeAction === 'recharge' && t.actionMobileRecharge}
              {activeAction === 'bill_pay' && t.actionBillLive}
              {activeAction === 'agent_cash' && t.actionAgentCash}
              {activeAction === 'commission_withdraw' && t.actionCommissionWithdraw}
            </h3>
            <span className="text-[10px] text-white/40 font-extrabold leading-tight">
              {getPlaceholderIconName()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-colors active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dynamic content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {errorMessage && (
            <div className="mb-4 bg-rose-500/15 border border-rose-500/25 text-rose-300 text-xs font-bold px-4 py-3 rounded-2xl flex items-center space-x-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeAction === 'guidelines' && renderGuidelines()}
          {activeAction === 'support' && renderSupport()}

          {activeAction === 'agent_cash' && (
            <AgentCashFlow
              language={language}
              profile={profile}
              onClose={onClose}
              onSuccessToast={(msg) => onShowToast?.(msg, 'success')}
            />
          )}

          {/* Form stage (for transactions/commission) */}
          {activeAction !== 'guidelines' && activeAction !== 'support' && activeAction !== 'agent_cash' && stage === 'form' && (
            <div className="space-y-4">
              
              {/* Cash In / Cash Out / Mobile Recharge fields */}
              {['cash_in', 'cash_out', 'recharge'].includes(activeAction) && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
                    {t.customerNumber}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="e.g. 017XXXXXXXX"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pl-11 text-sm font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 tracking-widest text-white"
                    />
                    <Smartphone className="absolute left-4 top-3.5 text-white/40" size={18} />
                  </div>
                </div>
              )}

              {/* Utility Pay Bill Fields */}
              {activeAction === 'bill_pay' && (
                <div className="space-y-4">
                  {/* Biller grid selection */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-white/50 tracking-wider font-extrabold">
                      {t.billerSelect}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['DESCO (Electricity)', 'WASA (Water)', 'Link3 (Internet)', 'Titas Gas'].map((biller) => (
                        <button
                          key={biller}
                          onClick={() => {
                            setSelectedBiller(biller);
                            setErrorMessage('');
                          }}
                          className={`p-3 text-xs font-semibold rounded-2xl border text-center transition-all cursor-pointer ${
                            selectedBiller === biller
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 shadow-xs font-black'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'
                          }`}
                        >
                          {biller}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-white/50 tracking-wider font-extrabold">
                      {t.billNo}
                    </label>
                    <input
                      type="text"
                      value={billAccount}
                      onChange={(e) => setBillAccount(e.target.value.toUpperCase())}
                      placeholder="e.g. ACCT-109283"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-450 focus:bg-white/10 text-white"
                    />
                  </div>
                </div>
              )}

              {/* Mobile Recharge operator details */}
              {activeAction === 'recharge' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-white/50 tracking-wider font-extrabold">
                      {t.operatorSelect}
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { name: 'GP', color: 'border-blue-500/30 text-blue-300 bg-blue-500/15' },
                        { name: 'Robi', color: 'border-red-500/30 text-red-300 bg-red-500/15' },
                        { name: 'Banglalink', color: 'border-orange-500/30 text-orange-300 bg-orange-500/15' },
                        { name: 'Airtel', color: 'border-pink-500/30 text-pink-300 bg-pink-500/15' },
                        { name: 'Teletalk', color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/15' }
                      ].map((op) => (
                        <button
                          key={op.name}
                          onClick={() => {
                            setSelectedOperator(op.name);
                            setErrorMessage('');
                          }}
                          className={`py-2 px-1 text-[10px] font-black rounded-xl border transition-all cursor-pointer ${
                            selectedOperator === op.name
                              ? `${op.color} scale-105 active-glow border-rose-500/50`
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'
                          }`}
                        >
                          {op.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-white/50 tracking-wider font-extrabold">
                      {t.paymentType}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['prepaid', 'postpaid'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedConnType(type)}
                          className={`py-2.5 px-3 text-xs font-bold rounded-xl border text-center capitalize transition-all cursor-pointer ${
                            selectedConnType === type
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 font-black'
                              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          {type === 'prepaid' ? t.prepaid : t.postpaid}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Amount specification */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black uppercase text-white/50 tracking-wider font-extrabold">
                    {t.amount}
                  </label>
                  <span className="text-[10px] text-white/40 font-extrabold">
                    {activeAction === 'commission_withdraw' 
                      ? `${language === 'bn' ? 'কমিশন: ' : 'Comms: '} ৳${profile.commissionBalance}` 
                      : `${language === 'bn' ? 'ব্যালেন্স: ' : 'Balance: '} ৳${profile.walletBalance}`}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="৳ ০.০০"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pl-11 text-base font-black focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 text-white placeholder-white/30"
                  />
                  <div className="absolute left-4 top-3.5 text-rose-300 font-extrabold text-sm">৳</div>
                </div>

                {/* Amount presets quick grid */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[20, 100, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(String(preset));
                        setErrorMessage('');
                      }}
                      className="py-2 px-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-white/80 rounded-xl border border-white/10 transition-colors active:scale-95 cursor-pointer"
                    >
                      +৳{preset}
                    </button>
                  ))}
                </div>

                {activeAction === 'commission_withdraw' && profile.hasTakenSuperBalance && (
                  <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 text-amber-300 rounded-xl leading-relaxed text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-orange-450 mb-1">
                      <AlertCircle size={13} />
                      <span>৩০% সর্বোচ্চ প্রত্যাহার নীতি</span>
                    </div>
                    <p>
                      {language === 'bn' 
                        ? `আপনি সুপার এজেন্টের থেকে ব্যালেন্স নিয়েছেন। নীতি অনুযায়ী মোট কমিশনের সর্বোচ্চ ৩০% (৳${(profile.commissionBalance * 0.3).toFixed(2)}) পর্যন্ত তুলতে পারবেন। বাকি ৭০% সুপার এজেন্ট কমিশন পাবেন।` 
                        : `Having accepted Super Agent balance, your maximum withdrawable commission is 30% of total (৳${(profile.commissionBalance * 0.3).toFixed(2)}). Returning 70% to Super Agent.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Trigger in form */}
              <button
                onClick={handleProceedToConfirm}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-sm py-3.5 rounded-2xl shadow-md transition-all active:scale-[98%] active-glow flex items-center justify-center space-x-1 cursor-pointer mt-4"
              >
                <span>{t.submit}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Confirmation stage with Slide to Confirm */}
          {stage === 'confirm' && (
            <div className="space-y-5">
              <div className="glass-card rounded-3xl p-5 border border-white/15 space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40 font-bold">{language === 'bn' ? 'লেনদেনের ধরন' : 'Tx Type'}</span>
                  <span className="font-black text-white uppercase">{activeAction.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40 font-bold">
                    {activeAction === 'bill_pay' ? t.billNo : t.customerNumber}
                  </span>
                  <span className="font-black text-white tracking-wider">
                    {activeAction === 'bill_pay' ? billAccount : phoneNumber || 'N/A'}
                  </span>
                </div>
                {selectedOperator && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40 font-bold">{language === 'bn' ? 'অপারেটর' : 'Operator'}</span>
                    <span className="font-black text-white">{selectedOperator}</span>
                  </div>
                )}
                {selectedBiller && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40 font-bold">{language === 'bn' ? 'বিল প্রদানকারী' : 'Biller'}</span>
                    <span className="font-black text-white">{selectedBiller}</span>
                  </div>
                )}
                <div className="border-t border-white/5 my-2 pt-2 flex justify-between items-center">
                  <span className="text-xs text-white/40 font-bold">{t.amount}</span>
                  <span className="text-lg font-black text-rose-300">৳ {parseFloat(amount).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Secure PIN validation */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
                  {t.agentPin}
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234 (Demo)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-center text-lg font-black focus:outline-hidden focus:ring-1 focus:ring-rose-450 tracking-widest text-white placeholder-white/20 uppercase"
                />
              </div>

              {/* Slide to Confirm widget */}
              <div className="space-y-4 mt-4">
                <div 
                  ref={sliderRef}
                  id="slide-to-confirm-container"
                  className="w-full bg-white/5 rounded-2xl h-14 relative overflow-hidden select-none flex items-center border border-white/10"
                >
                  {/* Slider Progress Fill */}
                  <div 
                    className="absolute bg-gradient-to-r from-rose-500 to-pink-600 h-full rounded-2xl opacity-90 transition-all"
                    style={{ width: `${sliderPosition + 5}%` }}
                  ></div>

                  {/* Centered Guide Text */}
                  <span className="absolute w-full text-center text-[11px] font-black pointer-events-none uppercase tracking-wider text-rose-250 mix-blend-difference">
                    {t.slideConfirm}
                  </span>

                  {/* Handle */}
                  <div 
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    className="absolute w-12 h-12 bg-slate-900 border border-white/10 rounded-xl shadow-md cursor-grab flex items-center justify-center text-rose-300 active:cursor-grabbing transition-transform duration-75 select-none"
                    style={{ left: `calc(${sliderPosition}% - ${sliderPosition * 0.48}px)` }}
                  >
                    <ArrowRight className="animate-pulse" size={18} />
                  </div>
                </div>

                <button
                  onClick={() => setStage('form')}
                  className="w-full text-center py-2 text-xs font-bold text-white/40 hover:text-white/80 transition-colors uppercase tracking-widest cursor-pointer"
                >
                  {t.backBtn}
                </button>
              </div>
            </div>
          )}

          {/* Success receipt stage */}
          {stage === 'success' && newTrxDetails && (() => {
            const computedComm = activeAction === 'recharge' 
              ? newTrxDetails.amount * 0.0285 
              : activeAction === 'cash_in' 
                ? newTrxDetails.amount * 0.003 
                : activeAction === 'cash_out' 
                  ? newTrxDetails.amount * 0.0025 
                  : activeAction === 'bill_pay' 
                    ? 15 
                    : 0;

            const handleDownloadReceipt = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 760;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // 1. Draw solid background
                const grad = ctx.createLinearGradient(0, 0, 0, 760);
                grad.addColorStop(0, '#0f172a'); // slate-900
                grad.addColorStop(1, '#020617'); // slate-950
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 600, 760);

                // Border frame
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                ctx.strokeRect(20, 20, 560, 720);

                // Checkmark Circle Glow
                const isCashIn = activeAction === 'cash_in';
                const accentColor = isCashIn ? '#10b981' : '#f43f5e';
                
                ctx.shadowColor = accentColor;
                ctx.shadowBlur = 15;
                ctx.fillStyle = accentColor;
                ctx.beginPath();
                ctx.arc(300, 100, 32, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0; // reset

                // Draw White Checkmark
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(289, 100);
                ctx.lineTo(297, 108);
                ctx.lineTo(312, 91);
                ctx.stroke();

                // App Header
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('BD WALLET AGENT', 300, 175);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
                ctx.fillText('OFFICIAL DIGITAL MONEY TRANSACTION RECEIPT', 300, 195);

                // Dotted line
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(40, 220);
                ctx.lineTo(560, 220);
                ctx.stroke();
                ctx.setLineDash([]); // clear

                // Big Amount
                ctx.fillStyle = '#ffffff';
                ctx.font = '800 44px system-ui, -apple-system, sans-serif';
                ctx.fillText('৳ ' + newTrxDetails.amount.toLocaleString(), 300, 280);

                const modeLabel = activeAction === 'cash_in' 
                  ? (language === 'bn' ? 'ক্যাশ ইন সফল' : 'CASH IN SUCCESSFUL')
                  : (activeAction === 'cash_out' 
                    ? (language === 'bn' ? 'ক্যাশ আউট সফল' : 'CASH OUT SUCCESSFUL')
                    : (language === 'bn' ? 'লেনদেন সফল' : 'TRANSACTION SUCCESSFUL'));

                ctx.fillStyle = accentColor;
                ctx.font = '900 12px system-ui, -apple-system, sans-serif';
                ctx.fillText(modeLabel.toUpperCase(), 300, 310);

                // Reset for list
                ctx.textAlign = 'left';
                ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';

                const drawPair = (l: string, v: string, y: number) => {
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                  ctx.fillText(l, 60, y);
                  ctx.fillStyle = '#ffffff';
                  ctx.textAlign = 'right';
                  ctx.fillText(v, 540, y);
                  ctx.textAlign = 'left';
                };

                let curY = 360;
                const gapY = 34;

                drawPair(language === 'bn' ? 'গ্রাহক মোবাইল' : 'Recipient Account', newTrxDetails.dest, curY);
                
                if (newTrxDetails.extra) {
                  curY += gapY;
                  drawPair(language === 'bn' ? 'অপারেটর/বিলার' : 'Details', newTrxDetails.extra, curY);
                }

                curY += gapY;
                drawPair(language === 'bn' ? 'কমিশন লাভ' : 'Commission Earned', '+৳ ' + computedComm.toLocaleString([], { minimumFractionDigits: 2, maximumFractionDigits: 2 }), curY);

                curY += gapY;
                const timeStr = new Date(newTrxDetails.timestamp).toLocaleString();
                drawPair(language === 'bn' ? 'তারিখ ও সময়' : 'Date & Time', timeStr, curY);

                curY += gapY;
                drawPair(language === 'bn' ? 'এজেন্ট আইডি' : 'Agent Merchant ID', profile.agentId, curY);

                curY += gapY;
                drawPair(language === 'bn' ? 'ট্রানজেকশন আইডি' : 'Transaction ID', newTrxDetails.trxId, curY);

                // Divider
                curY += 30;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.moveTo(60, curY);
                ctx.lineTo(540, curY);
                ctx.stroke();

                // Barcode simulation lines
                curY += 20;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                const barX = 140;
                for (let i = 0; i < 64; i++) {
                  const chCode = newTrxDetails.trxId.charCodeAt(i % newTrxDetails.trxId.length);
                  const isThicker = (chCode + i) % 3 === 0;
                  const isGap = (chCode * i) % 5 === 0;
                  if (!isGap) {
                    ctx.fillRect(barX + (i * 5), curY, isThicker ? 3 : 1, 35);
                  }
                }

                curY += 50;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`* ${newTrxDetails.trxId} *`, 300, curY);

                curY += 24;
                ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
                ctx.fillText('POWERED BY BD WALLET COOPERATIVE PARTNER NETWORK', 300, curY);

                // Export to PNG & download
                canvas.toBlob((blob) => {
                  if (!blob) return;
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `BDWallet_Partner_Receipt_${newTrxDetails.trxId}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                  if (onShowToast) {
                    onShowToast(language === 'bn' ? 'মেমো রসিদটি সফলভাবে ডাউনলোড হয়েছে!' : 'Transaction receipt image downloaded!', 'success');
                  }
                }, 'image/png');

              } catch (err) {
                console.error("Canvas export failed:", err);
              }
            };

            const handleTextShare = () => {
              try {
                const textDetail = `=== BD WALLET AGENT RECEIPT ===\n` +
                  `Type: ${activeAction === 'cash_in' ? 'Cash In' : 'Cash Out'}\n` +
                  `Amount: ৳${newTrxDetails.amount.toLocaleString()}\n` +
                  `Recipient: ${newTrxDetails.dest}\n` +
                  `Commission: +৳${computedComm.toFixed(2)}\n` +
                  `Date: ${new Date(newTrxDetails.timestamp).toLocaleString()}\n` +
                  `Trx ID: ${newTrxDetails.trxId}\n` +
                  `==============================`;
                
                navigator.clipboard.writeText(textDetail);
                if (onShowToast) {
                  onShowToast(language === 'bn' ? 'মেমো বিবরণী ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Receipt details copied to clipboard!', 'success');
                }
              } catch (err) {
                console.error("Copy text failed:", err);
              }
            };

            return (
              <div className="space-y-5 text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 rounded-full mb-2">
                  <CheckCircle size={36} className="fill-emerald-400 text-slate-900 animate-bounce" />
                </div>

                <div>
                  <h4 className="text-lg font-black text-white">{t.success}</h4>
                  <p className="text-xs text-white/40 mt-0.5">
                    {new Date(newTrxDetails.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(newTrxDetails.timestamp).toLocaleDateString()}
                  </p>
                </div>

                {/* THE CLEAN SUMMARY VIEW RECEIPT */}
                <div className="relative border border-white/10 rounded-3xl bg-slate-950/45 p-6 overflow-hidden space-y-4 shadow-xl select-none">
                  {/* Watermark Logo */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
                    <div className="font-black text-6xl rotate-12 tracking-widest text-white">BDWAL</div>
                  </div>

                  {/* Scissor / Cut effect dashed helper */}
                  <div className="text-[10px] uppercase font-black tracking-widest text-slate-500/50 flex items-center justify-between gap-2">
                    <span className="border-t border-dashed border-slate-700/60 grow h-0"></span>
                    <span>{language === 'bn' ? 'ডিজিটাল লেনদেন রসিদ' : 'Transaction Voucher'}</span>
                    <span className="border-t border-dashed border-slate-700/60 grow h-0"></span>
                  </div>

                  {/* Inner details fields */}
                  <div className="space-y-2.5 text-left text-xs font-semibold">
                    <div className="flex justify-between items-center text-white/70">
                      <span>{t.recipient}</span>
                      <span className="font-extrabold text-white tracking-wide">{newTrxDetails.dest}</span>
                    </div>

                    {newTrxDetails.extra && (
                      <div className="flex justify-between items-center text-white/70">
                        <span>{language === 'bn' ? 'অপারেটর/বিলার' : 'Details'}</span>
                        <span className="font-extrabold text-white">{newTrxDetails.extra}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-white/5 pt-2 text-white/70">
                      <span>{t.amount}</span>
                      <span className="font-black text-white text-sm">৳ {newTrxDetails.amount.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center text-emerald-400 uppercase text-[10px]">
                      <span>{t.commission}</span>
                      <span className="font-extrabold">+৳ {computedComm.toLocaleString([], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-between items-center border-t border-dashed border-white/10 pt-2 text-white/40 text-[10px]">
                      <span>{t.transactionId}</span>
                      <span className="font-extrabold text-rose-300 tracking-widest uppercase font-mono">{newTrxDetails.trxId}</span>
                    </div>
                  </div>

                  {/* Dynamic simulated barcode right inside the UI! */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5 flex flex-col items-center">
                    <div className="flex gap-[1.5px] h-8 items-stretch opacity-60">
                      {Array.from({ length: 48 }).map((_, i) => {
                        const randomThick = (i % 3 === 0) || (i % 7 === 0);
                        const isSpacingIdx = (i % 5 === 0 && i % 4 === 0);
                        if (isSpacingIdx) return <div key={i} className="w-[2px]" />;
                        return (
                          <div 
                            key={i} 
                            style={{ width: randomThick ? '2.5px' : '1px' }} 
                            className="bg-white" 
                          />
                        );
                      })}
                    </div>
                    <span className="text-[8px] tracking-widest text-white/30 font-bold font-mono">*{newTrxDetails.trxId}*</span>
                  </div>
                </div>

                {/* RECEIPTS ACTION BUTTONS PANEL */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleDownloadReceipt}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-755 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wide cursor-pointer transition-colors active:scale-98"
                  >
                    <Download size={13} className="text-rose-350" />
                    <span>{language === 'bn' ? 'রসিদ ডাউনলোড' : 'Save Image'}</span>
                  </button>

                  <button
                    onClick={handleTextShare}
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-755 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wide cursor-pointer transition-colors active:scale-98"
                  >
                    <Share2 size={13} className="text-pink-400" />
                    <span>{language === 'bn' ? 'মেমো কপি করুন' : 'Copy Text'}</span>
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-650 text-white font-black text-xs py-3.5 rounded-2xl shadow-md transition-all active:scale-[98%] uppercase tracking-wider cursor-pointer active-glow"
                >
                  {t.backBtn}
                </button>
              </div>
            );
          })()}

        </div>
      </motion.div>
    </div>
  );
};
