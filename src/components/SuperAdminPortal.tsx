import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  LogOut, 
  Check, 
  X, 
  TrendingUp, 
  Eye, 
  ArrowRight, 
  AlertTriangle,
  Smartphone,
  Layers,
  Coins,
  CheckCircle,
  FileImage
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { Language } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SuperAdminPortalProps {
  language: Language;
  onLogout: () => void;
  activeRequestId: string | null;
  onClearRequestId: () => void;
  onShowToast: (message: string, type: 'success' | 'info') => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  language,
  onLogout,
  activeRequestId,
  onClearRequestId,
  onShowToast,
}) => {
  const isBn = language === 'bn';

  // Requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [rejectConfirmationRequest, setRejectConfirmationRequest] = useState<any | null>(null);

  // Fetch all pending requests from database or focus on URL request ID on mount
  const fetchRequests = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const q = query(
        collection(db, 'deposit_requests'),
        where('status', '==', 'pending')
      );
      const querySnap = await getDocs(q);
      const list: any[] = [];
      querySnap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRequests(list);

      // If activeRequestId is present, locate it inside list or fetch from database
      if (activeRequestId) {
        const found = list.find(r => r.id === activeRequestId);
        if (found) {
          setSelectedRequest(found);
        } else {
          // Fetch separately
          const singleRef = doc(db, 'deposit_requests', activeRequestId);
          const singleSnap = await getDoc(singleRef);
          if (singleSnap.exists()) {
            setSelectedRequest({ id: singleSnap.id, ...singleSnap.data() });
          } else {
            onShowToast(isBn ? 'অনুরোধটি পাওয়া যায়নি!' : 'Requested deposit not found!', 'info');
          }
        }
      }
    } catch (err) {
      console.error("Error fetching admin requests:", err);
      setErrorMessage(isBn ? 'ডাটাবেজ থেকে তথ্য লোড করতে সমস্যা হয়েছে।' : 'Error loading requests from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeRequestId]);

  // Approve action flow
  const handleApprove = async (req: any) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Update the request document status
      const reqRef = doc(db, 'deposit_requests', req.id);
      await updateDoc(reqRef, {
        status: 'success',
        updatedAt: new Date().toISOString()
      });

      // 2. Read Agent Document to load current balances
      const agentRef = doc(db, 'agents', req.agentUid);
      const agentSnap = await getDoc(agentRef);
      if (agentSnap.exists()) {
        const agentData = agentSnap.data();
        const currentWallet = Number(agentData.walletBalance || 0);
        const addedAmount = Number(req.amount || 0);

        const updatedPayload: any = {
          walletBalance: currentWallet + addedAmount
        };

        // If Super Agent requested, we set the safety flag on the Agent profile to lock commission caps
        if (req.type === 'super') {
          updatedPayload.hasTakenSuperBalance = true;
          updatedPayload.superBalanceTotal = Number(agentData.superBalanceTotal || 0) + addedAmount;
        }

        await updateDoc(agentRef, updatedPayload);

        // 3. Inject a successful transaction into agent logs
        const trxsRef = collection(db, 'agents', req.agentUid, 'transactions');
        const generatedId = 'REF' + Math.floor(1000 + Math.random() * 9000);
        await setDoc(doc(db, 'agents', req.agentUid, 'transactions', generatedId), {
          id: generatedId,
          type: 'refill',
          phoneOrAccount: 'Super Agent (01717-508278)',
          amount: addedAmount,
          commission: 0,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS',
          operatorOrBiller: req.type === 'super' ? 'Super Agent Balance (30%)' : 'Own Deposit'
        });
      }

      onShowToast(isBn ? 'সহযোগীর ডীপোজিট সফলভাবে অনুমোদিত হয়েছে!' : 'Agent deposit approved successfully!', 'success');
      setSuccessAnimation(true);
      setTimeout(() => {
        setSuccessAnimation(false);
        setSelectedRequest(null);
        onClearRequestId();
        fetchRequests();
      }, 2500);
    } catch (err) {
      console.error(err);
      setErrorMessage(isBn ? 'অনুমোদন প্রক্রিয়া সম্পূর্ণ করতে ত্রুটি হয়েছে।' : 'Failed to approve request. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reject action flow
  const handleReject = async (req: any) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const reqRef = doc(db, 'deposit_requests', req.id);
      await updateDoc(reqRef, {
        status: 'failed',
        updatedAt: new Date().toISOString()
      });

      onShowToast(isBn ? 'সহযোগীর আবেদনটি সফলভাবে বাতিল করা হয়েছে!' : 'Agent request rejected safely!', 'success');
      setSelectedRequest(null);
      setRejectConfirmationRequest(null);
      onClearRequestId();
      fetchRequests();
    } catch (err) {
      console.error(err);
      setErrorMessage(isBn ? 'প্রত্যাখ্যান প্রক্রিয়া সম্পন্ন করতে সমস্যা হয়েছে।' : 'Failed to reject request.');
    } finally {
      setLoading(false);
      setRejectConfirmationRequest(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden relative select-none">
      
      {/* Top Admin Header */}
      <div className="p-4 bg-slate-900 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-350 rounded-xl animate-pulse">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] text-[#f52b66] font-black uppercase tracking-widest block leading-none">SUPER ADMIN</span>
            <h2 className="text-xs font-black text-white/90 uppercase tracking-widest mt-0.5 font-sans">
              {isBn ? 'ডিপোজিট ভেরিফিকেশন' : 'VAL-PORTAL GATEWAY'}
            </h2>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/60 hover:text-white transition-all active:scale-95 flex items-center gap-1 cursor-pointer text-[10px] font-black tracking-wider uppercase"
        >
          <LogOut size={13} />
          <span>{isBn ? 'লগআউট' : 'Logout'}</span>
        </button>
      </div>

      {/* Main viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-500/20 border border-red-500/25 text-rose-200 text-xs font-bold rounded-2xl flex items-center space-x-2 animate-bounce-in leading-relaxed">
            <AlertTriangle size={15} className="shrink-0 text-rose-350" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successAnimation ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in select-none">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 flex items-center justify-center animate-bounce">
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">{isBn ? 'সফলভাবে অনুমোদিত!' : 'Approved Successfully!'}</h3>
              <p className="text-[10px] text-white/45 max-w-[250px] mx-auto mt-1 leading-relaxed">
                {isBn 
                  ? 'এজেন্টের ওয়ালেটে ব্যালেন্স যোগ করা হয়েছে এবং তার সার্ভিস ট্রানজেকশন রিকোয়েস্ট সফল দেখানো হয়েছে।' 
                  : 'Balances loaded and successfully synced with secure databases.'}
              </p>
            </div>
          </div>
        ) : selectedRequest ? (
          /* Focused request detailed view */
          <div className="glass-card rounded-2xl p-4.5 border border-white/15 space-y-4 select-none animate-fade-in">
            {/* Context meta */}
            <div className="flex justify-between items-center pb-2.5 border-b border-white/5 shrink-0">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  onClearRequestId();
                }}
                className="py-1 px-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-[9px] uppercase font-black tracking-widest cursor-pointer"
              >
                {isBn ? 'তালিকায় ফিরুন' : 'Back to list'}
              </button>
              
              <span className="text-[9px] font-mono text-rose-300 tracking-wider">REQ: #{selectedRequest.id.substring(0, 10).toUpperCase()}</span>
            </div>

            {/* Core details table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/45">{isBn ? 'এজেন্ট পার্টনার' : 'Agent Partner'}</span>
                <span className="font-extrabold text-white">{selectedRequest.agentName || "Agent Partner"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/45">{isBn ? 'এজেণ্টের মোবাইল' : 'Agent Phone'}</span>
                <span className="font-bold text-white tracking-widest font-mono">{selectedRequest.agentPhone}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-white/45">{isBn ? 'ডিপোজিটের মেথড' : 'Method'}</span>
                <span className="font-black text-rose-250 uppercase px-2 py-0.5 bg-rose-500/10 rounded-md border border-rose-500/15 text-[10px]">
                  {selectedRequest.type === 'own' ? selectedRequest.paymentMethod : 'SUPER AGENT'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/45">{selectedRequest.type === 'own' ? (isBn ? 'সোর্স মোবাইল নাম্বার' : 'Sender Mobile') : (isBn ? 'মোবাইল নাম্বার' : 'Refill Number')}</span>
                <span className="font-bold text-white tracking-widest font-mono">{selectedRequest.senderPhone || "N/A"}</span>
              </div>
              
              {selectedRequest.type === 'own' && (
                <div className="flex justify-between items-center">
                  <span className="text-white/45">{isBn ? 'ট্রাঞ্জেকশন আইডি' : 'Transaction ID'}</span>
                  <span className="font-extrabold text-indigo-300 tracking-widest font-mono select-all bg-white/5 px-2 py-0.5 rounded border border-white/10">{selectedRequest.trxId}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[13px] font-black">
                <span className="text-white/50">{isBn ? 'অনুরোধকৃত টাকার পরিমাণ' : 'Requested Amount'}</span>
                <span className="text-rose-350 tracking-wider font-extrabold">৳ {Number(selectedRequest.amount).toLocaleString()}</span>
              </div>
            </div>

            {/* screenshot viewer inside OWN mode */}
            {selectedRequest.type === 'own' && selectedRequest.screenshotUrl && (
              <div className="space-y-1.5 border-t border-white/5 pt-3">
                <span className="text-[10px] text-white/40 uppercase font-black tracking-wider block">{isBn ? 'লেনদেন পেমেন্ট স্ক্রিনশট' : 'Payment Screenshot'}</span>
                
                <div className="relative group rounded-xl border border-white/10 overflow-hidden bg-slate-950 flex items-center justify-center max-h-48">
                  <img 
                    src={selectedRequest.screenshotUrl} 
                    alt="Payment receipt" 
                    className="w-full h-full object-cover select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setViewScreenshotUrl(selectedRequest.screenshotUrl)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white/90 gap-1.5 cursor-pointer font-black text-[10px] uppercase tracking-wider"
                  >
                    <Eye size={16} />
                    <span>{isBn ? 'পূর্ণ স্ক্রিনে দেখুন' : 'View Full Image'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick action buttons for approval/rejections */}
            {selectedRequest.status !== 'pending' ? (
              <div className="pt-3 border-t border-white/5 text-center">
                <div className={`p-3 rounded-xl border font-black text-xs flex items-center justify-center gap-2 ${
                  selectedRequest.status === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-300 border-red-500/20'
                }`}>
                  <CheckCircle size={15} className={selectedRequest.status === 'success' ? 'text-emerald-400' : 'text-red-400'} />
                  <span>
                    {selectedRequest.status === 'success' 
                      ? (isBn ? 'এই আবেদনটি ইতিমধ্যে অনুমোদিত হয়েছে!' : 'This request has already been approved!')
                      : (isBn ? 'এই আবেদনটি ইতিমধ্যে প্রত্যাখ্যান করা হয়েছে!' : 'This request has already been rejected!')
                    }
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-white/5 flex gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setRejectConfirmationRequest(selectedRequest)}
                  disabled={loading}
                  className="flex-1 py-3 bg-red-500/15 border border-red-500/20 text-rose-300 rounded-xl font-black text-xs uppercase cursor-pointer transition-all hover:bg-red-500/25 active:scale-95 disabled:opacity-50"
                >
                  {isBn ? 'প্রত্যাখ্যান করুন' : 'Reject'}
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={loading}
                  className="flex-1.5 py-3 bg-gradient-to-r from-rose-500 to-pink-650 text-white rounded-xl font-black text-xs uppercase cursor-pointer transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 active-glow"
                >
                  <Check size={14} />
                  <span>{isBn ? 'অনুমোদন করুন' : 'Approve'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* General dashboard request list view */
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black text-white/40 uppercase tracking-widest shrink-0">
              <span>{isBn ? 'অপেক্ষমাণ অনুরোধের তালিকা' : 'Pending Requests'}</span>
              <span>{requests.length} {isBn ? 'টি বাকি' : 'Left'}</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-rose-500/10 border-t-rose-500 animate-spin"></div>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-white/40">{isBn ? 'লোডিংশ হচ্ছে...' : 'Loading Data...'}</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 bg-white/5 border border-white/5 rounded-2xl select-none text-white/40 space-y-1.5">
                <CheckCircle size={22} className="mx-auto text-emerald-350" />
                <p className="text-xs font-bold text-white">{isBn ? 'কোন অপেক্ষমাণ অনুরোধ নেই!' : 'No pending requests!'}</p>
                <p className="text-[9px] uppercase tracking-wider font-black font-mono">{isBn ? 'সকল এজেন্টের ডিপোজিট ডাটা ক্লিয়ার' : 'All systems clean'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 select-none">
                {requests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="glass-card p-4 border border-white/10 hover:border-white/15 hover:bg-white/10 rounded-xl text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between"
                  >
                    <div className="space-y-1 pr-6 truncate flex-1">
                      <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase text-rose-300">
                        <span>{req.agentName || "Agent Partner"}</span>
                        <span>•</span>
                        <span className="font-mono tracking-wider text-white/50">{req.agentPhone}</span>
                      </div>
                      <p className="text-[11px] font-extrabold text-white">৳ {Number(req.amount).toLocaleString()}</p>
                      <span className="text-[9px] text-white/40 block leading-tight">
                        {req.type === 'own' ? `${isBn ? 'মেথড: ' : 'Method: '} ${req.paymentMethod.toUpperCase()}` : (isBn ? 'সুপার এজেন্ট অনুরোধ' : 'Super Agent Request')}
                      </span>
                    </div>

                    <div className="p-2 bg-white/5 rounded-lg border border-white/10 shrink-0 text-white/50">
                      <ArrowRight size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screen expand popup modal for screenshot previewing */}
      {viewScreenshotUrl && (
        <div className="fixed inset-0 bg-black/92 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="relative max-w-full max-h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <img 
              src={viewScreenshotUrl} 
              alt="Screenshot full size" 
              className="max-h-[80vh] w-auto pointer-events-none"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setViewScreenshotUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-950/80 hover:bg-slate-950 text-white rounded-full transition-colors cursor-pointer border border-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Clean Custom Reject Confirmation Overlay */}
      <AnimatePresence>
        {rejectConfirmationRequest && (
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
              className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col space-y-4"
            >
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-rose-300 rounded-xl">
                  <X size={20} className="stroke-[2.5px]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    {isBn ? 'বাতিল নিশ্চিত করুন' : 'Confirm Rejection'}
                  </h4>
                  <span className="text-[10px] text-white/40 font-bold block mt-0.5">
                    {isBn ? 'আবেদন প্রত্যাহার নিষ্পত্তি' : 'Application Decline Processing'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-white/70 font-semibold leading-relaxed">
                {isBn 
                  ? `আপনি কি নিশ্চিতভাবে ৳${Number(rejectConfirmationRequest.amount).toLocaleString()} মূল্যের এই জমার আবেদনটি প্রত্যাখ্যান করতে চান?` 
                  : `Are you sure you want to reject this deposit request of ৳${Number(rejectConfirmationRequest.amount).toLocaleString()}?`}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRejectConfirmationRequest(null)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95"
                >
                  {isBn ? 'ফিরে যান' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleReject(rejectConfirmationRequest)}
                  className="flex-1 py-2.5 bg-red-650 hover:bg-red-600 text-white rounded-xl font-black text-xs uppercase cursor-pointer transition-all active:scale-95 shadow-lg shadow-red-500/20"
                >
                  {isBn ? 'বাতিল করুন' : 'Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
