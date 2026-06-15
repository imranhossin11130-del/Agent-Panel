import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ArrowRight, 
  Copy, 
  Check, 
  Send, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Image as ImageIcon,
  ChevronLeft,
  Coins,
  ShieldCheck
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, query, where, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { Language, AgentProfile } from '../types';

interface AgentCashFlowProps {
  language: Language;
  profile: AgentProfile;
  onClose: () => void;
  onSuccessToast: (message: string) => void;
}

export const AgentCashFlow: React.FC<AgentCashFlowProps> = ({
  language,
  profile,
  onClose,
  onSuccessToast,
}) => {
  const isBn = language === 'bn';

  // Sub-option: null | 'own' | 'super'
  const [cashType, setCashType] = useState<'own' | 'super' | null>(null);
  
  // Step tracker: 'form' | 'instructions' | 'verification' | 'approving' | 'share'
  const [step, setStep] = useState<'form' | 'instructions' | 'verification' | 'approving' | 'share'>('form');

  // Input states
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [senderPhone, setSenderPhone] = useState('');
  const [amount, setAmount] = useState('');
  
  // New verification inputs for Super Agent
  const [verifyGmail, setVerifyGmail] = useState('');
  const [verifyAgentId, setVerifyAgentId] = useState('');

  // Auto-approving states
  const [countdown, setCountdown] = useState(60);
  const [autoApproveStatus, setAutoApproveStatus] = useState<'counting' | 'saving' | 'success' | 'failed'>('counting');
  const [createdDocId, setCreatedDocId] = useState('');

  // Step 2 (Own balance verification) states
  const [trxId, setTrxId] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  
  // Limits check for Super Agent requests
  const [reqCountToday, setReqCountToday] = useState(0);
  const [reqSumToday, setReqSumToday] = useState(0);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Load super request daily counters and verify limits on mount/mode select
  useEffect(() => {
    const fetchDailyStats = async () => {
      if (!auth.currentUser) return;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const q = query(
          collection(db, 'deposit_requests'),
          where('agentUid', '==', auth.currentUser.uid),
          where('type', '==', 'super')
        );
        
        const querySnap = await getDocs(q);
        let count = 0;
        let sum = 0;
        
        querySnap.forEach((doc) => {
          const data = doc.data();
          if (data.createdAt) {
            const date = new Date(data.createdAt);
            if (date >= today) {
              count += 1;
              sum += Number(data.amount || 0);
            }
          }
        });
        
        setReqCountToday(count);
        setReqSumToday(sum);
      } catch (err) {
        console.error("Error loading daily limits stats:", err);
      }
    };
    
    fetchDailyStats();
  }, [cashType]);

  // Handle Drag & Drop / Click Event to parse screenshot
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage(isBn ? 'চিত্র ফাইলটি বা স্ক্রিনশটটি ২ মেগাবাইট বা তার কম হওয়া উচিত।' : 'Screenshot file size should be 2MB or less.');
        return;
      }
      setScreenshotName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotBase64(reader.result as string);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setErrorMessage(isBn ? 'দয়া করে সঠিক অফারকৃত এমাউন্ট বা টাকার পরিমাণ দিন।' : 'Please enter a valid amount.');
      return;
    }

    if (cashType === 'super') {
      // Super agent limits check (max 3 per day, or total 20,000 BDT)
      if (reqCountToday >= 3) {
        setErrorMessage(isBn 
          ? 'দুঃখিত! আপনি প্রতিদিন সর্বোচ্চ ৩ বার অনূর্ধ্ব আবেদন সীমা অতিক্রম করেছেন।' 
          : 'Sorry! You have exceeded the daily limit of 3 requests.');
        return;
      }
      if (reqSumToday + amtNum > 20000) {
        setErrorMessage(isBn 
          ? `দুঃখিত! আপনার প্রতিদিন সর্বোচ্চ ২০,০০০ টাকা নেওয়ার সীমা আছে। আজকে আর সর্বোচ্চ ৳${(20000 - reqSumToday).toLocaleString()} অনুরোধ করতে পারবেন।` 
          : `Sorry! Daily request sum limit is 20,000 BDT. You can request up to ৳${(20000 - reqSumToday).toLocaleString()} more today.`);
        return;
      }

      if (!/^01[3-9]\d{8}$/.test(senderPhone)) {
        setErrorMessage(isBn ? 'দয়া করে সঠিক মোবাইল নাম্বার প্রদান করুন।' : 'Please enter a valid phone number (e.g. 017XXXXXXXX).');
        return;
      }

      // If Super Mode, we proceed to security verification stage
      setStep('verification');
    } else {
      // If Own Mode, proceed to step 2 Instructions page
      if (!/^01[3-9]\d{8}$/.test(senderPhone)) {
        setErrorMessage(isBn ? 'দয়া করে সঠিক সোর্স মোবাইল নাম্বার প্রদান করুন।' : 'Please enter a valid source phone number (e.g. 017XXXXXXXX).');
        return;
      }
      setStep('instructions');
    }
  };

  // Final confirmation logic for own balance loading
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!trxId.trim()) {
      setErrorMessage(isBn ? 'দয়া করে সঠিক ট্রাঞ্জেকশন আইডি (Transaction ID) প্রদান করুন।' : 'Please enter the transaction ID.');
      return;
    }

    if (!screenshotBase64) {
      setErrorMessage(isBn ? 'পেমেন্ট ভেরিফিকেশনের জন্য লেনদেন স্ক্রিনশট সাবমিট করা বাধ্যতামূলক।' : 'Submitting a transaction screenshot is required for validation.');
      return;
    }

    await handleCreateDepositRequest();
  };

  // DB Firestore generation function
  const handleCreateDepositRequest = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("User unauthorized");
      }

      const requestsColl = collection(db, 'deposit_requests');
      const docRef = doc(requestsColl); // Auto-generated ID
      
      const payload = {
        id: docRef.id,
        agentUid: currentUser.uid,
        agentName: profile.name,
        agentPhone: profile.phone,
        type: cashType as 'own' | 'super',
        senderPhone: senderPhone.trim(),
        amount: Number(amount),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        paymentMethod: cashType === 'own' ? paymentMethod : 'super_agent',
        trxId: cashType === 'own' ? trxId.trim().toUpperCase() : '',
        screenshotUrl: cashType === 'own' ? screenshotBase64 : '',
        updatedAt: new Date().toISOString()
      };

      // Write to Firestore securely
      await setDoc(docRef, payload);

      // Generate share link
      const hostOrigin = window.location.origin;
      const targetLink = `${hostOrigin}/?requestId=${docRef.id}`;
      setGeneratedLink(targetLink);
      setCreatedDocId(docRef.id);

      // Move forward to appropriate step
      if (cashType === 'super') {
        setCountdown(60);
        setAutoApproveStatus('counting');
        setStep('approving');
        onSuccessToast(isBn ? 'ডিপোজিট অনুরোধটি গেটওয়েতে সাবমিট করা হয়েছে!' : 'Deposit request submitted to secure gateway!');
      } else {
        setStep('share');
        onSuccessToast(isBn ? 'ডিপোজিট রিকোয়েস্ট লিংক তৈরী সম্পন্ন হয়েছে!' : 'Deposit request generated successfully!');
      }
    } catch (err: any) {
      console.error(err);
      const technicalMsg = err?.message || err?.code || String(err);
      setErrorMessage(isBn 
        ? `সার্ভারে রিকোয়েস্ট সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন। (${technicalMsg})` 
        : `Failed to submit request to server. Please try again. (${technicalMsg})`);
    } finally {
      setIsLoading(false);
    }
  };

  // Automated approval execution in Firestore
  const handleAutoApproveFirestore = async () => {
    setAutoApproveStatus('saving');
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Unauthorized");
      if (!createdDocId) throw new Error("Request ID is missing");

      // 1. Update the request document status to success
      const reqRef = doc(db, 'deposit_requests', createdDocId);
      await updateDoc(reqRef, {
        status: 'success',
        updatedAt: new Date().toISOString()
      });

      // 2. Read Agent Document to load current balances
      const agentRef = doc(db, 'agents', currentUser.uid);
      const agentSnap = await getDoc(agentRef);
      if (agentSnap.exists()) {
        const agentData = agentSnap.data();
        const currentWallet = Number(agentData.walletBalance || 0);
        const addedAmount = Number(amount);

        const updatedPayload: any = {
          walletBalance: currentWallet + addedAmount,
          hasTakenSuperBalance: true,
          superBalanceTotal: Number(agentData.superBalanceTotal || 0) + addedAmount
        };

        await updateDoc(agentRef, updatedPayload);

        // 3. Inject a successful transaction into agent logs in Firestore
        const generatedId = 'REF' + Math.floor(1000 + Math.random() * 9000);
        await setDoc(doc(db, 'agents', currentUser.uid, 'transactions', generatedId), {
          id: generatedId,
          type: 'refill',
          phoneOrAccount: 'Super Agent (01717-508278)',
          amount: addedAmount,
          commission: 0,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          operatorOrBiller: 'Super Agent Balance (30%)'
        });
      }

      setAutoApproveStatus('success');
      onSuccessToast(isBn ? 'সুপার এজেন্ট ব্যালেন্স স্বয়ংক্রিয়ভাবে অনুমোদিত হয়েছে!' : 'Super agent balance has been automatically approved!');
    } catch (err: any) {
      console.error("Auto approval database update failed:", err);
      setAutoApproveStatus('failed');
    }
  };

  // Timer tick effect for automated gateway
  useEffect(() => {
    if (step !== 'approving') return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoApproveFirestore();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, createdDocId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onSuccessToast(isBn ? 'লিংকটি ক্লিপবোর্ডে কপি করা হয়েছে!' : 'Link copied to clipboard!');
  };

  return (
    <div className="space-y-4">
      {/* 1. Main Action Option Selection Toggles */}
      {!cashType ? (
        <div className="space-y-4 text-center py-2 animate-fade-in select-none">
          <p className="text-xs text-white/50 leading-relaxed font-semibold max-w-[280px] mx-auto">
            {isBn 
              ? 'এজেন্ট ক্যাশ ওয়ালেটে ব্যালেন্স লোড করতে নিচের যেকোন একটি অপশন বেছে নিন:' 
              : 'Choose one of the methods below to add funds into your primary agent wallet:'}
          </p>

          <div className="grid grid-cols-1 gap-3.5 mt-2.5">
            {/* Own balance adding option */}
            <button
              onClick={() => {
                setCashType('own');
                setStep('form');
              }}
              className="glass-card p-5 border border-white/10 rounded-2xl hover:bg-white/10 active:scale-98 transition-all hover:border-rose-500/30 text-left group cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1 pr-4">
                <h4 className="text-xs font-black text-rose-300 tracking-wider uppercase group-hover:text-rose-200 transition-colors">
                  {isBn ? 'নিজের ব্যালেন্স যুক্ত করুন' : 'Add Own Wallet Balance'}
                </h4>
                <p className="text-[10px] text-white/45 font-medium leading-relaxed">
                  {isBn 
                    ? 'বিকাশ বা নগদ থেকে নিজে পেমেন্ট করে কোনো চার্জ বা ফি ছাড়াই সম্পূর্ণ কমিশন ওয়ালেটে লোড করুন।' 
                    : 'Add money directly via bKash/Nagad and enjoy 100% of your earned commission withdraws.'}
                </p>
              </div>
              <div className="p-2.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl group-hover:scale-110 transition-transform">
                <Plus size={18} />
              </div>
            </button>

            {/* Request from super agent option */}
            <button
              onClick={() => {
                setCashType('super');
                setStep('form');
              }}
              className="glass-card p-5 border border-white/10 rounded-2xl hover:bg-white/10 active:scale-98 transition-all hover:border-indigo-500/30 text-left group cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1 pr-4">
                <h4 className="text-xs font-black text-indigo-300 tracking-wider uppercase group-hover:text-indigo-200 transition-colors">
                  {isBn ? 'সুপার এজেন্টের কাছে অনুরোধ পাঠান' : 'Send Request to Super Agent'}
                </h4>
                <p className="text-[10px] text-white/45 font-medium leading-relaxed">
                  {isBn 
                    ? 'উপার্জিত কমিশনের ৩০% উত্তলন করতে পারবেন ও বাকি ৭০% সুপার এজেন্ট কমিশন হিসেবে গণ্য হবে।' 
                    : 'Withdraw only 30% of total commission. Remaining 70% goes to the super agent.'}
                </p>
              </div>
              <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl group-hover:scale-110 transition-transform">
                <ArrowRight size={18} />
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Subheader context with back button */}
          <div className="flex items-center space-x-2 shrink-0 pb-1.5 border-b border-white/5">
            <button
              onClick={() => {
                if (step === 'instructions') {
                  setStep('form');
                } else {
                  setCashType(null);
                  setStep('form');
                  setErrorMessage(null);
                }
              }}
              className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors text-[10px] uppercase font-black tracking-widest flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={12} />
              <span>{isBn ? 'পেছনে' : 'Back'}</span>
            </button>
            <span className="text-[10px] font-black tracking-widest text-[#f52b66] bg-[#f52b66]/10 px-2.5 py-1 rounded-full uppercase border border-[#f52b66]/15">
              {cashType === 'own' 
                ? (isBn ? 'নিজের ব্যালেন্স' : 'OWN BALANCE') 
                : (isBn ? 'সুপার এজেন্ট' : 'SUPER AGENT MODE')}
            </span>
          </div>

          {/* Render error banner if any */}
          {errorMessage && (
            <div className="bg-red-500/20 border border-red-500/30 text-rose-200 text-[11px] font-bold p-3.5 rounded-2xl flex items-start space-x-2 animate-bounce-in leading-relaxed">
              <AlertTriangle size={15} className="shrink-0 text-rose-300 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1 FORM VIEW */}
          {step === 'form' && (
            <form onSubmit={handleStep1Submit} className="space-y-4 font-semibold text-xs">
              
              {/* Warnings / Policy disclaimer */}
              {cashType === 'super' ? (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 text-amber-300 rounded-2xl space-y-1.5 leading-relaxed text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-orange-450">
                    <AlertTriangle size={14} />
                    <span>কমিশন ও লিমিট পলিসি সতর্কবার্তা</span>
                  </div>
                  <p>
                    {isBn 
                      ? '১. সুপার এজেন্টের থেকে ব্যালেন্স পেমেন্ট নিলে মাত্র ৩০% কমিশন আপনি উত্তোলন করতে পারবেন। বাকি ৭০% সুপার এজেন্ট পাবেন।' 
                      : '1. Taking balance from Super Agent limits your commission withdrawals to 30%. Remaining 70% will go to super agent.'}
                  </p>
                  <p>
                    {isBn 
                      ? '২. প্রতিদিন সর্বোচ্চ ৩টি অনুরোধ ও সর্বোচ্চ মোট ২০,০০০ টাকা আবেদন করতে পারবেন।' 
                      : '2. Daily maximum of 3 requests with a cap of 20,000 BDT total request limit.'}
                  </p>
                  <div className="pt-1.5 border-t border-white/5 flex justify-between text-[10px] text-white/50 font-black tracking-wide font-mono">
                    <span>আজকের অনুরোধ: {reqCountToday} / ৩</span>
                    <span>মোট পরিমাণ: ৳{reqSumToday} / ২০,০০০</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 rounded-2xl flex items-start space-x-2.5 text-[11px] leading-relaxed">
                  <CheckCircle size={15} className="shrink-0 mt-0.5 text-emerald-300" />
                  <p>
                    {isBn 
                      ? 'নিজের পেমেন্ট ব্যালেন্স ব্যবহার করে ডিপোজিট করলে কষ্টার্জিত উপার্জিত কমিশনের প্রতিটি টাকার ১০০% যেকোনো সময়ে ফ্রিতে মূল ওয়ালেটে স্থানান্তরিত করতে পারবেন।' 
                      : 'Using own payment deposits allows you to withdraw 100% of your total commissions without extra charges anytime.'}
                  </p>
                </div>
              )}

              {/* Payment Method Selector (Only for Own Mode) */}
              {cashType === 'own' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-white/45 tracking-widest font-extrabold block">
                    {isBn ? 'পেমেন্ট মেথড সিলেক্ট করুন' : 'Choose payment gateway'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bkash')}
                      className={`p-3.5 rounded-2xl border text-xs font-black select-none text-center transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                        paymentMethod === 'bkash'
                          ? 'bg-[#E3106E]/20 border-[#E3106E]/30 text-[#E3106E] scale-105 active-glow font-black'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E3106E] shrink-0"></span>
                      <span>{isBn ? 'বিকাশ' : 'bKash'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('nagad')}
                      className={`p-3.5 rounded-2xl border text-xs font-black select-none text-center transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                        paymentMethod === 'nagad'
                          ? 'bg-[#f45322]/20 border-[#f45322]/30 text-[#f45322] scale-105 active-glow font-black'
                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f45322] shrink-0"></span>
                      <span>{isBn ? 'নগদ' : 'Nagad'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sender Phone Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-white/45 tracking-widest block font-extrabold">
                  {cashType === 'own' 
                    ? (isBn ? 'যে নাম্বার থেকে টাকা পাঠাতে চান (আপনার মোবাইল নং)' : 'The number from which you send money') 
                    : (isBn ? 'আপনার মোবাইল নাম্বার' : 'Your Agency Mobile number')}
                </label>
                <input
                  type="tel"
                  required
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="e.g. 01717XXXXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 tracking-widest text-white text-xs"
                />
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-white/45 tracking-widest block font-extrabold">
                  {isBn ? 'টাকার পরিমাণ' : 'Amount of Money'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="৳ ০.০০"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pl-10 text-sm font-black focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 text-white"
                  />
                  <div className="absolute left-4 top-3 text-rose-350 font-black text-xs">৳</div>
                </div>
              </div>

              {/* Submit Proceed btn */}
              <button
                type="submit"
                className="w-full py-4 mt-2 font-black uppercase text-xs tracking-wider text-white bg-gradient-to-r from-rose-500 to-pink-650 rounded-2xl items-center justify-center flex gap-1 cursor-pointer active-glow hover:opacity-90 active:scale-98 transition-all"
              >
                <span>{isBn ? 'পরবর্তী বাটনে চাপুন' : 'Click Next Button'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          {/* STEP 2 OWN MODE INSTRUCTIONS & VERIFICATION SCREEN */}
          {step === 'instructions' && (
            <form onSubmit={handleStep2Submit} className="space-y-4 font-semibold text-xs">
              
              {/* Payment Info Card showing super agent digits */}
              <div className="glass-card rounded-2xl p-4 border border-white/15 space-y-3.5 relative overflow-hidden">
                <div className="absolute top-[-10px] right-[-10px] w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none"></div>
                
                <h4 className="text-[11px] uppercase tracking-wider text-rose-300 font-black flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <ShieldCheck size={14} />
                  <span>সুপার এজেন্ট ওয়ালেট পেমেন্ট অ্যাড্রেস</span>
                </h4>

                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-white/45 text-[10px]">{isBn ? 'সুপার এজেন্ট ক্যালিবার নাম্বার' : 'Super Agent Phone Number'}</span>
                    <p className="font-extrabold text-[13px] text-white tracking-widest font-mono select-all">01717-508278</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("01717-508278");
                      onSuccessToast(isBn ? 'নাম্বার কপি করা হয়েছে!' : 'Number copied!');
                    }}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 border border-white/10 hover:text-white transition-colors cursor-pointer active:scale-90"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 leading-relaxed text-[10.5px] text-white/60 space-y-1 select-none">
                  <span className="text-rose-455 font-bold uppercase tracking-wider block text-[9.5px]">{isBn ? 'টাকা পাঠানোর নির্দেশনা:' : 'Instructions:'}</span>
                  <p>{isBn ? `১. আপনার সিলেক্ট করা মেথড ${paymentMethod.toUpperCase()} অ্যাকাউন্ট থেকে উপরের সুপার এজেন্টের নাম্বারে ৳${Number(amount).toLocaleString()} টাকা "সেন্ড মানি/ক্যাশ আউট" করুন।` : `1. Send exactly ৳${Number(amount).toLocaleString()} from your ${paymentMethod.toUpperCase()} wallet to standard number above.`}</p>
                  <p>{isBn ? '২. টাকা পাঠানো সম্পন্ন হয়ে গেলে সঠিক ট্রাঞ্জেকশন আইডি (Transaction ID) এবং পেমেন্ট রশিদ বা স্ক্রিনশটটি নিচে জমা দিন।' : '2. Provide correct Transaction ID and upload your transaction receipt/screenshot below.'}</p>
                </div>
              </div>

              {/* Transaction ID input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-white/45 tracking-widest block font-extrabold">
                  {isBn ? 'সঠিক ট্রাঞ্জেকশন আইডি (Transaction ID)' : 'Correct Transaction ID'}
                </label>
                <input
                  type="text"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="e.g. 8K82U7Y9X1"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-extrabold uppercase font-mono tracking-widest focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 text-white text-xs placeholder-white/25"
                />
              </div>

              {/* Transaction Screenshot Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-white/45 tracking-widest block font-extrabold">
                  {isBn ? 'বিকাশ বা নগদ লেনদেন স্ক্রিনশট' : 'bKash or Nagad Screenshot'}
                </label>
                
                {/* Drag / Click upload box */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    id="screenshot-uploader"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <div className="border border-dashed border-white/15 bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:bg-white/10 transition-colors py-5">
                    {screenshotBase64 ? (
                      <div className="flex flex-col items-center space-y-2 select-none">
                        <div className="relative w-14 h-14 rounded-xl border border-white/20 overflow-hidden bg-slate-950 flex items-center justify-center">
                          <img 
                            src={screenshotBase64} 
                            alt="Screenshot preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-emerald-350">
                            <CheckCircle size={15} />
                          </div>
                        </div>
                        <span className="text-[9px] font-extrabold text-emerald-300 tracking-wider truncate max-w-[190px]">
                          {screenshotName || "screenshot.png"}
                        </span>
                        <span className="text-[8px] text-white/35 block uppercase font-black">{isBn ? 'পরিবর্তন করতে পুনরায় ক্লিক করুন' : 'Click to Replace'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2 select-none text-white/60">
                        <div className="p-2.5 bg-rose-500/15 text-rose-300 border border-rose-500/20 rounded-xl">
                          <Upload size={16} />
                        </div>
                        <span className="text-[10px] font-bold text-white/70 block">{isBn ? 'স্ক্রিনশট ছবি ড্র্যাগ করুন অথবা সিলেক্ট করুন' : 'Drag or click to choose Screenshot'}</span>
                        <span className="text-[8px] text-white/30 block uppercase font-black">{isBn ? 'ফাইল সাইজ সর্বোচ্চ ২ মেগাবাইট' : 'Max size 2MB'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit verification request btn */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 mt-2 font-black uppercase text-xs tracking-wider text-white bg-gradient-to-r from-rose-500 to-pink-650 rounded-2xl items-center justify-center flex gap-1 cursor-pointer active-glow disabled:opacity-50 disabled:pointer-events-none hover:opacity-90 active:scale-98 transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-200"></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-300"></span>
                  </span>
                ) : (
                  <>
                    <span>{isBn ? 'অনুরোধ জমা দিন' : 'Submit Deposit Request API'}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2A SUPER MODE SECURITY VERIFICATION */}
          {step === 'verification' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="glass-card rounded-2xl p-4 border border-white/15 space-y-3 relative overflow-hidden select-none">
                <div className="absolute top-[-10px] right-[-10px] w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none"></div>
                
                <h4 className="text-[11px] uppercase tracking-wider text-rose-300 font-black flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <ShieldCheck size={14} className="text-rose-455" />
                  <span>সুপার এজেন্ট সিকিউর ভেরিফিকেশন গেটওয়ে</span>
                </h4>

                <p className="leading-relaxed text-[10.5px] text-white/70 font-semibold">
                  {isBn 
                    ? 'নিরাপত্তা নিশ্চিত করতে সুপার এজেন্টের অফিসিয়াল জিমেইল এবং আপনার সঠিক এজেন্ট আইডি টাইপ করে পুনরায় অনুরোধ করুন।' 
                    : 'To ensure validation security, please type the Super Agent\'s official Gmail address and your correct 8-digit Agent ID to re-authenticate.'}
                </p>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-white/45 tracking-widest block font-extrabold">
                  {isBn ? 'সুপার এজেন্টের জিমেইল (Gmail)' : 'Super Agent Gmail'}
                </label>
                <input
                  type="email"
                  required
                  value={verifyGmail}
                  onChange={(e) => setVerifyGmail(e.target.value)}
                  placeholder="e.g. bdwalletagent@gmail.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 text-white text-xs placeholder-white/25"
                />
              </div>

              {/* Agent ID Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-white/45 tracking-widest block font-extrabold">
                  {isBn ? 'আপনার এজেন্ট আইডি (Agent ID)' : 'Your Agent ID'}
                </label>
                <input
                  type="text"
                  required
                  value={verifyAgentId}
                  onChange={(e) => setVerifyAgentId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="e.g. 19284756"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-bold font-mono focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 text-white text-xs tracking-widest placeholder-white/25"
                />
              </div>

              {/* Error validation banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-center space-x-2 text-[10px] font-bold select-none leading-relaxed">
                  <AlertTriangle size={14} className="shrink-0 text-rose-455" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Verification submission btn */}
              <button
                type="button"
                onClick={async () => {
                  setErrorMessage(null);
                  if (verifyGmail.trim().toLowerCase() !== 'bdwalletagent@gmail.com') {
                    setErrorMessage(isBn 
                      ? 'ভুল জিমেইল প্রদান করেছেন! অনুগ্রহ করে অফিশিয়াল "bdwalletagent@gmail.com" টাইপ করুন।' 
                      : 'Incorrect Gmail provided! Please enter the official "bdwalletagent@gmail.com".');
                    return;
                  }
                  if (verifyAgentId.trim() !== profile.agentId) {
                    setErrorMessage(isBn 
                      ? 'ভুল এজেন্ট আইডি প্রদান করেছেন! আপনার প্রোফাইলের সাথে আইডিটি মেলেনি।' 
                      : 'Incorrect Agent ID! Does not match your active agent profile ID.');
                    return;
                  }
                  // Submits to Firestore to trigger auto-approving
                  await handleCreateDepositRequest();
                }}
                disabled={isLoading}
                className="w-full py-4 mt-2 font-black uppercase text-xs tracking-wider text-white bg-gradient-to-r from-rose-500 to-pink-650 rounded-2xl items-center justify-center flex gap-1 cursor-pointer active-glow hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-200"></span>
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce delay-300"></span>
                  </span>
                ) : (
                  <>
                    <span>{isBn ? 'অনুরোধ নিশ্চিত করুন' : 'Confirm Request'}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full text-center py-2 text-[10px] text-white/40 hover:text-white/80 transition-colors uppercase font-black tracking-widest cursor-pointer"
              >
                {isBn ? 'ফর্ম এ ফিরে যান' : 'Back to Form'}
              </button>
            </div>
          )}

          {/* STEP 2B AUTOMATED MINUTES COUNTDOWN & STATUS TRACKER */}
          {step === 'approving' && (
            <div className="space-y-6 text-center py-4 animate-fade-in text-xs font-semibold select-none">
              
              {/* Spinning/pulsing graphic based on active state */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {autoApproveStatus === 'counting' && (
                  <>
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="stroke-slate-800"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="stroke-rose-500 transition-all duration-1000 ease-linear"
                        strokeWidth="5"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 * (1 - countdown / 60)}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black text-rose-455 font-mono">{countdown}s</span>
                      <span className="text-[7.5px] uppercase font-black text-white/40 tracking-wider">রিমেনিং</span>
                    </div>
                  </>
                )}

                {autoApproveStatus === 'saving' && (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-rose-455 animate-spin"></div>
                    <span className="text-[8px] text-white/45 font-black uppercase tracking-widest mt-3">অ্যাক্টিভেটিং</span>
                  </div>
                )}

                {autoApproveStatus === 'success' && (
                  <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full animate-bounce">
                    <CheckCircle size={36} />
                  </div>
                )}

                {autoApproveStatus === 'failed' && (
                  <div className="p-4 bg-rose-500/20 border border-rose-500/30 text-rose-350 rounded-full animate-shake">
                    <AlertTriangle size={36} />
                  </div>
                )}
              </div>

              {/* Dynamic Status Text banner */}
              <div className="space-y-1.5 px-2">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {autoApproveStatus === 'counting' && (isBn ? 'স্বয়ংক্রিয় গেটওয়ে যাচাইকরণ' : 'Auto-Gateway Validation')}
                  {autoApproveStatus === 'saving' && (isBn ? 'ব্যালেন্স রিলিজ করা হচ্ছে' : 'Releasing Fund Balance')}
                  {autoApproveStatus === 'success' && (isBn ? 'সফলভাবে অনুমোদিত!' : 'Successfully Approved!')}
                  {autoApproveStatus === 'failed' && (isBn ? 'প্রক্রিয়া ব্যর্থ হয়েছে' : 'Process Validation Failed')}
                </h4>
                <p className="text-[10px] text-white/50 leading-relaxed max-w-[270px] mx-auto">
                  {autoApproveStatus === 'counting' && (
                    isBn 
                      ? `১ মিনিটের মধ্যে আপনার ডিপোজিট অনুরোধটি গেটওয়ে ডাটাবেজে স্বয়ংক্রিয়ভাবে অনুমোদন (Auto-Approve) সম্পন্ন হবে। ব্যাকগ্রাউন্ডে যাচাই চলছে, অনুগ্রহ করে অপেক্ষা করুন...`
                      : 'The system has logged your deposit query. Within 1 minute, the agent pool database will validate and auto-approve. Please wait...'
                  )}
                  {autoApproveStatus === 'saving' && (
                    isBn 
                      ? 'অনুমোদন সফল হয়েছে! ব্যালেন্স হিস্ট্রি ও ওয়ালেট অ্যাকাউন্টে টাকা ক্রেডিট করা হচ্ছে...' 
                      : 'Verification successful! Writing transaction records and depositing funds onto the pool...'
                  )}
                  {autoApproveStatus === 'success' && (
                    isBn 
                      ? `অভিনন্দন! আপনার অ্যাকাউন্ট ওয়ালেটে সফলভাবে ৳${Number(amount).toLocaleString()} টাকা যোগ করা হয়েছে।` 
                      : `Congratulations! BDT ৳${Number(amount).toLocaleString()} was successfully added to your merchant partner wallet.`
                  )}
                  {autoApproveStatus === 'failed' && (
                    isBn 
                      ? 'অনুমোদন ডাটাবেজে রেকর্ড বসাতে অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে টেলিগ্রাম ম্যানেজারে লিংক দিন।' 
                      : 'An unexpected exception occurred writing updates to the node block. Please share your link with support.'
                  )}
                </p>
              </div>

              {/* Details card */}
              <div className="glass-card bg-slate-950/40 border border-white/5 rounded-2xl p-4 text-left space-y-2 font-semibold">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/45">{isBn ? 'মেথড' : 'Method'}</span>
                  <span className="text-white font-extrabold">{isBn ? 'সুপার এজেন্ট গেটওয়ে' : 'Super Agent Portal'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/45">{isBn ? 'পরিমাণ' : 'Amount'}</span>
                  <span className="text-rose-350 font-black">৳ {Number(amount).toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/45">{isBn ? 'স্ট্যাটাস' : 'Status'}</span>
                  <span className={`font-black uppercase tracking-wider text-[10px] ${
                    autoApproveStatus === 'success' 
                      ? 'text-emerald-400' 
                      : autoApproveStatus === 'failed' 
                        ? 'text-rose-455' 
                        : 'text-rose-350 animate-pulse'
                  }`}>
                    {autoApproveStatus === 'counting' && (isBn ? 'যাচাই করা হচ্ছে...' : 'PENDING ACTION...')}
                    {autoApproveStatus === 'saving' && (isBn ? 'জমা হচ্ছে...' : 'DEPOSITING...')}
                    {autoApproveStatus === 'success' && (isBn ? 'সফল' : 'SUCCESS')}
                    {autoApproveStatus === 'failed' && (isBn ? 'ব্যর্থ' : 'FAILED')}
                  </span>
                </div>
              </div>

              {/* Close/Action buttons */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                {autoApproveStatus === 'success' ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider cursor-pointer active-glow font-mono"
                  >
                    {isBn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Go back to Dashboard'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        // Let them also go to standard share link if they don't want to wait
                        setStep('share');
                      }}
                      className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold uppercase text-[11px] tracking-wide cursor-pointer transition-colors"
                    >
                      {isBn ? 'অপেক্ষা না করে লিংক শেয়ার করুন' : 'Share request link instead'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full text-center py-2 text-[10px] text-white/40 hover:text-white/80 transition-colors uppercase font-black tracking-widest cursor-pointer"
                    >
                      {isBn ? 'বাতিল করে ফিরে যান' : 'Cancel and go back'}
                    </button>
                  </>
                )}
              </div>

            </div>
          )}

          {/* STEP 3 SHARE LINK STATE DESIGN */}
          {step === 'share' && (
            <div className="space-y-5 text-center py-2 animate-fade-in text-xs font-semibold select-none">
              <div className="inline-flex p-3 bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-3xl animate-bounce">
                <CheckCircle size={32} />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {isBn ? 'আবেদন লিংক তৈরি হয়েছে!' : 'Request link generated!'}
                </h4>
                <p className="text-[10.5px] text-white/50 max-w-[280px] mx-auto leading-relaxed">
                  {isBn 
                    ? 'আপনার ডীপোজিট আবেদনের একটি শেয়ারেবল লিংক তৈরি করা হয়েছে। নিচের বাটন থেকে লিংকটি কপি করে এখনই আমাদের টেলিগ্রাম ম্যানেজারের কাছে ভেরিফিকেশনের জন্য পাঠান।' 
                    : 'A secure shareable verification link has been generated. Copy this link and forward it directly to our verified Telegram manager.'}
                </p>
              </div>

              {/* Target Data card details */}
              <div className="glass-card bg-slate-950/40 border border-white/5 rounded-2xl p-4 text-left space-y-2 font-semibold">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/45">{isBn ? 'এজেন্ট আইডি' : 'Agent ID'}</span>
                  <span className="text-white font-extrabold">{profile.agentId}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/45">{isBn ? 'মেথড' : 'Payment Type'}</span>
                  <span className="text-white font-extrabold uppercase">{cashType === 'own' ? paymentMethod : 'SUPER AGENT'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/45">{isBn ? 'টাকার পরিমাণ' : 'Amount Requested'}</span>
                  <span className="text-rose-350 font-black">৳ {Number(amount).toLocaleString()}</span>
                </div>
              </div>

              {/* Copying link block */}
              <div className="space-y-2">
                <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-white/10 items-center justify-between">
                  <span className="text-[10px] text-rose-300 pl-3 font-mono font-extrabold truncate max-w-[240px] tracking-wide select-all">
                    {generatedLink}
                  </span>
                  
                  <button
                    onClick={handleCopyLink}
                    className="p-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 text-rose-300 rounded-xl cursor-pointer flex items-center justify-center gap-1 font-bold group"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span className="text-[9px] uppercase tracking-wider font-black">{copied ? (isBn ? 'কপি!' : 'Copied!') : (isBn ? 'কপি' : 'Copy')}</span>
                  </button>
                </div>
              </div>

              {/* Telegram wrapper button as explicitly requested */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                <a
                  href="https://t.me/bdwalletagent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-[#4c9acf] hover:bg-[#4ea2da] text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[98%] cursor-pointer active-glow"
                >
                  <Send size={15} />
                  <span>{isBn ? 'টেলিগ্রাম ম্যানেজারের সাথে যোগাযোগ' : 'Contact Telegram Manager'}</span>
                </a>
                
                <button
                  onClick={onClose}
                  className="w-full text-center py-2 text-[10px] text-white/40 hover:text-white/80 transition-colors uppercase font-black tracking-widest cursor-pointer"
                >
                  {isBn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
