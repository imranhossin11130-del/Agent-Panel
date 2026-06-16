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
  Image as ImageIcon,
  Sparkles,
  Award,
  Zap,
  BookOpen
} from 'lucide-react';
import { TransactionType, Language, AgentProfile, Transaction } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { AgentCashFlow } from './AgentCashFlow';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

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
  const [loading, setLoading] = useState(false);
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

  const [depositState, setDepositState] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [withdrawState, setWithdrawState] = useState<any>(null);
  const [withdrawSecondsLeft, setWithdrawSecondsLeft] = useState<number>(0);
  const [guidelineTab, setGuidelineTab] = useState<'commission' | 'earn' | 'hundred' | 'refer'>('commission');

  // Helper to generate a realistic user deposit request matching bkash/nagad flows
  const generatePlayerRequest = () => {
    const is11Digits = Math.random() > 0.5;
    const prefix = ['17', '19', '15', '18', '13', '14', '16'][Math.floor(Math.random() * 7)];
    const suffixLength = is11Digits ? 8 : 7;
    let suffix = '';
    for (let i = 0; i < suffixLength; i++) {
      suffix += Math.floor(Math.random() * 10);
    }
    const phone = '0' + prefix + suffix;
    const amount = Math.random() > 0.5 ? 500 : 1000;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let trxId = 'TRX';
    for (let i = 0; i < 7; i++) {
      trxId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const method = Math.random() > 0.5 ? 'bKash' : 'Nagad';
    const now = new Date();
    // Beautiful human Bengali time representation
    const timestamp = now.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) + ', ' + 
                      now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true });

    return { id: Math.random().toString(36).substr(2, 9), phone, amount, trxId, method, timestamp };
  };

  // Helper to generate a realistic user withdraw request matching bkash/nagad flows (1000 or 1500 BDT)
  const generatePlayerWithdrawRequest = () => {
    const is11Digits = Math.random() > 0.5;
    const prefix = ['17', '19', '15', '18', '13', '14', '16'][Math.floor(Math.random() * 7)];
    const suffixLength = is11Digits ? 8 : 7;
    let suffix = '';
    for (let i = 0; i < suffixLength; i++) {
      suffix += Math.floor(Math.random() * 10);
    }
    const phone = '0' + prefix + suffix;
    // Strictly 1000 BDT or 1500 BDT
    const amount = Math.random() > 0.5 ? 1000 : 1500;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let trxId = 'TRX';
    for (let i = 0; i < 7; i++) {
      trxId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const method = Math.random() > 0.5 ? 'bKash' : 'Nagad';
    const now = new Date();
    // Beautiful human Bengali time representation
    const timestamp = now.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }) + ', ' + 
                      now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true });

    return { id: Math.random().toString(36).substr(2, 9), phone, amount, trxId, method, timestamp };
  };

  const getStoredQueue = (): any => {
    const key = `mfs_deposit_queue_${profile.agentId || 'default'}`;
    const stored = localStorage.getItem(key);
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lastApprovedDate !== todayStr) {
          parsed.todayApprovalsCount = 0;
          parsed.lastApprovedDate = todayStr;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    
    const initQueue = {
      backlogRemaining: 150,
      currentState: 'active',
      currentRequest: generatePlayerRequest(),
      waitingUntil: null,
      todayApprovalsCount: 0,
      lastApprovedDate: todayStr
    };
    localStorage.setItem(key, JSON.stringify(initQueue));
    return initQueue;
  };

  const getStoredWithdrawQueue = (): any => {
    const key = `mfs_withdraw_queue_${profile.agentId || 'default'}`;
    const stored = localStorage.getItem(key);
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lastApprovedDate !== todayStr) {
          parsed.todayApprovalsCount = 0;
          parsed.lastApprovedDate = todayStr;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    
    const initQueue = {
      backlogRemaining: 150,
      currentState: 'active',
      currentRequest: generatePlayerWithdrawRequest(),
      waitingUntil: null,
      todayApprovalsCount: 0,
      lastApprovedDate: todayStr
    };
    localStorage.setItem(key, JSON.stringify(initQueue));
    return initQueue;
  };

  // Safe timer logic for the 45s to 1m wait countdown
  useEffect(() => {
    if (activeAction !== 'cash_in') return;

    const initOrTick = () => {
      const queue = getStoredQueue();
      setDepositState(queue);

      if (queue.currentState === 'waiting' && queue.waitingUntil) {
        const diff = Math.ceil((queue.waitingUntil - Date.now()) / 1000);
        if (diff <= 0) {
          const nextQueue = {
            ...queue,
            currentState: queue.backlogRemaining > 0 ? 'active' : 'done',
            currentRequest: queue.backlogRemaining > 0 ? generatePlayerRequest() : null,
            waitingUntil: null
          };
          const key = `mfs_deposit_queue_${profile.agentId || 'default'}`;
          localStorage.setItem(key, JSON.stringify(nextQueue));
          setDepositState(nextQueue);
          setSecondsLeft(0);
        } else {
          setSecondsLeft(diff);
        }
      }
    };

    initOrTick();

    const interval = setInterval(() => {
      const queue = getStoredQueue();
      if (queue.currentState === 'waiting' && queue.waitingUntil) {
        const now = Date.now();
        if (now >= queue.waitingUntil) {
          const nextQueue = {
            ...queue,
            currentState: queue.backlogRemaining > 0 ? 'active' : 'done',
            currentRequest: queue.backlogRemaining > 0 ? generatePlayerRequest() : null,
            waitingUntil: null
          };
          const key = `mfs_deposit_queue_${profile.agentId || 'default'}`;
          localStorage.setItem(key, JSON.stringify(nextQueue));
          setDepositState(nextQueue);
          setSecondsLeft(0);
        } else {
          setSecondsLeft(Math.ceil((queue.waitingUntil - now) / 1000));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAction]);

  const handleApproveClick = () => {
    if (!depositState || !depositState.currentRequest) return;
    const req = depositState.currentRequest;
    
    if (depositState.todayApprovalsCount >= 15) {
      setErrorMessage(
        language === 'bn' 
          ? 'দুঃখিত, আপনি আজকের দৈনিক ১৫ টি ডিপোজিট অনুমোদনের সীমা অতিক্রম করেছেন।' 
          : 'Sorry, you have exceeded today\'s limit of 15 deposit approvals.'
      );
      return;
    }

    if (profile.walletBalance < req.amount) {
      setErrorMessage(
        language === 'bn' 
          ? 'দুঃখিত! এই ডিপোজিট টি এপ্রুভ করতে আপনার মূল ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।' 
          : 'Sorry, you have insufficient balance in your main wallet to approve this deposit.'
      );
      return;
    }

    setPhoneNumber(req.phone);
    setAmount(String(req.amount));
    setSelectedOperator(req.method);
    setSelectedBiller(req.trxId); // Store trxId in selectedBiller
    setBillAccount(req.timestamp); // Store timestamp in billAccount

    setErrorMessage('');
    setStage('confirm');
  };

  const handleRejectClick = () => {
    if (window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে খেলোয়াড়ের এই ডিপোজিট অনুরোধটি বাতিল করতে চান?' : 'Are you sure you want to cancel this player\'s deposit request?')) {
      const key = `mfs_deposit_queue_${profile.agentId || 'default'}`;
      const queue = getStoredQueue();
      
      const nextQueue = {
        ...queue,
        currentState: queue.backlogRemaining > 0 ? 'active' : 'done',
        currentRequest: queue.backlogRemaining > 0 ? generatePlayerRequest() : null,
      };
      
      localStorage.setItem(key, JSON.stringify(nextQueue));
      setDepositState(nextQueue);
      
      onShowToast?.(
        language === 'bn' 
          ? 'ডিপোজিট অনুরোধটি বাতিল করা হয়েছে এবং নতুন অনুরোধ লোড করা হয়েছে।' 
          : 'Deposit request rejected. Loaded next request.',
        'info'
      );
    }
  };

  // Safe timer logic for the 45s to 1m wait countdown for Withdraw Approve
  useEffect(() => {
    if (activeAction !== 'cash_out') return;

    const initOrTickWithdraw = () => {
      const queue = getStoredWithdrawQueue();
      setWithdrawState(queue);

      if (queue.currentState === 'waiting' && queue.waitingUntil) {
        const diff = Math.ceil((queue.waitingUntil - Date.now()) / 1000);
        if (diff <= 0) {
          const nextQueue = {
            ...queue,
            currentState: queue.backlogRemaining > 0 ? 'active' : 'done',
            currentRequest: queue.backlogRemaining > 0 ? generatePlayerWithdrawRequest() : null,
            waitingUntil: null
          };
          const key = `mfs_withdraw_queue_${profile.agentId || 'default'}`;
          localStorage.setItem(key, JSON.stringify(nextQueue));
          setWithdrawState(nextQueue);
          setWithdrawSecondsLeft(0);
        } else {
          setWithdrawSecondsLeft(diff);
        }
      }
    };

    initOrTickWithdraw();

    const interval = setInterval(() => {
      const queue = getStoredWithdrawQueue();
      if (queue.currentState === 'waiting' && queue.waitingUntil) {
        const now = Date.now();
        if (now >= queue.waitingUntil) {
          const nextQueue = {
            ...queue,
            currentState: queue.backlogRemaining > 0 ? 'active' : 'done',
            currentRequest: queue.backlogRemaining > 0 ? generatePlayerWithdrawRequest() : null,
            waitingUntil: null
          };
          const key = `mfs_withdraw_queue_${profile.agentId || 'default'}`;
          localStorage.setItem(key, JSON.stringify(nextQueue));
          setWithdrawState(nextQueue);
          setWithdrawSecondsLeft(0);
        } else {
          setWithdrawSecondsLeft(Math.ceil((queue.waitingUntil - now) / 1000));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAction]);

  const handleWithdrawApproveClick = () => {
    if (!withdrawState || !withdrawState.currentRequest) return;
    const req = withdrawState.currentRequest;
    
    if (withdrawState.todayApprovalsCount >= 5) {
      setErrorMessage(
        language === 'bn' 
          ? 'দুঃখিত, আপনি আজকের দৈনিক ৫ টি উইথড্র অনুমোদনের সীমা অতিক্রম করেছেন।' 
          : 'Sorry, you have exceeded today\'s limit of 5 withdraw approvals.'
      );
      return;
    }

    setPhoneNumber(req.phone);
    setAmount(String(req.amount));
    setSelectedOperator(req.method);
    setSelectedBiller(req.trxId); // Store trxId in selectedBiller
    setBillAccount(req.timestamp); // Store timestamp in billAccount

    setErrorMessage('');
    setStage('confirm');
  };

  const handleWithdrawRejectClick = () => {
    if (window.confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে খেলোয়াড়ের এই উইথড্র অনুরোধটি বাতিল করতে চান?' : 'Are you sure you want to cancel this player\'s withdraw request?')) {
      const key = `mfs_withdraw_queue_${profile.agentId || 'default'}`;
      const queue = getStoredWithdrawQueue();
      
      const nextQueue = {
        ...queue,
        currentState: queue.backlogRemaining > 0 ? 'active' : 'done',
        currentRequest: queue.backlogRemaining > 0 ? generatePlayerWithdrawRequest() : null,
      };
      
      localStorage.setItem(key, JSON.stringify(nextQueue));
      setWithdrawState(nextQueue);
      
      onShowToast?.(
        language === 'bn' 
          ? 'উইথড্র অনুরোধটি বাতিল করা হয়েছে এবং নতুন অনুরোধ লোড করা হয়েছে।' 
          : 'Withdraw request rejected. Loaded next request.',
        'info'
      );
    }
  };

  const renderDepositApprovalUI = () => {
    if (!depositState) {
      return (
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <div className="w-8 h-8 rounded-full border-4 border-rose-500/10 border-t-rose-500 animate-spin"></div>
          <p className="text-[11px] text-white/50">{language === 'bn' ? 'অনুরোধ লোড করা হচ্ছে...' : 'Loading requests...'}</p>
        </div>
      );
    }

    if (depositState.currentState === 'done') {
      return (
        <div className="glass-card rounded-3xl p-6 text-center space-y-3 border border-white/5">
          <CheckCircle2 className="mx-auto text-emerald-400" size={48} />
          <h4 className="text-sm font-black text-white">{language === 'bn' ? 'সকল অনুরোধ সম্পন্ন!' : 'All Requests Processed!'}</h4>
          <p className="text-xs text-white/50 leading-relaxed">
            {language === 'bn' 
              ? 'আপনার তালিকার ১৫০টি ডিপোজিট অনুরোধের সবগুলোই যাচাই করা সম্পন্ন হয়েছে।' 
              : 'All 150 deposit requests in your backlog have been processed successfully.'}
          </p>
        </div>
      );
    }

    if (depositState.currentState === 'waiting') {
      const left = secondsLeft;
      const isPhase1 = left > 20;

      return (
        <div className="flex flex-col space-y-5 py-4 select-none">
          <div className="glass-card rounded-3xl p-5 border border-white/10 flex flex-col items-center text-center space-y-4">
            
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-rose-500/5"></div>
              <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-t-transparent animate-spin opacity-40" style={{ animationDuration: '2s' }}></div>
              
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-rose-350 font-mono tracking-tighter">{left}</span>
                <span className="text-[9px] uppercase font-bold text-white/40 tracking-wider">
                  {language === 'bn' ? 'সেকেন্ড বাকি' : 'sec left'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 w-full">
              <span className="text-[10px] uppercase font-black text-rose-450 tracking-widest block animate-pulse">
                {language === 'bn' ? 'সিস্টেম স্ট্যাটাস আপডেট' : 'NETWORK STATUS UPDATE'}
              </span>
              
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center space-x-2 text-xs font-black min-h-[50px]">
                <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                <span className="text-white text-center leading-relaxed">
                  {isPhase1 ? (
                    language === 'bn' ? 'খেলোয়াড় সুপার এজেন্টের ওয়ালেটে টাকা পাঠাইছে...' : "Player has sent money to the super agent's wallet..."
                  ) : (
                    language === 'bn' ? 'সুপার এজেন্ট টাকা পাওয়া নিশ্চিত করতেছেন...' : 'Super agent is confirming receipt of money...'
                  )}
                </span>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-white/40 leading-relaxed px-2">
              {language === 'bn'
                ? 'সুপার এজেন্ট টাকা পাওয়া নিশ্চিত করলে আপনার স্ক্রিনে ডিপোজিট অনুরোধটি স্বয়ংক্রিয়ভাবে উপস্থিত হবে।'
                : 'Once the super agent confirms receipt of the money, the deposit request will automatically appear on your screen.'}
            </p>
          </div>
          
          <div className="flex justify-between items-center text-xs px-2">
            <span className="text-white/40 font-bold">{language === 'bn' ? 'আজকের লিমিট ট্র্যাকার:' : "Today's limit tracker:"}</span>
            <span className="font-extrabold text-white/80 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
              {depositState.todayApprovalsCount} / 15 {language === 'bn' ? 'অনুমোদিত' : 'Approved'}
            </span>
          </div>
        </div>
      );
    }

    const req = depositState.currentRequest;
    if (!req) return null;

    const formattedAmount = language === 'bn' 
      ? req.amount.toLocaleString('bn-BD') 
      : req.amount.toLocaleString();

    return (
      <div className="flex flex-col space-y-4">
        
        <div className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-2xl text-[11px] font-black tracking-wider select-none">
          <div className="flex items-center space-x-1 text-white/50">
            <span>{language === 'bn' ? 'বাকী অনুরোধ:' : 'Backlog Remaining:'}</span>
            <span className="text-white bg-rose-500/25 border border-rose-500/20 px-2 py-0.5 rounded-lg font-mono">
              {depositState.backlogRemaining}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-white/50">
            <span>{language === 'bn' ? 'আজকের অনুমোদন:' : 'Approved Today:'}</span>
            <span className="text-white bg-emerald-500/25 border border-emerald-500/20 px-2 py-0.5 rounded-lg font-mono">
              {depositState.todayApprovalsCount} / 15
            </span>
          </div>
        </div>

        <div className="glass-card bg-slate-900/60 border border-white/10 rounded-3xl p-5 shadow-inner space-y-4 relative">
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#f43f5e]">
              {language === 'bn' ? 'যাচাইয়ের অপেক্ষমাণ অনুরোধ' : 'PENDING PLAYER REQUEST'}
            </span>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center space-x-1 ${
              req.method === 'bKash' 
                ? 'bg-[#E2125D]/15 border border-[#E2125D]/30 text-[#E2125D]' 
                : 'bg-[#F37021]/15 border border-[#F37021]/30 text-[#F37021]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${req.method === 'bKash' ? 'bg-[#E2125D]' : 'bg-[#F37021]'}`}></span>
              <span>{req.method}</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-3.5 space-y-3">
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-bold">{language === 'bn' ? 'খেলোয়াড়ের মোবাইল নম্বর' : 'Player Phone'}</span>
              <span className="font-mono text-sm font-black text-white tracking-widest">{req.phone}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-bold">{language === 'bn' ? 'ট্রানজেকশন আইডি (TrxID)' : 'Transaction ID'}</span>
              <div className="flex items-center space-x-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
                <span className="font-mono font-black text-rose-300 select-all">{req.trxId}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-bold">{language === 'bn' ? 'অনুরোধের সময় ও তারিখ' : 'Timestamp'}</span>
              <span className="font-semibold text-white/100">{req.timestamp}</span>
            </div>

            <div className="border-t border-white/5 pt-3 flex justify-between items-center select-none">
              <span className="text-xs text-white/40 font-bold">{language === 'bn' ? 'টাকার পরিমাণ' : 'Amount'}</span>
              <span className="text-xl font-black text-rose-350 font-mono">
                ৳ {formattedAmount}
              </span>
            </div>

          </div>
        </div>

        <div className="flex gap-3 select-none">
          <button
            onClick={handleRejectClick}
            className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95 text-center"
          >
            {language === 'bn' ? 'বাতিল করুন' : 'Reject Request'}
          </button>
          
          <button
            onClick={handleApproveClick}
            className="flex-1 py-3.5 bg-gradient-to-r from-rose-500 to-pink-650 text-white hover:opacity-95 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95 shadow-lg shadow-rose-500/20 active-glow text-center"
          >
            {language === 'bn' ? 'এপ্রুভ করুন' : 'Approve Request'}
          </button>
        </div>

      </div>
    );
  };

  const renderWithdrawApprovalUI = () => {
    const isBn = language === 'bn';

    if (!withdrawState) {
      return (
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <div className="w-8 h-8 rounded-full border-4 border-rose-500/10 border-t-rose-500 animate-spin"></div>
          <p className="text-[11px] text-white/50">{isBn ? 'অনুরোধ লোড করা হচ্ছে...' : 'Loading requests...'}</p>
        </div>
      );
    }

    if (withdrawState.currentState === 'done') {
      return (
        <div className="glass-card rounded-3xl p-6 text-center space-y-3 border border-white/5">
          <CheckCircle2 className="mx-auto text-emerald-400" size={48} />
          <h4 className="text-sm font-black text-white">{isBn ? 'সকল উইথড্র অনুরোধ সম্পন্ন!' : 'All Withdrawals Completed!'}</h4>
          <p className="text-xs text-white/50 leading-relaxed">
            {isBn 
              ? 'আপনার তালিকার ১৫০টি উইথড্র অনুরোধের সবগুলোই যাচাই করা সম্পন্ন হয়েছে।' 
              : 'All 150 withdrawal requests in your backlog have been processed successfully.'}
          </p>
        </div>
      );
    }

    if (withdrawState.currentState === 'waiting') {
      const left = withdrawSecondsLeft;
      const isPhase1 = left > 25; // Phase 1 is first half, Phase 2 is second half

      return (
        <div className="flex flex-col space-y-5 py-4 select-none">
          <div className="glass-card rounded-3xl p-5 border border-white/10 flex flex-col items-center text-center space-y-4">
            
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-rose-500/5"></div>
              <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-t-transparent animate-spin opacity-40" style={{ animationDuration: '2s' }}></div>
              
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-rose-350 font-mono tracking-tighter">{left}</span>
                <span className="text-[9px] uppercase font-bold text-white/40 tracking-wider">
                  {isBn ? 'সেকেন্ড বাকি' : 'sec left'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 w-full">
              <span className="text-[10px] uppercase font-black text-rose-450 tracking-widest block animate-pulse">
                {isBn ? 'নেটওয়ার্ক আপডেট' : 'NETWORK STATUS UPDATE'}
              </span>
              
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center space-x-2 text-xs font-black min-h-[50px]">
                <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                <span className="text-white text-center leading-relaxed">
                  {isPhase1 ? (
                    isBn ? 'খেলোয়াড়েরা উইথড্র নিশ্চিত করতেছেন...' : 'Players are confirming withdrawal...'
                  ) : (
                    isBn ? 'সুপার এজেন্ট এর ওয়ালেটে খেলোয়াড়ের একাউন্ট থেকে টাকা কেটে ওয়ালেটে যুক্ত হচ্ছে...' : "Money is being deducted from player's account and added to Super Agent wallet..."
                  )}
                </span>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-white/40 leading-relaxed px-2">
              {isBn
                ? 'সুপার এজেন্ট লিমিট ও ডেটা আপডেট সম্পন্ন করলে আপনার স্ক্রিনে উইথড্র অনুরোধটি স্বয়ংক্রিয়ভাবে উপস্থিত হবে।'
                : 'The withdrawal request will automatically appear on your screen once limits and data are verified.'}
            </p>
          </div>
          
          <div className="flex justify-between items-center text-xs px-2">
            <span className="text-white/40 font-bold">{isBn ? 'আজকের লিমিট ট্র্যাকার:' : "Today's limit tracker:"}</span>
            <span className="font-extrabold text-white/80 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
              {withdrawState.todayApprovalsCount} / 5 {isBn ? 'অনুমোদিত' : 'Approved'}
            </span>
          </div>
        </div>
      );
    }

    const req = withdrawState.currentRequest;
    if (!req) return null;

    const formattedAmount = isBn 
      ? req.amount.toLocaleString('bn-BD') 
      : req.amount.toLocaleString();

    return (
      <div className="flex flex-col space-y-4">
        
        <div className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-2xl text-[11px] font-black tracking-wider select-none">
          <div className="flex items-center space-x-1 text-white/50">
            <span>{isBn ? 'বাকী অনুরোধ:' : 'Backlog Remaining:'}</span>
            <span className="text-white bg-rose-500/25 border border-rose-500/20 px-2 py-0.5 rounded-lg font-mono">
              {withdrawState.backlogRemaining}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-white/50">
            <span>{isBn ? 'আজকের অনুমোদন:' : 'Approved Today:'}</span>
            <span className="text-white bg-emerald-500/25 border border-emerald-500/20 px-2 py-0.5 rounded-lg font-mono">
              {withdrawState.todayApprovalsCount} / 5
            </span>
          </div>
        </div>

        <div className="glass-card bg-slate-900/60 border border-white/10 rounded-3xl p-5 shadow-inner space-y-4 relative">
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#f43f5e]">
              {isBn ? 'যাচাইয়ের অপেক্ষমাণ উইথড্র' : 'PENDING PLAYER WITHDRAW'}
            </span>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center space-x-1 ${
              req.method === 'bKash' 
                ? 'bg-[#E2125D]/15 border border-[#E2125D]/30 text-[#E2125D]' 
                : 'bg-[#F37021]/15 border border-[#F37021]/30 text-[#F37021]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${req.method === 'bKash' ? 'bg-[#E2125D]' : 'bg-[#F37021]'}`}></span>
              <span>{req.method}</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-3.5 space-y-3">
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-bold">{isBn ? 'খেলোয়াড়ের মোবাইল নম্বর' : 'Player Phone'}</span>
              <span className="font-mono text-sm font-black text-white tracking-widest">{req.phone}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-bold">{isBn ? 'ট্রানজেকশন আইডি (TrxID)' : 'Transaction ID'}</span>
              <div className="flex items-center space-x-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
                <span className="font-mono font-black text-rose-300 select-all">{req.trxId}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-white/40 font-bold">{isBn ? 'অনুরোধের সময় ও তারিখ' : 'Timestamp'}</span>
              <span className="font-semibold text-white/100">{req.timestamp}</span>
            </div>

            <div className="border-t border-white/5 pt-3 flex justify-between items-center select-none">
              <span className="text-xs text-white/40 font-bold">{isBn ? 'টাকার পরিমাণ' : 'Amount'}</span>
              <span className="text-xl font-black text-rose-350 font-mono">
                ৳ {formattedAmount}
              </span>
            </div>

          </div>
        </div>

        <div className="flex gap-3 select-none">
          <button
            onClick={handleWithdrawRejectClick}
            className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95 text-center"
          >
            {isBn ? 'বাতিল করুন' : 'Reject Request'}
          </button>
          
          <button
            onClick={handleWithdrawApproveClick}
            className="flex-1 py-3.5 bg-gradient-to-r from-rose-500 to-pink-650 text-white hover:opacity-95 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95 shadow-lg shadow-rose-500/20 active-glow text-center"
          >
            {isBn ? 'এপ্রুভ করুন' : 'Approve Request'}
          </button>
        </div>

      </div>
    );
  };

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

    if (activeAction === 'commission_withdraw') {
      if (!selectedOperator) {
        setErrorMessage(language === 'bn' ? 'দয়া করে একটি পেমেন্ট মেথড সিলেক্ট করুন।' : 'Please select a payment method.');
        return;
      }
      if (!/^(01)[3-9]\d{8}$/.test(phoneNumber)) {
        setErrorMessage(t.invalidPhone);
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

    if (activeAction === 'cash_in') {
      if (amtNum > profile.walletBalance) {
        setErrorMessage(t.insufficientBalance);
        return;
      }
    }

    if (activeAction === 'recharge' || activeAction === 'bill_pay') {
      if (amtNum > profile.commissionBalance) {
        setErrorMessage(language === 'bn' 
          ? 'দুঃখিত! আপনার কমিশন ব্যালেন্সে পর্যাপ্ত টাকা নেই।' 
          : 'Sorry! You do not have enough commission balance.');
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

    if (activeAction === 'commission_withdraw') {
      const generatedTrxId = 'CW' + Math.floor(100000 + Math.random() * 900000);
      const newWithdrawalDoc = {
        id: generatedTrxId,
        agentUid: auth.currentUser?.uid || 'anonymous',
        agentName: profile.name || 'Agent Partner',
        agentPhone: profile.phone || '01700000000',
        paymentMethod: selectedOperator || 'bKash',
        phoneNumber: phoneNumber,
        amount: amtNum,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      setLoading(true);
      setErrorMessage('');

      setDoc(doc(db, 'commission_withdrawals', generatedTrxId), newWithdrawalDoc)
        .then(() => {
          setNewTrxDetails({
            trxId: generatedTrxId,
            amount: amtNum,
            dest: phoneNumber,
            extra: selectedOperator,
            timestamp: new Date()
          });
          setStage('success');
          setLoading(false);
          if (onShowToast) {
            onShowToast(language === 'bn' ? 'আবেদনটি সফলভাবে জমা হয়েছে!' : 'Application submitted successfully!', 'success');
          }
        })
        .catch((err) => {
          console.error("Error creating commission withdrawal document:", err);
          setErrorMessage(language === 'bn' ? 'আবেদনটি সাবমিট করা যায়নি।' : 'Failed to submit request.');
          setStage('confirm');
          setSliderPosition(0);
          setLoading(false);
        });

      return;
    }

    const generatedTrxId = (activeAction === 'cash_in' || activeAction === 'cash_out') 
      ? selectedBiller // Use player's real transaction ID which was stored in selectedBiller
      : 'BN' + Math.random().toString(36).substr(2, 8).toUpperCase();
    
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
    } else if (activeAction === 'cash_in') {
      operatorOrBillerName = `${selectedOperator} ${language === 'bn' ? 'ডিপোজিট এপ্রুভ' : 'Deposit Approval'}`;
    } else if (activeAction === 'cash_out') {
      operatorOrBillerName = `${selectedOperator} ${language === 'bn' ? 'উইথড্র এপ্রুভ' : 'Withdraw Approval'}`;
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

    // If it is 'cash_in' (Deposit Approval) transaction, update our queue state to waiting!
    if (activeAction === 'cash_in') {
      const key = `mfs_deposit_queue_${profile.agentId || 'default'}`;
      const queue = getStoredQueue();
      const delayInMs = (Math.floor(Math.random() * 16) + 45) * 1000; // 45 to 60 seconds
      
      const nextQueue = {
        ...queue,
        backlogRemaining: Math.max(0, queue.backlogRemaining - 1),
        todayApprovalsCount: queue.todayApprovalsCount + 1,
        currentState: 'waiting',
        waitingUntil: Date.now() + delayInMs,
        currentRequest: null, // clear current request right after approval
        lastApprovedDate: new Date().toISOString().split('T')[0]
      };
      
      localStorage.setItem(key, JSON.stringify(nextQueue));
      setDepositState(nextQueue);
    }

    // If it is 'cash_out' (Withdraw Approval) transaction, update our queue state to waiting!
    if (activeAction === 'cash_out') {
      const key = `mfs_withdraw_queue_${profile.agentId || 'default'}`;
      const queue = getStoredWithdrawQueue();
      const delayInMs = (Math.floor(Math.random() * 16) + 45) * 1000; // 45 to 60 seconds
      
      const nextQueue = {
        ...queue,
        backlogRemaining: Math.max(0, queue.backlogRemaining - 1),
        todayApprovalsCount: queue.todayApprovalsCount + 1,
        currentState: 'waiting',
        waitingUntil: Date.now() + delayInMs,
        currentRequest: null, // clear current request right after approval
        lastApprovedDate: new Date().toISOString().split('T')[0]
      };
      
      localStorage.setItem(key, JSON.stringify(nextQueue));
      setWithdrawState(nextQueue);
    }

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
  const renderGuidelines = () => {
    const isBn = language === 'bn';

    return (
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pb-8 pr-1 select-none">
        
        {/* Sub tabs header */}
        <div className="flex bg-slate-950/60 p-1.5 rounded-2xl gap-1 shrink-0 overflow-x-auto scrollbar-none border border-white/5">
          <button
            onClick={() => setGuidelineTab('commission')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              guidelineTab === 'commission'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-550/15'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Coins size={12} />
            <span>{isBn ? 'কমিশন চার্ট' : 'Rates'}</span>
          </button>
          <button
            onClick={() => setGuidelineTab('earn')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              guidelineTab === 'earn'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-550/15'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp size={12} />
            <span>{isBn ? 'আয়ের উপায়' : 'Earning'}</span>
          </button>
          <button
            onClick={() => setGuidelineTab('hundred')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              guidelineTab === 'hundred'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-550/15'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles size={12} />
            <span>{isBn ? '১০০% কমিশন' : '100% Comms'}</span>
          </button>
          <button
            onClick={() => setGuidelineTab('refer')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              guidelineTab === 'refer'
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-550/15'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Share2 size={12} />
            <span>{isBn ? 'রেফার বোনাস' : 'Referral'}</span>
          </button>
        </div>

        {/* Tab content view switching */}
        {guidelineTab === 'commission' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="glass-card bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-2xl flex items-start space-x-3 text-xs leading-relaxed">
              <Info className="shrink-0 mt-0.5 text-rose-300" size={16} />
              <p>{t.guideIntro}</p>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
              <table className="w-full text-left text-[11px] border-collapse bg-white/[0.01]">
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
                    <td className="p-3 text-right text-emerald-350">{isBn ? '৫.০০% (৳৫০.০০/হাজার)' : '5.00% (৳50.00/1k)'}</td>
                    <td className="p-3 text-right text-white/40">৳১০ - ৳২৫,০০০</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-white">{t.actionCashOut}</td>
                    <td className="p-3 text-right text-emerald-350">{isBn ? '৩.০০% (৳৩০.০০/হাজার)' : '3.00% (৳30.00/1k)'}</td>
                    <td className="p-3 text-right text-white/40">৳১০ - ৳২৫,০০০</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-white">{t.actionMobileRecharge}</td>
                    <td className="p-3 text-right text-emerald-350">২.৮৫% (৳২৮.৫০/হাজার)</td>
                    <td className="p-3 text-right text-white/40">৳১০ - ৳১,০০০</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-white">{t.actionBillLive}</td>
                    <td className="p-3 text-right text-emerald-350">৳১৫.০০ ফিক্সড</td>
                    <td className="p-3 text-right text-white/40">৳৫০ - ৳৫০,০০০</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="glass-card rounded-3xl p-5 space-y-3.5 border border-white/5">
              <h4 className="text-xs font-black text-rose-350 uppercase tracking-widest">{isBn ? 'গুরুত্বপূর্ণ নিয়মাবলি:' : 'Important Regulations:'}</h4>
              <ul className="text-xs text-white/60 space-y-2.5 list-disc pl-4 font-semibold leading-relaxed">
                <li>{t.rule1}</li>
                <li>{t.rule2}</li>
                <li>{t.rule3}</li>
                <li>{t.rule4}</li>
              </ul>
            </div>
          </motion.div>
        )}

        {guidelineTab === 'earn' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="p-3 bg-rose-500/10 border border-rose-500/15 rounded-2xl text-[11px] text-rose-300 font-bold leading-relaxed">
              {isBn 
                ? 'এজেন্ট অংশীদার হিসেবে আপনার দৈনিক কমিশন বাড়ানোর জন্য নিচের ৪টি আয়ের মাধ্যম সক্রিয়ভাবে ব্যবহার করুন।' 
                : 'As an agent partner, leverage these 4 diverse earning streams to boost your monthly profits.'}
            </div>

            <div className="space-y-2.5">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-xs uppercase tracking-wide">
                  <Coins size={12} className="text-emerald-400" />
                  <span>{isBn ? '১. ডিপোজিট অনুমোদন (ক্যাশ-ইন)' : '1. Deposit Approval (Cash In)'}</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed font-semibold">
                  {isBn 
                    ? 'অ্যাপে আসা খেলোয়াড়দের ক্যাশ-ইন বা ডিপোজিট রিকোয়েস্ট অনুমোদন করে ট্রানজেকশন অ্যামাউন্টের উপর সরাসরি ৫.০০% নিশ্চিত কমিশন উপার্জন করুন।'
                    : 'Approve player bank deposit requests instantly to grab 5.00% cash commission of the handled money.'}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-xs uppercase tracking-wide">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span>{isBn ? '২. ক্যাশ আউট লেনদেন' : '2. Cash Out Execution'}</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed font-semibold">
                  {isBn 
                    ? 'গ্রাহকেরা যখন আপনার এজেন্ট পোর্টাল ব্যবহার করে অর্থ ক্যাশ আউট সম্পন্ন করবে, তখন তাৎক্ষণিকভাবে প্রতিটি ট্রানজেকশনে ৩.০০% লাইভ কমিশন লাভ করুন।'
                    : 'Process and authenticate customers cash withdrawal requests and pocket flat 3.00% real-time commission.'}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-xs uppercase tracking-wide">
                  <Smartphone size={12} className="text-emerald-400" />
                  <span>{isBn ? '৩. সুপার রিচার্জ বিক্রি' : '3. High-Profit Mobile Recharge'}</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed font-semibold">
                  {isBn 
                    ? 'জিপি, রবি, এয়ারটেল, বাংলালিংক, বা টেলিটক নাম্বারে পিন নম্বর ব্যবহার করে যেকোনো সফল মোবাইল রিচার্জে পান অসাধারণ ২.৮৫% (৳২৮.৫০ প্রতি হাজার) কমিশন।'
                    : 'Perform target client topups to Grameenphone, Robi, Airtel, Banglalink, or Teletalk for an elite 2.85% return.'}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-xs uppercase tracking-wide">
                  <Award size={12} className="text-emerald-400" />
                  <span>{isBn ? '৪. বিল লাইভ পেমেন্ট' : '4. Bill Live Payments'}</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed font-semibold">
                  {isBn 
                    ? 'গ্রাহকদের যেকোনো বিদ্যুৎ, গ্যাস বা পানির জন্য বিল লাইভ পেমেন্ট করে নিশ্চিতভাবে প্রতি বিলে ফ্ল্যাট ৳১৫.০০ ফিক্সড ক্যাশব্যাক কমিশন পেয়ে যান।'
                    : 'Resolve smart utility bills for electricity or water, securing ৳15.00 fixed cashback per slip.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {guidelineTab === 'hundred' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3.5"
          >
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl flex items-start space-x-2.5 text-xs font-bold leading-relaxed">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p>
                {isBn 
                  ? 'জানুন কিভাবে একজন প্রফেশনাল এজেন্টের মতো আপনার অর্জিত কমিশন ব্যালেন্সের সম্পূর্ণ ১০০% মালিকানা নিজের ওয়ালেটে ধরে রাখবেন!' 
                  : 'Secret guide to completely securing and retaining 100% of your accumulated transaction commissions!'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-white/5 border border-amber-500/10 p-4 rounded-2xl space-y-2">
                <h5 className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                  <Zap size={11} className="text-amber-400" />
                  <span>{isBn ? 'ব্যাংক বা সেলফ-রিফিল ব্যবহার করুন' : 'Avoid Super Agent balance split'}</span>
                </h5>
                <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                  {isBn 
                    ? 'সাধারণ নিয়ম অনুযায়ী, আপনি যদি আপনার ওয়ালেট রানিং করতে সুপার এজেন্টের সরাসরি ব্যালেন্স গ্রহণ করেন, তবে কমিশন উত্তোলনের সময় অর্জিত কমিশনের মাত্র ৩০% পাবেন এবং বাকি ৭০% কমিশন ডিস্ট্রিবিউশন সিস্টেমে সুপার এজেন্ট কেটে রাখবে।'
                    : 'Taking funds directly from a Super Agent splits commissions. In those cases, you keep only 30% while the system returns 70% of commission to the super agent.'}
                </p>
                <p className="text-[11px] text-amber-300 leading-relaxed font-black border-t border-white/5 pt-2">
                  {isBn 
                    ? '💡 ট্রিকস: আপনি যদি নিজের ফান্ড বা ব্যাংক সরাসরি ট্রান্সফারের মাধ্যমে ৩ নং "রিফিল" ট্যাব থেকে রিকোয়েস্ট পাঠিয়ে ডিস্ট্রিবিউটর দ্বারা ওয়ালেট ফান্ড পূর্ণ করেন, তবে আপনার উপার্জিত কমিশনের সম্পূর্ণ ১০০% আপনার একক প্রোফাইল একাউন্টেই থেকে যাবে!'
                    : '💡 Pure 100% Strategy: Always use the bottom "Refill" tab with direct Bank Transfers or Cash Deposits. Fund acquired from distributors directly bypasses splitting, keeping 100% commissions in your hands!'}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-1">
                <h5 className="text-[11px] font-black text-white uppercase tracking-wider">
                  {isBn ? 'নিরাপত্তা ও পিন অত্যন্ত গুরুত্বপূর্ণ' : 'Operational safety & PIN protection'}
                </h5>
                <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                  {isBn 
                    ? 'আপনার গোপন পিন কারো সাথে শেয়ার করবেন না। প্রতিটি পেমেন্ট নিশ্চিত করার পূর্বে গ্রাহক মোবাইল ও টাকার পরিমাণ পুনরায় যাচাই করুন এবং ১০০% স্বচ্ছতা বজায় রাখুন।'
                    : 'Never share your Agent PIN. Double-check number accuracy before executing transactions to ensure zero transaction errors and preserve 100% profits.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {guidelineTab === 'refer' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3.5"
          >
            <div className="p-4 bg-rose-500/10 border border-rose-500/15 rounded-2xl text-[11px] leading-relaxed text-rose-300 font-bold">
              {isBn 
                ? 'রয়্যাল রেফারেল নেটওয়ার্ক প্রোগ্রাম: এজেন্টের আমন্ত্রণে এজেন্ট যোগ করান এবং দুই স্তরের আকর্ষণীয় ডাবল রেফার লাইভ বোনাস ঘরে তুলুন।' 
                : 'Referral Gateway: Invite friend agents using your link and unlock double tier high commission rewards.'}
            </div>

            <div className="space-y-2.5">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-[11px] uppercase tracking-wide mb-1.5">
                  <Share2 size={11} className="text-rose-400" />
                  <span>{isBn ? '১. আমন্ত্রণ লিংক শেয়ার করুন' : '1. Spread your Referral Link'}</span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                  {isBn 
                    ? 'আপনার প্রোফাইল ট্যাব থেকে রেফারেল শেয়ার কোড বা ইউনিক লিংকটি কপি করে নতুন এজেন্টদের প্রদান করুন। রেজিস্টার করার সময় তারা আপনার এই বিশেষ কোডটি রেফার বক্সে ইনপুট করবে।'
                    : 'Navigate to Profile dashboard, copy unique Invitation link, and share with agent partners to bind their new profiles during sign up.'}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-[11px] uppercase tracking-wide mb-1.5">
                  <Coins size={11} className="text-emerald-400" />
                  <span>{isBn ? '২. ৫০০ টাকা এককালীন ক্যাশ বোনাস (স্থায়ী)' : '2. ৳500 Mega Cash Reward'}</span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                  {isBn 
                    ? 'নতুন আমন্ত্রিত এজেন্ট ভেরিফিকেশন লিংক বা আইডি দিয়ে আবেদন সম্পূর্ণ করার পর, সুপার পার্টনার কর্তৃক সেই রেফার আবেদনটি অনুমোদিত বা ভেরিফাই হওয়া মাত্র আমন্ত্রক বা স্পন্সর হিসেবে আপনার একাউন্টে তাৎক্ষণিকভাবে সরাসরি নগদ ৫০০ টাকা বোনাস ব্যালেন্স যুক্ত হয়ে যাবে।'
                    : 'The moment super partner approves the invitee referral request from gateway window, ৳500 flat cash rewards will be credited instantly into your wallet.'}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center space-x-2 text-rose-350 font-black text-[11px] uppercase tracking-wide mb-1.5">
                  <TrendingUp size={11} className="text-pink-400 animate-pulse" />
                  <span>{isBn ? '৩. ১০% লাইফটাইম ক্যাশ কমিশন (আজীবন)' : '3. 10% Lifetime Commission Split'}</span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed font-semibold">
                  {isBn 
                    ? 'এটিই সেরা মাধ্যম! আপনার আমন্ত্রণে যুক্ত এজেন্টটি প্রতিদিন ড্যাশবোর্ড ব্যবহার করে যে পরিমাণ মোট দৈনিক কমিশন ইনকাম করবে, তার ১০% কন্ট্রিবিউশন আজীবন স্বয়ংক্রিয়ভাবে প্রতিদিন আপনার রেফারেল ওয়ালেটে জমা হতে থাকবে! তারা যত বেশি খেলবেন বা খেলানো ডিপোজিট তুলবেন, আপনার ফ্রি ইনকাম তত বাড়বে।'
                    : 'The crown feature! You automatically split and earn a massive 10% of their total daily commission earnings, credited regularly into your Refer Wallet live.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    );
  };

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
              
              {activeAction === 'cash_in' ? (
                renderDepositApprovalUI()
              ) : activeAction === 'cash_out' ? (
                renderWithdrawApprovalUI()
              ) : (
                <>
                  {activeAction === 'recharge' && (
                    <div className="bg-rose-500/10 border border-rose-500/15 p-3.5 rounded-2xl text-xs leading-relaxed text-rose-300 font-semibold mb-3">
                      📱 <strong>{language === 'bn' ? 'কমিশন ব্যালেন্স ব্যবহার নীতি:' : 'Commission Balance Rule:'}</strong>{' '}
                      {language === 'bn'
                        ? 'মোবাইল রিচার্জের সমমান টাকা শুধুমাত্র আপনার উপার্জিত কমিশন ব্যালেন্স (Commission Balance) থেকে কাটা হবে।'
                        : 'Double-check: The recharge amount will be deducted solely from your earned Commission Balance.'}
                    </div>
                  )}

                  {activeAction === 'bill_pay' && (
                    <div className="bg-rose-500/10 border border-rose-500/15 p-3.5 rounded-2xl text-xs leading-relaxed text-rose-300 font-semibold mb-3">
                      💡 <strong>{language === 'bn' ? 'কমিশন ব্যালেন্স ব্যবহার নীতি:' : 'Commission Balance Rule:'}</strong>{' '}
                      {language === 'bn'
                        ? 'বিল লাইভের সমমান টাকা শুধুমাত্র আপনার উপার্জিত কমিশন ব্যালেন্স (Commission Balance) থেকে কাটা হবে।'
                        : 'Double-check: The bill payment amount will be deducted solely from your earned Commission Balance.'}
                    </div>
                  )}

                  {/* Commission Withdrawal Fields */}
                  {activeAction === 'commission_withdraw' && (
                    <div className="space-y-4 mb-3">
                      <div className="bg-rose-500/10 border border-rose-500/15 p-3.5 rounded-2xl text-xs leading-relaxed text-rose-300 font-semibold">
                        💸 <strong>{language === 'bn' ? 'কমিশন উত্তোলন নীতি:' : 'Commission Withdraw Policy:'}</strong>{' '}
                        {language === 'bn'
                          ? 'আপনার উপার্জিত কমিশন ব্যালেন্স তুলতে নিচে পেমেন্ট মেথড, মোবাইল নাম্বার এবং পরিমাণ প্রদান করে আবেদন করুন।'
                          : 'To withdraw your commission balance, please provide the payment method, mobile number, and amount below.'}
                      </div>

                      {/* Payment Method Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
                          {language === 'bn' ? 'পেমেন্ট মেথড সিলেক্ট করুন' : 'Select Payment Method'}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { name: 'bKash', label: 'বিকাশ (bKash)', color: 'border-[#E2125D]/40 text-[#E2125D] bg-[#E2125D]/10' },
                            { name: 'Nagad', label: 'নগদ (Nagad)', color: 'border-[#F37021]/40 text-[#F37021] bg-[#F37021]/10' },
                            { name: 'Rocket', label: 'রকেট (Rocket)', color: 'border-[#8C3494]/40 text-[#8C3494] bg-[#8C3494]/10' }
                          ].map((method) => (
                            <button
                              key={method.name}
                              type="button"
                              onClick={() => {
                                setSelectedOperator(method.name);
                                setErrorMessage('');
                              }}
                              className={`py-2.5 px-2 text-[11px] font-black rounded-xl border text-center transition-all cursor-pointer ${
                                selectedOperator === method.name
                                  ? `${method.color} border-rose-500 scale-102 shadow-md`
                                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                              }`}
                            >
                              {method.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Recipient Number */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
                          {language === 'bn' ? 'মোবাইল নাম্বার' : 'Recipient Phone Number'}
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="01XXXXXXXXX"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pl-11 text-sm font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 tracking-widest text-white"
                          />
                          <Smartphone className="absolute left-4 top-3.5 text-white/40" size={18} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile Recharge fields */}
                  {activeAction === 'recharge' && (
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
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-455 focus:bg-white/10 text-white"
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
                        {activeAction === 'commission_withdraw' || activeAction === 'recharge' || activeAction === 'bill_pay'
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
                </>
              )}
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
            if (activeAction === 'commission_withdraw') {
              const withdrawLink = `${window.location.origin}${window.location.pathname}?commissionWithdrawId=${newTrxDetails.trxId}`;

              const handleCopyLink = () => {
                try {
                  navigator.clipboard.writeText(withdrawLink);
                  if (onShowToast) {
                    onShowToast(language === 'bn' ? 'আবেদন লিংক কপি করা হয়েছে!' : 'Application link copied to clipboard!', 'success');
                  }
                } catch (err) {
                  console.error(err);
                }
              };

              return (
                <div className="space-y-5 text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-pink-500/20 border border-pink-500/20 text-rose-300 rounded-full mb-2">
                    <CheckCircle size={36} className="fill-rose-500 text-slate-900 animate-bounce" />
                  </div>

                  <div>
                    <h4 className="text-lg font-black text-white">
                      {language === 'bn' ? 'আবেদন সম্পন্ন হয়েছে!' : 'Application Submitted!'}
                    </h4>
                    <p className="text-xs text-white/40 mt-0.5 font-bold">
                      {language === 'bn' ? 'আপনার কমিশন উত্তোলনের আবেদনটি জমা হয়েছে।' : 'Your commission withdrawal request has been logged.'}
                    </p>
                  </div>

                  {/* LINK & TELEGRAM INFO CARD */}
                  <div className="relative border border-white/10 rounded-3xl bg-slate-950/45 p-5 space-y-4 shadow-xl select-none">
                    <div className="space-y-1 text-left text-xs font-semibold font-sans">
                      <div className="flex justify-between items-center text-white/70">
                        <span>{language === 'bn' ? 'পেমেন্ট মেথড' : 'Payment Method'}</span>
                        <span className="font-extrabold text-rose-350">{newTrxDetails.extra}</span>
                      </div>
                      <div className="flex justify-between items-center text-white/70 pt-1.5 border-t border-white/5 mt-1.5">
                        <span>{language === 'bn' ? 'মোবাইল নাম্বার' : 'Mobile Number'}</span>
                        <span className="font-bold text-white font-mono">{newTrxDetails.dest}</span>
                      </div>
                      <div className="flex justify-between items-center text-white/70 pt-1.5 border-t border-white/5 mt-1.5">
                        <span>{language === 'bn' ? 'টাকার পরিমাণ' : 'Amount'}</span>
                        <span className="font-black text-rose-350 text-sm">৳ {newTrxDetails.amount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Copy Link box */}
                    <div className="space-y-2 border-t border-dashed border-white/10 pt-3 text-left">
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                        {language === 'bn' ? 'লিংকটি কপি করে টেলিগ্রামে পাঠান' : 'Copy link and share on Telegram'}
                      </span>
                      <div className="flex bg-slate-950 p-2 rounded-xl border border-white/10 items-center justify-between gap-2.5">
                        <span className="text-[10.5px] font-mono text-white/50 truncate grow select-all">
                          {withdrawLink}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-650 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer shrink-0"
                        >
                          {language === 'bn' ? 'কপি' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Contact Manager directly option */}
                    <div className="pt-2">
                      <a
                        href="https://t.me/bdwalletagent"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 bg-[#229ED9] hover:bg-[#1f93cb] text-white font-black text-xs uppercase rounded-xl tracking-wider select-none pointer-events-auto flex items-center justify-center space-x-2 shadow-lg shadow-[#229ED9]/20"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.03-.75 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.2z" />
                        </svg>
                        <span>{language === 'bn' ? 'টেলিগ্রাম ম্যানেজারের সাথে যোগাযোগ' : 'Contact Telegram Manager'}</span>
                      </a>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full bg-slate-800 hover:bg-slate-755 border border-white/10 text-white font-black text-xs py-3.5 rounded-2xl shadow-md transition-all active:scale-[98%] uppercase tracking-wider cursor-pointer"
                  >
                    {t.backBtn}
                  </button>
                </div>
              );
            }

            const computedComm = activeAction === 'recharge' 
              ? newTrxDetails.amount * 0.0285 
              : activeAction === 'cash_in' 
                ? newTrxDetails.amount * 0.05 
                : activeAction === 'cash_out' 
                  ? newTrxDetails.amount * 0.03 
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
                  ? (language === 'bn' ? 'ডিপোজিট অনুমোদন সফল' : 'DEPOSIT APPROVAL SUCCESSFUL')
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
                const labelType = activeAction === 'cash_in' 
                  ? (language === 'bn' ? 'ডিপোজিট অনুমোদন' : 'Deposit Approval') 
                  : (activeAction === 'cash_out' ? 'Cash Out' : 'Transaction');
                  
                const textDetail = `=== BD WALLET AGENT RECEIPT ===\n` +
                  `Type: ${labelType}\n` +
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

                {activeAction === 'recharge' && (
                  <div className="bg-orange-500/15 border border-orange-500/30 text-amber-300 rounded-2xl p-3.5 space-y-1 text-center animate-pulse">
                    <div className="text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-1 text-orange-400">
                      <span>⚠️ {language === 'bn' ? 'সুপার এডমিন নির্দেশনা' : 'SUPER ADMIN DIRECTIVE'}</span>
                    </div>
                    <p className="text-[11px] font-semibold leading-relaxed">
                      {language === 'bn' 
                        ? 'মোবাইল রিচার্জ সফল হয়েছে। দয়া করে এই অনুরোধটির একটি স্ক্রিনশট নিয়ে অবশ্যই সুপার এডমিনকে পাঠাবেন।' 
                        : 'Mobile recharge was successful. Please take a screenshot of this completed request and send it to the Super Admin.'}
                    </p>
                  </div>
                )}

                {activeAction === 'bill_pay' && (
                  <div className="bg-orange-500/15 border border-orange-500/30 text-amber-300 rounded-2xl p-3.5 space-y-1 text-center animate-pulse">
                    <div className="text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-1 text-orange-400">
                      <span>⚠️ {language === 'bn' ? 'সুপার এডমিন নির্দেশনা' : 'SUPER ADMIN DIRECTIVE'}</span>
                    </div>
                    <p className="text-[11px] font-semibold leading-relaxed">
                      {language === 'bn' 
                        ? 'বিল লাইভ সফল হয়েছে। দয়া করে এই অনুরোধটির একটি স্ক্রিনশট নিয়ে অবশ্যই সুপার এডমিনকে পাঠাবেন।' 
                        : 'Bill Live was successful. Please take a screenshot of this completed request and send it to the Super Admin.'}
                    </p>
                  </div>
                )}

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
