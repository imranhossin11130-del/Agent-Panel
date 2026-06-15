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
import { Wifi, Battery, Signal, Bell, CheckCircle2, ShieldCheck, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Firebase integrations
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
  
  // Simulated clock for mock smartphone status bar
  const [currentTime, setCurrentTime] = useState('');
  
  // Toast notifications for background simulated approvals
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Safe UI state controls for logout & demo PIN updates
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [newPinValue, setNewPinValue] = useState('');
  const [newPinError, setNewPinError] = useState('');

  // URL search parameter listener
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reqId = params.get('requestId');
    if (reqId) {
      setActiveRequestId(reqId);
    }
  }, []);

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
              avatarUrl: ''
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

  // Update live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
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
          avatarUrl: newProfile.avatarUrl || ''
        }, { merge: true });
      } catch (err) {
        console.error("Firestore balance sync failed:", err);
      }
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
      commission = amount * 0.003; // 0.3% commission for Cash In
    } else if (type === 'cash_out') {
      commission = amount * 0.0025; // 0.25% commission for Cash Out
    } else if (type === 'recharge') {
      commission = amount * 0.0285; // 2.85% commission for Mobile Recharge
    } else if (type === 'bill_pay') {
      commission = 15.00; // Flat ৳15.00 for bill payments
    }

    // 2. Adjust core balances
    setProfile(currentProfile => {
      let nextWallet = currentProfile.walletBalance;
      let nextCommission = currentProfile.commissionBalance;

      if (type === 'cash_in' || type === 'recharge' || type === 'bill_pay') {
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
        {/* Mock Notch / Top Speaker Island for Premium Aesthetic */}
        <div className="absolute top-0 inset-x-0 h-7 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-between px-6 shrink-0 select-none text-white">
          {/* Back Camera & Speaker Pillar Pill */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1 h-4 w-28 bg-slate-950 rounded-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-rose-500/40 border border-slate-900 rounded-full absolute right-3"></span>
          </div>
          
          {/* Status Bar Clock */}
          <span className="text-[11px] font-black text-white/80 tracking-wide font-mono">
            {currentTime}
          </span>

          {/* Status Signals & Network indices */}
          <div className="flex items-center space-x-1.5 text-white/60">
            <span className="text-[9px] font-black tracking-widest font-mono">Robi 4G</span>
            <Signal size={12} className="stroke-[2.5px] fill-current" />
            <Wifi size={12} className="stroke-[2.5px]" />
            <div className="flex items-center space-x-0.5">
              <span className="text-[8px] font-black font-mono">92%</span>
              <Battery size={13} className="shrink-0 stroke-[2px]" />
            </div>
          </div>
        </div>

        {/* Dynamic header - Offset by 7px for notch clearance */}
        {currentUser && currentUser.email !== 'bdwalletagent@gmail.com' && (
          <div className="mt-6 shrink-0">
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

      </div>
    </div>
  );
}
