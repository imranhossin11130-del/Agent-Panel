import { useState, useEffect } from 'react';
import { 
  getStoredProfile, 
  getStoredTransactions, 
  saveState, 
  getDailyStatsFromTransactions 
} from './mockData';
import { AgentProfile, Transaction, ActiveTab, Language, TransactionType, DailyStats } from './types';
import { Header } from './components/Header';
import { BalanceCards } from './components/BalanceCards';
import { StatsGrid } from './components/StatsGrid';
import { QuickActions } from './components/QuickActions';
import { BottomNav } from './components/BottomNav';
import { ActionSheets } from './components/ActionSheets';
import { HistoryTab } from './components/HistoryTab';
import { RefillTab } from './components/RefillTab';
import { ProfileTab } from './components/ProfileTab';
import { Bell, CheckCircle2, ShieldCheck, LogOut, Trophy, Coins, AlertTriangle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Firebase integrations
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { AuthScreen } from './components/AuthScreen';
import { SuperAdminPortal } from './components/SuperAdminPortal';

export default function App() {
  // Main states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<AgentProfile>(getStoredProfile());
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions());
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [language, setLanguage] = useState<Language>('bn');
  const [activeAction, setActiveAction] = useState<TransactionType | 'guidelines' | 'support' | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeCommissionWithdrawId, setActiveCommissionWithdrawId] = useState<string | null>(null);
  

  
  // Toast notifications for background simulated approvals
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Safe UI state controls for logout & demo PIN updates
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [newPinValue, setNewPinValue] = useState('');
  const [newPinError, setNewPinError] = useState('');

  // Referral URL state controls
  const [activeReferApprovalId, setActiveReferApprovalId] = useState<string | null>(null);
  const [pendingReferralReq, setPendingReferralReq] = useState<any | null>(null);
  const [loadingApprovalDetails, setLoadingApprovalDetails] = useState(false);

  // URL search parameter listener
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reqId = params.get('requestId');
    if (reqId) {
      setActiveRequestId(reqId);
    }
    const commId = params.get('commissionWithdrawId');
    if (commId) {
      setActiveCommissionWithdrawId(commId);
    }
    const rId = params.get('referApprovalId');
    if (rId) {
      setActiveReferApprovalId(rId);
    }
  }, []);

  // Effect to pull from Firestore on refer approval link click
  useEffect(() => {
    const loadReferRequest = async () => {
      if (!activeReferApprovalId) {
        setPendingReferralReq(null);
        return;
      }
      setLoadingApprovalDetails(true);
      try {
        const q = query(
          collection(db, 'referral_requests'),
          where('agentId', '==', activeReferApprovalId),
          where('status', '==', 'pending')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPendingReferralReq({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setPendingReferralReq(null);
        }
      } catch (err) {
        console.error("Referral fetch failure:", err);
      } finally {
        setLoadingApprovalDetails(false);
      }
    };
    loadReferRequest();
  }, [activeReferApprovalId]);

  // Auth synchronization listener
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubTransactions: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Fetch or initialize agent db settings from Firestore
        const docRef = doc(db, 'agents', user.uid);
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setProfile(snap.data() as AgentProfile);
          } else {
            const freshProfile: AgentProfile = {
              name: user.displayName || 'Agent Partner',
              phone: '+880 1792-345678',
              agentId: String(Math.floor(10000000 + Math.random() * 90000000)),
              walletBalance: 0.00, // Starts at 0.00 as per instructions
              commissionBalance: 0.00,
              isVerified: true,
              avatarUrl: '',
              referBalance: 0.00,
              referredBy: null,
              referStatus: 'idle',
              referWaitingUntil: null,
              referApprovalLink: null,
              referCount: 0,
            };
            await setDoc(docRef, {
              uid: user.uid,
              agentId: freshProfile.agentId,
              name: freshProfile.name,
              phone: freshProfile.phone,
              walletBalance: freshProfile.walletBalance,
              commissionBalance: freshProfile.commissionBalance,
              isVerified: freshProfile.isVerified,
              avatarUrl: freshProfile.avatarUrl,
              referBalance: freshProfile.referBalance,
              referredBy: freshProfile.referredBy,
              referStatus: freshProfile.referStatus,
              referWaitingUntil: freshProfile.referWaitingUntil,
              referApprovalLink: freshProfile.referApprovalLink,
              referCount: freshProfile.referCount,
              createdAt: new Date().toISOString()
            });
            setProfile(freshProfile);
          }
        } catch (e) {
          console.error("Failed loading Firebase Agent details:", e);
        }

        // Set up real-time listener for profile
        const { onSnapshot, collection } = await import('firebase/firestore');
        unsubProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as AgentProfile);
          }
        });

        // Set up real-time listener for transactions
        const trxsColl = collection(db, 'agents', user.uid, 'transactions');
        unsubTransactions = onSnapshot(trxsColl, (snap) => {
          const list: Transaction[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              type: data.type,
              phoneOrAccount: data.phoneOrAccount,
              operatorOrBiller: data.operatorOrBiller,
              amount: Number(data.amount || 0),
              commission: Number(data.commission || 0),
              timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
              status: data.status || 'SUCCESS'
            });
          });
          // Sort by timestamp descending
          list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setTransactions(list);
        });

      } else {
        setCurrentUser(null);
        if (unsubProfile) unsubProfile();
        if (unsubTransactions) unsubTransactions();
      }
      setAuthReady(true);
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
      if (unsubTransactions) unsubTransactions();
    };
  }, []);



  // Save changes to localStorage
  useEffect(() => {
    saveState(profile, transactions);
  }, [profile, transactions]);

  // Compute daily statistics dynamically
  const dailyStats: DailyStats = getDailyStatsFromTransactions(transactions);

  // Toggle Language
  const handleLanguageToggle = () => {
    setLanguage(prev => (prev === 'bn' ? 'en' : 'bn'));
  };

  // Helper to sync updated profiles directly to Firestore
  const updateProfileAndFirestore = async (newProfile: AgentProfile) => {
    setProfile(newProfile);
    if (auth.currentUser) {
      const docRef = doc(db, 'agents', auth.currentUser.uid);
      try {
        await setDoc(docRef, {
          uid: auth.currentUser.uid,
          agentId: newProfile.agentId,
          name: newProfile.name,
          phone: newProfile.phone,
          walletBalance: newProfile.walletBalance,
          commissionBalance: newProfile.commissionBalance,
          isVerified: newProfile.isVerified,
          avatarUrl: newProfile.avatarUrl || '',
          referBalance: newProfile.referBalance !== undefined ? newProfile.referBalance : 0.00,
          referredBy: newProfile.referredBy !== undefined ? newProfile.referredBy : null,
          referStatus: newProfile.referStatus !== undefined ? newProfile.referStatus : 'idle',
          referWaitingUntil: newProfile.referWaitingUntil !== undefined ? newProfile.referWaitingUntil : null,
          referApprovalLink: newProfile.referApprovalLink !== undefined ? newProfile.referApprovalLink : null,
          referCount: newProfile.referCount !== undefined ? newProfile.referCount : 0,
        }, { merge: true });
      } catch (err) {
        console.error("Firestore balance sync failed:", err);
      }
    }
  };

  const handleApproveReferralRequest = async (req: any) => {
    try {
      // 1. Update the referral request status to success
      const reqRef = doc(db, 'referral_requests', req.id);
      await updateDoc(reqRef, {
        status: 'success',
        updatedAt: new Date().toISOString()
      });

      // 2. Query sponsor's agent details using their code (referCode is the sponsor code)
      const sponsorQuery = query(collection(db, 'agents'), where('agentId', '==', req.referCode));
      const sponsorSnap = await getDocs(sponsorQuery);
      if (!sponsorSnap.empty) {
        const sponsorDoc = sponsorSnap.docs[0];
        const currentReferBalance = Number(sponsorDoc.data().referBalance || 0);
        const currentReferCount = Number(sponsorDoc.data().referCount || 0);
        
        // Add 500 BDT flat reward and increment referCount count
        await updateDoc(doc(db, 'agents', sponsorDoc.id), {
          referBalance: currentReferBalance + 500,
          referCount: currentReferCount + 1
        });
      }

      // 3. Update the applicant profile's status to 'approved'
      const applicantRef = doc(db, 'agents', req.agentUid);
      await updateDoc(applicantRef, {
        referStatus: 'approved',
        referredBy: req.referCode
      });

      // If active user is the applicant, update current profile state!
      if (auth.currentUser && auth.currentUser.uid === req.agentUid) {
        setProfile((prev) => prev ? { ...prev, referStatus: 'approved', referredBy: req.referCode } : null);
      }

      triggerToast(
        language === 'bn' 
          ? 'রেফারেল আবেদনটি সফলভাবে অনুমোদন করা হয়েছে এবং আমন্ত্রণকারী ৫০০ টাকা ব্যালেন্স পেয়েছেন!' 
          : 'Referral request approved successfully! sponsor gets 500 BDT.',
        'success'
      );
      setActiveReferApprovalId(null);
      setPendingReferralReq(null);
    } catch (err) {
      console.error(err);
      triggerToast(
        language === 'bn' ? 'অনুমোদন সম্পন্ন করতে ব্যর্থ হয়েছে।' : 'Approval processing failed.',
        'info'
      );
    }
  };

  const handleRejectReferralRequest = async (req: any) => {
    try {
      // 1. Update the referral request status to failed
      const reqRef = doc(db, 'referral_requests', req.id);
      await updateDoc(reqRef, {
        status: 'failed',
        updatedAt: new Date().toISOString()
      });

      // 2. Set applicant's referStatus to 'rejected' so they can submit again
      const applicantRef = doc(db, 'agents', req.agentUid);
      await updateDoc(applicantRef, {
        referStatus: 'rejected',
        referredBy: null
      });

      // If active user is the applicant, update current profile state
      if (auth.currentUser && auth.currentUser.uid === req.agentUid) {
        setProfile((prev) => prev ? { ...prev, referStatus: 'rejected', referredBy: null } : null);
      }

      triggerToast(
        language === 'bn' 
          ? 'আবেদনটি সফলভাবে প্রত্যাখ্যান করা হয়েছে!' 
          : 'Referral request rejected successfully!',
        'success'
      );
      setActiveReferApprovalId(null);
      setPendingReferralReq(null);
    } catch (err) {
      console.error(err);
      triggerToast(
        language === 'bn' ? 'বাতিল প্রক্রিয়া সম্পন্ন করতে ব্যর্থ হয়েছে।' : 'Rejection processing failed.',
        'info'
      );
    }
  };

  // Perform a new transaction (updates balance, statistics, records log)
  const handleNewTransaction = (
    type: TransactionType, 
    amount: number, 
    dest: string, 
    extra: string
  ) => {
    // 1. Calculate commissions
    let commission = 0;
    if (type === 'cash_in') {
      commission = amount * 0.05; // 5% commission for Player Deposit Approval
    } else if (type === 'cash_out') {
      commission = amount * 0.03; // 3% commission for Cash Out
    } else if (type === 'recharge') {
      commission = amount * 0.0285; // 2.85% commission for Mobile Recharge
    } else if (type === 'bill_pay') {
      commission = 15.00; // Flat ৳15.00 for bill payments
    }

    // 2. Adjust core balances
    setProfile(currentProfile => {
      let nextWallet = currentProfile.walletBalance;
      let nextCommission = currentProfile.commissionBalance;

      if (type === 'recharge' || type === 'bill_pay') {
        nextCommission -= amount;
        nextCommission += commission; // commission instantly added
      } else if (type === 'cash_in') {
        nextWallet -= amount;
        nextCommission += commission; // commission instantly added
      } else if (type === 'cash_out') {
        // Digital wallet receives client money, agent pays out physicial cash
        nextWallet += amount;
        nextCommission += commission; // commission instantly added
      } else if (type === 'agent_cash') {
        // Agent loads wallet
        nextWallet += amount;
      } else if (type === 'commission_withdraw') {
        // Transfer commission balance to wallet balance
        nextCommission -= amount;
        nextWallet += amount;
      }

      const updated = {
        ...currentProfile,
        walletBalance: nextWallet,
        commissionBalance: nextCommission
      };
      
      // Update Firebase Firestore
      if (auth.currentUser) {
        const docRef = doc(db, 'agents', auth.currentUser.uid);
        setDoc(docRef, {
          walletBalance: nextWallet,
          commissionBalance: nextCommission
        }, { merge: true }).catch(err => console.error("Firestore txn balance write error:", err));
      }

      return updated;
    });

    // 3. Log to transaction logs
    const newTrx: Transaction = {
      id: 'BN' + Math.random().toString(36).substr(2, 8).toUpperCase(),
      type,
      phoneOrAccount: dest,
      operatorOrBiller: extra,
      amount,
      commission,
      timestamp: new Date(),
      status: 'SUCCESS'
    };

    setTransactions(prev => [newTrx, ...prev]);

    // Triggers feedback toast
    if (type === 'commission_withdraw') {
      triggerToast(
        language === 'bn' 
          ? `৳${amount.toLocaleString()} কমিশন ব্যালেন্স সফলভাবে মূল ওয়ালেটে স্থানান্তরিত হয়েছে!` 
          : `৳${amount.toLocaleString()} commission transferred to main wallet successfully!`,
        'success'
      );
    }
  };

  // Triggers background refill auto-approvals
  const handleRefillSubmit = (amount: number) => {
    triggerToast(
      language === 'bn'
        ? `৳${amount.toLocaleString()} রিফিল রিকোয়েস্ট ডিস্ট্রিবিউটরের কাছে পাঠানো হয়েছে!`
        : `Refill request of ৳${amount.toLocaleString()} submitted to distributor!`,
      'info'
    );

    // After 4 seconds, automatically approve the refill and add funds to agent wallet!
    setTimeout(() => {
      setProfile(currentProfile => {
        const nextBal = currentProfile.walletBalance + amount;
        const updated = {
          ...currentProfile,
          walletBalance: nextBal
        };

        if (auth.currentUser) {
          const docRef = doc(db, 'agents', auth.currentUser.uid);
          setDoc(docRef, {
            walletBalance: nextBal
          }, { merge: true }).catch(err => console.error("Firestore refill sync error:", err));
        }

        return updated;
      });

      const newRefillTrx: Transaction = {
        id: 'REF' + Math.floor(Math.random() * 1000 + 1000),
        type: 'refill',
        phoneOrAccount: 'Dhaka Head Office (Dist)',
        amount,
        commission: 0,
        timestamp: new Date(),
        status: 'SUCCESS'
      };

      setTransactions(prev => [newRefillTrx, ...prev]);

      triggerToast(
        language === 'bn'
          ? `আপনার ৳${amount.toLocaleString()} রিকোয়েস্ট অনুমোদিত হয়েছে! ফান্ড ওয়ালেটে যোগ করা হয়েছে।`
          : `Your refill request of ৳${amount.toLocaleString()} has been APPROVED! Funds added.`,
        'success'
      );
    }, 4500);
  };

  const triggerToast = (message: string, type: 'success' | 'info') => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 5000);
  };

  const handleWithdrawCommissionQuick = () => {
    setActiveAction('commission_withdraw');
  };

  const handlePinChangeRequest = () => {
    setNewPinValue('');
    setNewPinError('');
    setShowPinReset(true);
  };

  const submitPinReset = () => {
    if (/^\d{4}$/.test(newPinValue)) {
      triggerToast(
        language === 'bn' 
          ? 'এজেন্ট পিন নম্বর সফলভাবে রিসেট করা হয়েছে!' 
          : 'Agent PIN reset successfully!',
        'success'
      );
      setShowPinReset(false);
    } else {
      setNewPinError(
        language === 'bn' 
          ? 'ভুল ফরম্যাট! শুধুমাত্র ৪ সংখ্যার পিন দিন।' 
          : 'Invalid format! Enter exactly 4 digits.'
      );
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setProfile(getStoredProfile());
      setActiveTab('home');
      setShowLogoutConfirm(false);
      triggerToast(
        language === 'bn'
          ? 'সাফল্যের সাথে লগআউট সম্পন্ন হয়েছে!'
          : 'Successfully logged out!',
        'success'
      );
    } catch (err) {
      console.error("Sign out fail: ", err);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-0 sm:p-4 selection:bg-rose-500 selection:text-white font-sans antialiased overflow-x-hidden">
      
      {/* Decorative Gradient Background Balls */}
      <div className="fixed top-[-10%] left-[-10%] w-72 h-72 rounded-full bg-rose-500/10 blur-3xl pointer-events-none hidden sm:block"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-80 h-80 rounded-full bg-pink-500/10 blur-3xl pointer-events-none hidden sm:block"></div>

      {/* Main Smartphone Shell Layer */}
      <div 
        id="smartphone-shell"
        className="
          w-full max-w-md h-screen sm:h-[92vh] sm:max-h-[850px] 
          bg-slate-950/60 backdrop-blur-2xl text-white 
          rounded-none sm:rounded-[3rem] 
          shadow-none sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] 
          border-none sm:border-[10px] sm:border-slate-800/80 
          overflow-hidden flex flex-col relative
        "
      >
        {/* Dynamic header */}
        {currentUser && currentUser.email !== 'bdwalletagent@gmail.com' && (
          <div className="mt-3 shrink-0">
            <Header 
              profile={profile} 
              language={language} 
              onLanguageToggle={handleLanguageToggle}
              onNotificationClick={() => {}}
              onLogout={handleLogout}
            />
          </div>
        )}

        {/* Simulated approval floating notification */}
        <AnimatePresence>
          {toastNotification && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-20 inset-x-4 mx-auto z-50 pointer-events-none"
            >
              <div className={`p-4 rounded-2xl shadow-xl flex items-start space-x-2.5 border text-xs font-black select-none pointer-events-auto leading-relaxed border-opacity-30 ${
                toastNotification.type === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' 
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/20'
              }`}>
                {toastNotification.type === 'success' ? (
                  <CheckCircle2 className="shrink-0 text-emerald-300 mt-0.5" size={16} />
                ) : (
                  <Bell className="shrink-0 text-rose-300 mt-0.5 animate-swing" size={16} />
                )}
                <p>{toastNotification.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive View Router Content Frame or Auth Screen */}
        {!authReady ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3.5 px-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-rose-500/10 border-t-rose-500 animate-spin"></div>
              <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-455" size={18} />
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-black tracking-widest text-rose-300 leading-tight">
                {language === 'bn' ? 'সংযোগ সুরক্ষিত করা হচ্ছে...' : 'Establishing Secure Gateway...'}
              </p>
              <span className="text-[8px] font-bold text-white/30 block mt-1">PCI-DSS SECURITY COMPLIANCE</span>
            </div>
          </div>
        ) : !currentUser ? (
          <div className="flex-1 flex flex-col mt-6 overflow-hidden">
            {activeRequestId && (
              <div className="mx-4 mb-2 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-350 text-[11px] font-bold rounded-2xl flex items-center space-x-2 shrink-0 select-none animate-pulse">
                <ShieldCheck size={16} className="shrink-0" />
                <span>{language === 'bn' ? 'আবেদনটি দেখতে সুপার এডমিন ইমেইলে লগইন করুন।' : 'Please sign in to Super Admin account to inspect.'}</span>
              </div>
            )}
            <AuthScreen 
              language={language}
              onLanguageToggle={handleLanguageToggle}
              onAuthSuccess={(loadedProfile) => {
                setProfile(loadedProfile);
                triggerToast(
                  language === 'bn' 
                    ? 'ড্যাশবোর্ডে প্রবেশ সফল হয়েছে!' 
                    : 'Access granted successfully!', 
                  'success'
                );
              }}
            />
          </div>
        ) : currentUser.email === 'bdwalletagent@gmail.com' ? (
          <div className="flex-1 flex flex-col mt-6 overflow-hidden">
            <SuperAdminPortal
              language={language}
              onLogout={handleLogout}
              activeRequestId={activeRequestId}
              onClearRequestId={() => {
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                setActiveRequestId(null);
              }}
              activeCommissionWithdrawId={activeCommissionWithdrawId}
              onClearCommissionWithdrawId={() => {
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                setActiveCommissionWithdrawId(null);
              }}
              onShowToast={triggerToast}
            />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto pb-24 bg-transparent">
            <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                <motion.div
                  key="home_screen"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col"
                >
                  {/* 1. Interactive Balances Row */}
                  <BalanceCards 
                    profile={profile} 
                    language={language} 
                    onWithdrawCommission={handleWithdrawCommissionQuick}
                  />

                  {/* 2. Today's Statistics Ledger Grid */}
                  <StatsGrid 
                    stats={dailyStats} 
                    language={language} 
                  />

                  {/* 3. Quick Service actions menu */}
                  <QuickActions 
                    language={language} 
                    onActionClick={(action) => {
                      if (action === 'history_log') {
                        setActiveTab('history');
                      } else if (action === 'refer') {
                        setActiveTab('profile');
                      } else {
                        setActiveAction(action);
                      }
                    }}
                  />
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div
                  key="history_screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <div className="px-4 py-3 shrink-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {language === 'bn' ? 'পূর্ণাঙ্গ ট্রানজেকশন হিস্টোরি' : 'Full Transaction History'}
                    </h3>
                    <span className="text-[10px] text-white/40 font-extrabold mt-0.5 block leading-tight">
                      {language === 'bn' ? 'সকল সার্ভিস ও রিফিল পেমেন্ট লগ' : 'Audit logs of all transactions'}
                    </span>
                  </div>
                  <HistoryTab transactions={transactions} language={language} />
                </motion.div>
              )}

              {activeTab === 'refill' && (
                <motion.div
                  key="refill_screen"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <div className="px-4 py-3 shrink-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {language === 'bn' ? 'এজেন্ট ওয়ালেট ফান্ড রিফিল' : ' replenishing agent funds'}
                    </h3>
                  </div>
                  <RefillTab 
                    language={language} 
                    profile={profile} 
                    onRefillSubmit={handleRefillSubmit} 
                  />
                </motion.div>
              )}

              {activeTab === 'profile' && (
                <motion.div
                  key="profile_screen"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <div className="px-4 py-3 shrink-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {language === 'bn' ? 'অ্যাকাউন্ট পার্টনার সেটিংস' : 'Merchant Partner Settings'}
                    </h3>
                  </div>
                  <ProfileTab 
                    profile={profile} 
                    language={language} 
                    onLanguageToggle={handleLanguageToggle}
                    onPinChangeRequest={handlePinChangeRequest}
                    onUpdateProfile={(name, avatarUrl) => {
                      const updatedProf = { ...profile, name, avatarUrl };
                      updateProfileAndFirestore(updatedProf);
                      triggerToast(
                        language === 'bn' 
                          ? 'প্রোফাইল সফলভাবে আপডেট করা হয়েছে!' 
                          : 'Profile updated successfully!',
                        'success'
                      );
                    }}
                    onUpdateProfileData={(data) => {
                      const updatedProf = { ...profile, ...data };
                      updateProfileAndFirestore(updatedProf);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        )}

        {/* Persistent elegant Bottom Navigation Bar */}
        {currentUser && currentUser.email !== 'bdwalletagent@gmail.com' && (
          <BottomNav 
            activeTab={activeTab} 
            onTabChange={(tab) => {
              setActiveTab(tab);
              setActiveAction(null); // auto close forms when switching tabs
            }} 
            language={language}
          />
        )}

        {/* Core Slide-up action modals (Recharge, cashin/out, utility bills, supports) */}
        <AnimatePresence>
          {activeAction && (
            <ActionSheets 
              activeAction={activeAction} 
              onClose={() => setActiveAction(null)}
              language={language}
              profile={profile}
              onNewTransaction={handleNewTransaction}
              onShowToast={triggerToast}
            />
          )}
        </AnimatePresence>

        {/* Custom Clean Logout Confirmation Overlay */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 select-none"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-455 rounded-2xl">
                    <LogOut size={22} className="stroke-[2.5px]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      {language === 'bn' ? 'লগআউট নিশ্চিত করুন' : 'Confirm Logout'}
                    </h4>
                    <span className="text-[10px] text-white/40 font-bold block mt-0.5">
                      {language === 'bn' ? 'নিরাপত্তা সেশন সমাপ্তি' : 'Secure Session Settlement'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-white/70 font-semibold leading-relaxed">
                  {language === 'bn' 
                    ? 'আপনি কি অ্যাপ্লিকেশন বা ড্যাশবোর্ড থেকে লগআউট করতে নিশ্চিত?' 
                    : 'Are you sure you want to log out from the application and close your active session?'}
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95"
                  >
                    {language === 'bn' ? 'ফিরে যান' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmLogout}
                    className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-pink-650 text-white rounded-2xl font-black text-xs uppercase cursor-pointer transition-all hover:opacity-95 active:scale-95 shadow-lg shadow-rose-500/20 active-glow"
                  >
                    {language === 'bn' ? 'লগআউট' : 'Log Out'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Clean PIN Change Modal Overlay */}
        <AnimatePresence>
          {showPinReset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 select-none"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-455 rounded-2xl">
                    <ShieldCheck size={22} className="stroke-[2.5px]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      {language === 'bn' ? 'এজেন্ট পিন পরিবর্তন' : 'Change Agent PIN'}
                    </h4>
                    <span className="text-[10px] text-white/40 font-bold block mt-0.5">
                      {language === 'bn' ? 'নিরাপত্তা সেটিং গেটওয়ে' : 'Security Setting Gateway'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                    {language === 'bn' ? 'নতুন ৪-সংখ্যার ডেমো এজেন্ট পিন' : 'New 4-digit demo agent PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="\d*"
                    value={newPinValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewPinValue(val);
                      if (val.length === 4) {
                        setNewPinError('');
                      }
                    }}
                    placeholder="••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 font-mono text-center text-sm font-extrabold focus:outline-hidden focus:ring-1 focus:ring-rose-455 text-white tracking-widest placeholder-white/20"
                  />
                  {newPinError && (
                    <span className="text-[10px] font-black text-rose-300 block pt-0.5">
                      {newPinError}
                    </span>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPinReset(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95"
                  >
                    {language === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    onClick={submitPinReset}
                    className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-pink-650 text-white rounded-2xl font-black text-xs uppercase cursor-pointer transition-all hover:opacity-95 active:scale-95 shadow-lg shadow-rose-500/20 active-glow"
                  >
                    {language === 'bn' ? 'নিশ্চিত করুন' : 'Confirm'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Super Agent Referral Verification Link Overlay Modal */}
        <AnimatePresence>
          {activeReferApprovalId && (
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
                className="w-full max-w-sm bg-slate-900 border border-orange-500/30 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 relative overflow-hidden"
              >
                <div className="absolute right-[-20px] top-[-20px] w-20 h-20 bg-orange-500/5 rounded-full blur-xl"></div>
                
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-350 rounded-2xl">
                    <Trophy size={22} className="stroke-[2.5px] text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      {language === 'bn' ? 'সুপার এজেন্ট রেফারেল অনুমোদন' : 'Referral Gateway Verification'}
                    </h4>
                    <span className="text-[10px] text-orange-450 font-bold block mt-0.5 uppercase tracking-wider">
                      {language === 'bn' ? 'নিবন্ধক সুপার পার্টনার উইন্ডো' : 'Super Agent Approval Panel'}
                    </span>
                  </div>
                </div>

                {loadingApprovalDetails ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-2">
                    <div className="w-8 h-8 rounded-full border-2 border-orange-500/10 border-t-orange-500 animate-spin"></div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-white/40">{language === 'bn' ? 'ডাটা লোড হচ্ছে...' : 'Loading Details...'}</span>
                  </div>
                ) : !pendingReferralReq ? (
                  <div className="text-center py-6 space-y-2">
                    <AlertTriangle size={24} className="text-red-400 mx-auto animate-pulse" />
                    <h5 className="text-xs font-black text-white uppercase tracking-wider">{language === 'bn' ? 'কোন পেন্ডিং আবেদন পাওয়া যায়নি!' : 'No Active Request Found'}</h5>
                    <p className="text-[10px] text-white/40 leading-relaxed max-w-[200px] mx-auto">
                      {language === 'bn' 
                        ? 'এই রেফারেল আবেদনটি ইতিমধ্যে অনুমোদিত বা বাতিল হয়ে গেছে।' 
                        : 'This referral application code might be already approved, rejected or expired.'}
                    </p>
                    <button
                      onClick={() => setActiveReferApprovalId(null)}
                      className="mt-2 py-1.5 px-4 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer transition-all active:scale-95"
                    >
                      {language === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-[11px] leading-relaxed space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-white/40">{language === 'bn' ? 'আবেদনকারী এজেন্ট' : 'Applicant Agent'}</span>
                        <strong className="text-white font-extrabold">{pendingReferralReq.agentName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">{language === 'bn' ? 'আবেদনকারীর মোবাইল' : 'Applicant Phone'}</span>
                        <strong className="text-white font-mono">{pendingReferralReq.agentPhone}</strong>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-2">
                        <span className="text-white/40">{language === 'bn' ? 'সামনে স্পন্সর কোড' : 'Inviter Sponsor Code'}</span>
                        <strong className="text-orange-350 font-mono select-all bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/15">{pendingReferralReq.referCode}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">{language === 'bn' ? 'আমন্ত্রণকারীর নাম' : 'Sponsor Agent Name'}</span>
                        <strong className="text-white">{pendingReferralReq.sponsorName}</strong>
                      </div>
                    </div>

                    <p className="text-[10px] text-white/50 leading-relaxed font-semibold">
                      {language === 'bn' 
                        ? 'অনুগ্রহ করে উপরের বিবরণ যাচাই করুন। অনুমোদন নিশ্চিত করলে আমন্ত্রক স্পন্সর এককালীন ৫০০ টাকা বোনাস পাবেন এবং আবেদনকারী এজেন্টের কোড স্থায়ীভাবে নিবন্ধিত হবে।' 
                        : 'Verifying this will instantly credit 500 BDT to the sponsor agent wallet and register the linked profile.'}
                    </p>

                    <div className="flex gap-3 pt-1 select-none">
                      <button
                        onClick={() => handleRejectReferralRequest(pendingReferralReq)}
                        className="flex-1 py-3 bg-red-500/15 border border-red-500/20 text-rose-300 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all hover:bg-red-500/25 active:scale-95"
                      >
                        {language === 'bn' ? 'বাতিল করুন' : 'Reject'}
                      </button>
                      <button
                        onClick={() => handleApproveReferralRequest(pendingReferralReq)}
                        className="flex-[1.5] py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 rounded-2xl font-black text-xs uppercase cursor-pointer transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-orange-500/15"
                      >
                        <Check size={14} className="stroke-[3px]" />
                        <span>{language === 'bn' ? 'অনুমোদন দিন' : 'Approve'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
