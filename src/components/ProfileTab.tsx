import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  PhoneCall, 
  ShieldAlert, 
  Globe, 
  History, 
  CheckCircle2, 
  HelpingHand,
  Settings,
  Lock,
  Edit2,
  Camera,
  X,
  Upload,
  Check,
  Gift,
  Coins,
  Copy,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { AgentProfile, Language } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ReferralLeaderboard } from './ReferralLeaderboard';

interface ProfileTabProps {
  profile: AgentProfile;
  language: Language;
  onLanguageToggle: () => void;
  onPinChangeRequest: () => void;
  onUpdateProfile?: (name: string, avatarUrl: string) => void;
  onUpdateProfileData?: (data: Partial<AgentProfile>) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  language,
  onLanguageToggle,
  onPinChangeRequest,
  onUpdateProfile,
  onUpdateProfileData,
}) => {
  const t = translations[language];
  const isBn = language === 'bn';

  // Profile Edit modal states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editAvatar, setEditAvatar] = useState(profile.avatarUrl || '');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Referral states
  const [referCodeInput, setReferCodeInput] = useState('');
  const [submittingRefer, setSubmittingRefer] = useState(false);
  const [referError, setReferError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [testApprovalLoading, setTestApprovalLoading] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    let interval: any;
    if (profile.referStatus === 'waiting' && profile.referWaitingUntil) {
      const updateTimer = () => {
        const diff = Math.max(0, Math.round((profile.referWaitingUntil! - Date.now()) / 1000));
        setTimeLeft(diff);
        if (diff <= 0) {
          clearInterval(interval);
          handleCountdownComplete();
        }
      };
      
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [profile.referStatus, profile.referWaitingUntil]);

  const handleCountdownComplete = () => {
    const link = `${window.location.origin}/?referApprovalId=${profile.agentId}`;
    if (onUpdateProfileData) {
      onUpdateProfileData({
        referStatus: 'waiting_approval',
        referApprovalLink: link
      });
    }
  };

  const handleReferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReferError(null);
    const code = referCodeInput.trim();
    
    if (!code) {
      setReferError(isBn ? 'অনুগ্রহ করে ৮-সংখ্যার রেফার কোড দিন!' : 'Please enter an 8-digit refer code!');
      return;
    }
    
    if (code === profile.agentId) {
      setReferError(isBn ? 'আপনি নিজের রেফার কোডটি ব্যবহার করতে পারবেন না!' : 'You cannot use your own referral code!');
      return;
    }

    if (!/^\d{8}$/.test(code)) {
      setReferError(isBn ? 'রেফার কোডটি অবশ্যই ৮-সংখ্যার সঠিক নম্বর হতে হবে!' : 'Refer code must be a valid 8-digit number!');
      return;
    }

    setSubmittingRefer(true);

    try {
      // Query to check if the sponsor agent profile exists
      const agentsQuery = query(collection(db, 'agents'), where('agentId', '==', code));
      const querySnap = await getDocs(agentsQuery);
      
      if (querySnap.empty) {
        setReferError(isBn ? 'এই রেফার কোডটি ডাটাবেজে পাওয়া যায়নি! দয়া করে সঠিক কোড দিন।' : 'Referral code not found in database! Please check and try again.');
        setSubmittingRefer(false);
        return;
      }

      const sponsorDoc = querySnap.docs[0].data();
      const sponsorUid = querySnap.docs[0].id;
      const sponsorName = sponsorDoc.name || 'Sponsor Agent';

      // Safe registration in referral_requests collection
      const requestId = 'REFP_' + Math.floor(100000 + Math.random() * 900000);
      const requestRef = doc(db, 'referral_requests', requestId);
      
      await setDoc(requestRef, {
        id: requestId,
        agentUid: auth.currentUser?.uid || 'unknown',
        agentId: profile.agentId,
        agentName: profile.name,
        agentPhone: profile.phone,
        referCode: code,
        sponsorUid: sponsorUid,
        sponsorName: sponsorName,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Update agent profile locally and firestore to: wait state for 60 seconds
      if (onUpdateProfileData) {
        onUpdateProfileData({
          referredBy: code,
          referStatus: 'waiting',
          referWaitingUntil: Date.now() + 60000,
          referApprovalLink: null
        });
      }

      setReferCodeInput('');
    } catch (err) {
      console.error(err);
      setReferError(isBn ? 'সার্ভার যোগাযোগ ত্রুটি! অনুগ্রহ করে আবার চেষ্টা করুন।' : 'Server communication failed. Please try again.');
    } finally {
      setSubmittingRefer(false);
    }
  };

  const handleWithdrawRefer = async () => {
    if (!profile.referBalance || profile.referBalance <= 0) return;
    setWithdrawLoading(true);
    try {
      const currentReferBalance = profile.referBalance || 0;
      const currentWalletBalance = profile.walletBalance || 0;
      
      if (onUpdateProfileData) {
        onUpdateProfileData({
          referBalance: 0,
          walletBalance: currentWalletBalance + currentReferBalance
        });
        
        // Inject a successful refill log transaction inside history subcollection
        const generatedId = 'REF_W' + Math.floor(1000 + Math.random() * 9000);
        await setDoc(doc(db, 'agents', auth.currentUser!.uid, 'transactions', generatedId), {
          id: generatedId,
          type: 'refill',
          phoneOrAccount: 'Refer Wallet',
          amount: currentReferBalance,
          commission: 0,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          operatorOrBiller: 'Referral Bonus Cashout'
        });
      }
      
      alert(isBn 
        ? `সাফল্যের সাথে ৳${currentReferBalance.toFixed(2)} রেফার ওয়ালেট থেকে আপনার প্রধান ওয়ালেট ব্যালেন্সে প্রত্যাহার করা হয়েছে!`
        : `Successfully withdrew ৳${currentReferBalance.toFixed(2)} from Refer Wallet to your main Wallet Balance!`
      );
    } catch (e) {
      console.error(e);
      alert(isBn ? 'উত্তোলন প্রক্রিয়াটি সফল হয়নি।' : 'Withdraw failed. Try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Beautiful Instant simulated approval cheat button for testing / presentation inside AI Studio iframe!
  const handleTestApprovalSimulate = async () => {
    setTestApprovalLoading(true);
    try {
      // Find the pending requests for this user
      const reqQuery = query(
        collection(db, 'referral_requests'), 
        where('agentUid', '==', auth.currentUser?.uid),
        where('status', '==', 'pending')
      );
      const reqSnap = await getDocs(reqQuery);
      
      if (!reqSnap.empty) {
        const reqDoc = reqSnap.docs[0];
        const reqData = reqDoc.data();
        
        // 1. Update request to success
        await updateDoc(doc(db, 'referral_requests', reqDoc.id), {
          status: 'success',
          updatedAt: new Date().toISOString()
        });

        // 2. Fetch invite owner profile to grant BDT 500
        const sponsorCode = reqData.referCode;
        const sponsorQuery = query(collection(db, 'agents'), where('agentId', '==', sponsorCode));
        const sponsorSnap = await getDocs(sponsorQuery);
        
        if (!sponsorSnap.empty) {
          const sponsorDoc = sponsorSnap.docs[0];
          const currentReferBal = Number(sponsorDoc.data().referBalance || 0);
          const currentReferCount = Number(sponsorDoc.data().referCount || 0);
          await updateDoc(doc(db, 'agents', sponsorDoc.id), {
            referBalance: currentReferBal + 500,
            referCount: currentReferCount + 1
          });
        }

        // 3. Update active user profile
        if (onUpdateProfileData) {
          onUpdateProfileData({
            referStatus: 'approved',
            referredBy: sponsorCode
          });
        }

        alert(isBn 
          ? 'অভিনন্দন! আপনার রেফারেল আবেদনটি সুপার এজেন্ট দ্বারা সফলভাবে অনুমোদিত হয়েছে এবং আমন্ত্রণকারী এজেন্ট ৫০০ টাকা বোনাস পেয়েছেন।' 
          : 'Congratulations! Your referral was successfully mock-approved and BDT 500 bonus is granted.'
        );
      } else {
        // If no request but user has pending sponsor in memory
        if (profile.referredBy && onUpdateProfileData) {
          onUpdateProfileData({
            referStatus: 'approved'
          });
          alert(isBn ? 'সফলভাবে টেস্ট অনুমোদন সম্পন্ন!' : 'Test approval complete!');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestApprovalLoading(false);
    }
  };

  const getFormatNum = (amount: number) => {
    if (language === 'bn') {
      return amount.toLocaleString('bn-BD', { minimumFractionDigits: 2 });
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  // Profile Picture File Upload Handler with Canvas Downscaling to preserve localStorage quota
  const handleImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 192;
        const MAX_HEIGHT = 192;
        let width = img.width;
        let height = img.height;

        // Auto square crop center
        const size = Math.min(width, height);
        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            (width - size) / 2, (height - size) / 2, size, size, // source crop
            0, 0, MAX_WIDTH, MAX_HEIGHT // destination stretch
          );
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setEditAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const handleSaveProfile = () => {
    if (!editName.trim()) return;
    if (onUpdateProfile) {
      onUpdateProfile(editName.trim(), editAvatar);
    }
    setIsEditing(false);
  };

  const startEditProfile = () => {
    setEditName(profile.name);
    setEditAvatar(profile.avatarUrl || '');
    setIsEditing(true);
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in px-4 pt-1">
      
      {/* Visual Business Card */}
      <div className="relative overflow-hidden glass-card rounded-3xl p-5 text-white">
        {/* Absolute glow design */}
        <div className="absolute right-[-20px] bottom-[-20px] w-32 h-32 bg-rose-500/10 rounded-full blur-2xl"></div>

        {/* Edit Button overlay inside the card */}
        <button 
          onClick={startEditProfile}
          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-rose-300 rounded-full transition-all focus:outline-hidden"
          title={t.editProfile}
        >
          <Edit2 size={13} />
        </button>

        <div className="flex items-center space-x-4">
          <div className="relative cursor-pointer group" onClick={startEditProfile}>
            <img
              src={profile.avatarUrl || `/src/assets/images/meghla_maya_avatar_1781538356391.jpg`}
              alt={profile.name}
              className="w-16 h-16 rounded-full border-2 border-rose-500/30 object-cover shadow-md group-hover:border-rose-455 transition-all"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/agent/150/150';
              }}
            />
            <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-slate-900 rounded-full w-5 h-5 flex items-center justify-center shadow-xs">
              <span className="block w-2 h-2 bg-white rounded-full"></span>
            </div>
            {/* Hover Camera indicator */}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={14} className="text-white" />
            </div>
          </div>

          <div>
            <span className="flex items-center text-[9px] font-black tracking-widest uppercase bg-rose-500/25 border border-rose-500/30 px-2 py-0.5 rounded-full w-max mt-1 text-rose-300">
              <CheckCircle2 size={10} className="mr-1 fill-rose-300 text-slate-900" />
              {t.verifiedAgent}
            </span>
            <h3 className="text-base font-black tracking-tight text-white mt-1 flex items-center">
              <span>{profile.name}</span>
            </h3>
            <p className="text-[10px] text-white/50 font-extrabold mt-0.5">Meghla Communications Ltd.</p>
          </div>
        </div>

        {/* Business address card */}
        <div className="border-t border-white/5 my-4 pt-3.5 space-y-2 text-xs text-white/70 font-semibold">
          <div className="flex items-center space-x-2">
            <User size={13} className="text-rose-300 shrink-0 opacity-80" />
            <span>{t.agentIdLabel}: <strong className="font-mono text-white select-all">{profile.agentId}</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin size={13} className="text-rose-300 shrink-0 opacity-80" />
            <span>{language === 'bn' ? 'মিরপুর ১০, ঢাকা - ১২১৬' : 'Mirpur 10, Dhaka - 1216, Bangladesh'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <PhoneCall size={13} className="text-rose-300 shrink-0 opacity-80" />
            <span className="font-mono">{profile.phone}</span>
          </div>
        </div>
      </div>

      {/* Financial stats tally block */}
      <div className="glass-card rounded-3xl p-5 space-y-3">
        <h4 className="text-xs font-black text-white/70 uppercase tracking-widest">{t.agentDetails}</h4>
        
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-white/5 border border-white/15 p-3 rounded-2xl">
            <span className="text-[9px] text-white/40 font-black block uppercase tracking-wide">{language === 'bn' ? 'মোট ওয়ালেট সীমা' : 'Total Wallet Limit'}</span>
            <strong className="text-xs font-black text-white tracking-tight block mt-1">৳ {getFormatNum(profile.walletBalance + 1500000)}</strong>
          </div>
          <div className="bg-white/5 border border-white/15 p-3 rounded-2xl">
            <span className="text-[9px] text-white/40 font-black block uppercase tracking-wide">{language === 'bn' ? 'উপার্জিত কমিশন' : 'Comms Earned'}</span>
            <strong className="text-xs font-black text-rose-300 tracking-tight block mt-1">৳ {getFormatNum(profile.commissionBalance)}</strong>
          </div>
        </div>
      </div>

      {/* REFERRAL REWARDS & WALLET SECURE PLATFORM */}
      <div id="referral-bonus-panel" className="glass-card rounded-3xl p-5 space-y-4 border border-orange-500/25 relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-orange-500/10 rounded-full blur-xl"></div>
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[9px] text-orange-400 font-black tracking-wider uppercase block">{isBn ? 'রেফারেল বোনাস ও ওয়ান-টাইম ওয়ালেট' : 'REFERRAL REWARD & WALLET'}</span>
            <h4 className="text-xs font-black text-white">{isBn ? 'রেফারেল ওয়ালেট ও বোনাস সিস্টেম' : 'Referral Reward System'}</h4>
          </div>
          <div className="p-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-350 rounded-xl">
            <Trophy size={14} />
          </div>
        </div>

        {/* Refer Wallet Balance Display */}
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] text-orange-300 font-extrabold flex items-center gap-1">
              <Coins size={11} className="text-orange-300" />
              {isBn ? 'রেফার ওয়ালেট ব্যালেন্স' : 'Refer Wallet Balance'}
            </span>
            <strong className="text-base font-black text-white tracking-tight block">
              ৳ {getFormatNum(profile.referBalance || 0)}
            </strong>
          </div>
          
          <button
            onClick={handleWithdrawRefer}
            disabled={!profile.referBalance || profile.referBalance <= 0 || withdrawLoading}
            className={`
              px-4 py-2 rounded-xl font-black text-[10px] uppercase cursor-pointer select-none transition-all duration-200 active:scale-95 flex items-center gap-1
              ${profile.referBalance && profile.referBalance > 0
                ? 'bg-orange-500 hover:bg-orange-600 text-slate-950 hover:shadow-lg hover:shadow-orange-500/20'
                : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
              }
            `}
          >
            {withdrawLoading ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : (
              <Coins size={11} />
            )}
            <span>{isBn ? 'উত্তোলন করুন' : 'Withdraw'}</span>
          </button>
        </div>

        {/* Info list */}
        <div className="text-[10px] space-y-1.5 bg-white/5 p-3 rounded-2xl text-white/70 font-semibold border border-white/5 leading-relaxed">
          <p className="flex items-start gap-1">
            <span className="text-orange-300 text-xs leading-none shrink-0">★</span>
            <span>{isBn ? 'নিবন্ধন সফল হলে আমন্ত্রণকারী এজেন্ট এককালীন ৫০০ টাকা রেফারেল বোনাস পাবেন।' : 'Successful registrations award 500 BDT flat one-time bonus.'}</span>
          </p>
          <p className="flex items-start gap-1">
            <span className="text-orange-300 text-xs leading-none shrink-0">★</span>
            <span>{isBn ? 'আমন্ত্রিত এজেন্ট প্রতিদিন যে পরিমাণ কমিশন অর্জন করবেন, তার ১০% আপনার এই Refer Wallet-এ জমা হবে।' : 'Earn 10% daily commission of called friends.'}</span>
          </p>
        </div>

        {/* Form or Waiting Countdown etc */}
        {(!profile.referStatus || profile.referStatus === 'idle' || profile.referStatus === 'rejected') ? (
          /* Submission form */
          <form onSubmit={handleReferSubmit} className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[9px] text-white/50 uppercase font-black tracking-wider block">
                {isBn ? 'আমন্ত্রণকারী এজেন্টের রেফার কোড সাবমিট' : 'Sponsor Refer Code Submission'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={8}
                  placeholder={isBn ? 'যেমন: 30149028 (৮-সংখ্যা)' : 'e.g. 30149028'}
                  value={referCodeInput}
                  onChange={(e) => setReferCodeInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 font-mono tracking-widest focus:outline-hidden focus:border-orange-500/50"
                  disabled={submittingRefer}
                />
                <button
                  type="submit"
                  disabled={submittingRefer}
                  className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500 text-orange-300 hover:text-slate-950 font-black text-[10px] uppercase rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {submittingRefer ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <span>{isBn ? 'সাবমিট' : 'Submit'}</span>
                  )}
                </button>
              </div>
            </div>
            
            {referError && (
              <div className="p-2 bg-red-500/15 border border-red-500/20 text-rose-300 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-bounce-in leading-relaxed">
                <AlertTriangle size={12} className="shrink-0 text-red-400" />
                <span>{referError}</span>
              </div>
            )}
          </form>
        ) : profile.referStatus === 'waiting' ? (
          /* Countdown waiting screen */
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-orange-500/15 text-center space-y-3 animate-fade-in">
            <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-orange-500/10 border-t-orange-500 animate-spin"></div>
              <span className="font-mono text-xs font-black text-orange-400">{timeLeft}s</span>
            </div>
            <div className="space-y-1">
              <h5 className="text-[11px] font-black text-white uppercase tracking-wider">{isBn ? 'ভেরিফিকেশন চলছে... অনুগ্রহ করে ১ মিনিট অপেক্ষা করুন' : 'Processing... Please wait 1 minute'}</h5>
              <p className="text-[9px] text-white/50 max-w-[240px] mx-auto leading-relaxed">
                {isBn 
                  ? 'আপনার অনুরোধটি ১ মিনিটের জন্য অপেক্ষমান রয়েছে। ব্যাকঅ্যান্ড যাচাই শেষ হলে এপ্রুভাল লিংক তৈরি হবে যা আপনি সুপার এজেন্টের কাছে পাঠাবেন।' 
                  : 'Sponsor verification is underway. Approval Link will automatically generate in 1 minute.'}
              </p>
            </div>
          </div>
        ) : profile.referStatus === 'waiting_approval' ? (
          /* Waiting approval code / shareable link */
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-orange-500/25 space-y-3 animate-fade-in relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] w-16 h-16 bg-orange-500/5 rounded-full blur-md"></div>
            
            <div className="space-y-1">
              <span className="text-[8px] bg-amber-500/15 text-amber-300 font-extrabold px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">{isBn ? 'যাচাই সম্পন্ন' : 'Step 1 Passed'}</span>
              <h5 className="text-xs font-black text-white">{isBn ? 'সুপার এজেন্ট এপ্রুভাল লিংক' : 'Super Agent Approval Link'}</h5>
              <p className="text-[9px] text-white/60 leading-relaxed">
                {isBn 
                  ? 'আপনার ১ মিনিট অপেক্ষা করার সময় পূর্ণ হয়েছে এবং একটি Approval Link তৈরি হয়েছে। নিচের লিংকটি আপনার সুপার এজেন্টের কাছে প্রেরণ করুন:'
                  : 'Sponsor validation completed. Please copy the generated link and send to your active Super Agent to finalize registration:'}
              </p>
            </div>

            {/* Approval Link Input display */}
            <div className="flex gap-1.5">
              <input
                type="text"
                readOnly
                value={profile.referApprovalLink || `${window.location.origin}/?referApprovalId=${profile.agentId}`}
                className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-[9px] text-white/80 font-mono focus:outline-hidden"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(profile.referApprovalLink || `${window.location.origin}/?referApprovalId=${profile.agentId}`);
                  alert(isBn ? 'এপ্রুভাল লিঙ্ক কপি হয়েছে!' : 'Approval Link copied to clipboard!');
                }}
                className="p-2 bg-orange-500 text-slate-950 hover:bg-orange-600 rounded-xl font-bold cursor-pointer transition-all active:scale-95 flex items-center justify-center shrink-0"
                title={isBn ? 'কপি করুন' : 'Copy'}
              >
                <Copy size={11} />
              </button>
            </div>

            {/* Simulated Live Test / WhatsApp trigger helper */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
              <button
                onClick={() => {
                  window.open(profile.referApprovalLink || `${window.location.origin}/?referApprovalId=${profile.agentId}`, '_blank');
                }}
                className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black text-[9px] uppercase tracking-wider cursor-pointer text-center"
              >
                {isBn ? 'সরাসরি চ্যাট লিংকে ভিউ করুন' : 'Open in New Tab'}
              </button>

              {/* Seamless AI Studio review-mode Fast Approval Bypass Button */}
              <button
                onClick={handleTestApprovalSimulate}
                disabled={testApprovalLoading}
                className="w-full py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 rounded-xl font-black text-[9px] uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1 active-glow"
              >
                {testApprovalLoading ? (
                  <RefreshCw size={10} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={10} />
                )}
                <span>{isBn ? 'সুপার এজেন্ট হিসেবে ইনস্ট্যান্ট অনুমোদন সিমুলেট করুন' : 'Simulate One-Click Approval'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Approved / Success Completed state */
          <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/15 text-center space-y-2 animate-fade-in relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] w-12 h-12 bg-emerald-500/10 rounded-full blur-md"></div>
            <Trophy size={18} className="text-emerald-400 mx-auto animate-bounce" />
            <div className="space-y-1">
              <h5 className="text-[11px] font-black text-white uppercase tracking-wider">{isBn ? 'রেফারেল সফলভাবে সক্রিয়!' : 'Referral Fully Active!'}</h5>
              <p className="text-[9px] text-white/50 leading-relaxed font-semibold">
                {isBn 
                  ? `আপনার আমন্ত্রণকারী কোড: ${profile.referredBy} সফলভাবে ড্যাশবোর্ডের সাথে যুক্ত আছে। আপনার আমন্ত্রিত এজেন্টের অর্জিত ডেইলি কমিশনের ১০% লাইফটাইম রেফারেল কমিশন স্বয়ংক্রিয়ভাবে আপনার রেফার ওয়ালেটে জমা হচ্ছে!` 
                  : `Your referral sponsor ${profile.referredBy} is permanently active. Earn 10% daily lifetime cash commission.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Referral Leaderboard Component */}
      <ReferralLeaderboard language={language} currentProfile={profile} />

      {/* Interactive configurations & settings list */}
      <div className="glass-card rounded-3xl divide-y divide-white/5 overflow-hidden">
        
        {/* Dynamic Edit Profile Trigger Row */}
        <button
          onClick={startEditProfile}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer text-left focus:outline-hidden"
        >
          <div className="flex items-center space-x-3 text-white/80">
            <div className="p-2 bg-rose-500/10 text-rose-300 rounded-xl border border-rose-500/20">
              <User size={16} />
            </div>
            <div>
              <span className="text-xs font-black block text-white">{t.editProfile}</span>
              <span className="text-[9px] text-white/40 font-bold block">{t.editProfileDesc}</span>
            </div>
          </div>
          <Edit2 size={14} className="text-white/40" />
        </button>

        {/* Language Toggler */}
        <button
          onClick={onLanguageToggle}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer text-left focus:outline-hidden"
        >
          <div className="flex items-center space-x-3 text-white/80">
            <div className="p-2 bg-white/5 text-white/80 rounded-xl border border-white/10">
              <Globe size={16} />
            </div>
            <div>
              <span className="text-xs font-black block text-white">{t.languageToggle}</span>
              <span className="text-[9px] text-white/40 font-bold block">{language === 'bn' ? 'বাংলা থেকে ইংরেজি করুন' : 'Switch English to Bengali'}</span>
            </div>
          </div>
          <span className="text-xs font-black text-rose-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">{language === 'bn' ? 'ENGLISH' : 'বাংলা'}</span>
        </button>

        {/* Change Pin Button */}
        <button
          onClick={onPinChangeRequest}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer text-left focus:outline-hidden"
        >
          <div className="flex items-center space-x-3 text-white/80">
            <div className="p-2 bg-white/5 text-white/80 rounded-xl border border-white/10">
              <Lock size={16} />
            </div>
            <div>
              <span className="text-xs font-black block text-white">{t.changePin}</span>
              <span className="text-[9px] text-white/40 font-bold block">{language === 'bn' ? 'এজেন্ট সিকিউরিটি ৪-সংখ্যার পিন পরিবর্তন' : 'Change 4-digit security PIN'}</span>
            </div>
          </div>
          <Settings size={16} className="text-white/40" />
        </button>

        {/* Security Certificate Status */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-white/80">
            <div className="p-2 bg-white/5 text-white/80 rounded-xl border border-white/10">
              <ShieldAlert size={16} />
            </div>
            <div>
              <span className="text-xs font-black block text-white">{t.statusLabel}</span>
              <span className="text-[9px] text-white/40 font-bold block">PCI-DSS Level 1 Secure Channel</span>
            </div>
          </div>
          <span className="text-[9px] bg-emerald-500/15 text-emerald-300 font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/25 uppercase tracking-widest">{language === 'bn' ? 'সরাসরি অ্যাক্টিভ' : 'active'}</span>
        </div>

        {/* Quick Helpline Center Call */}
        <a
          href="tel:16247"
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer text-left focus:outline-hidden"
        >
          <div className="flex items-center space-x-3 text-white/80">
            <div className="p-2 bg-white/5 text-white/80 rounded-xl border border-white/10">
              <HelpingHand size={16} />
            </div>
            <div>
              <span className="text-xs font-black block text-white">{t.helpCenter}</span>
              <span className="text-[9px] text-white/40 font-bold block">{language === 'bn' ? '১৬২৪৭ নম্বরে সরাসরি কল দিন' : 'Call 16247 or write helpdesk'}</span>
            </div>
          </div>
          <span className="text-[9px] bg-rose-500/15 text-rose-300 font-black px-2.5 py-1 rounded-full border border-rose-500/25 tracking-widest text-nowrap font-mono">{language === 'bn' ? 'কল করুন' : 'DIAL'}</span>
        </a>

      </div>

      {/* Edit Profile Beautiful Overlay Sheet */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-end justify-center z-50 p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-safe flex flex-col"
            >
              {/* Sheet grabber */}
              <div className="mx-auto my-2.5 w-12 h-1.5 bg-white/15 rounded-full shrink-0"></div>

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-5 pb-3 border-b border-white/5 shrink-0">
                <div className="flex flex-col">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {t.editProfile}
                  </h3>
                  <span className="text-[10px] text-white/40 font-extrabold leading-tight">
                    {t.editProfileDesc}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-colors active:scale-95 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4 overflow-y-auto">
                
                {/* Drag-and-drop Image Upload Box */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
                    {t.choosePhoto}
                  </label>

                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={openFileSelector}
                    className={`border-2 border-dashed rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-center cursor-pointer select-none ${
                      dragActive 
                        ? 'border-rose-455 bg-rose-500/10' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Preview circle */}
                    <div className="relative mb-2 shrink-0">
                      <img 
                        src={editAvatar || `/src/assets/images/meghla_maya_avatar_1781538356391.jpg`} 
                        alt="Preview" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-rose-500/30"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/agent/120/120';
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1 rounded-full border border-slate-900 shadow-sm">
                        <Camera size={11} />
                      </div>
                    </div>

                    <span className="text-xs font-bold text-white/80 block">
                      {t.choosePhoto}
                    </span>
                    <span className="text-[9px] text-white/40 font-semibold block mt-0.5">
                      {t.dragDropPhoto}
                    </span>
                  </div>
                </div>

                {/* Name Edit Input field */}
                <div className="space-y-1.5 mt-2">
                  <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
                    {t.fullName}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter Full Name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pl-11 text-sm font-bold focus:outline-hidden focus:ring-1 focus:ring-rose-455 text-white"
                      maxLength={32}
                    />
                    <User className="absolute left-4 top-3.5 text-white/40" size={16} />
                  </div>
                </div>

                {/* Confirm Save Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer text-center"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-650 text-white font-black text-xs rounded-xl active:scale-95 transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1 active-glow"
                  >
                    <Check size={14} />
                    <span>{t.saveChanges}</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

