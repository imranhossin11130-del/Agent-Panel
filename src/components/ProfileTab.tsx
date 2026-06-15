import React, { useState, useRef } from 'react';
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
  Check
} from 'lucide-react';
import { AgentProfile, Language } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileTabProps {
  profile: AgentProfile;
  language: Language;
  onLanguageToggle: () => void;
  onPinChangeRequest: () => void;
  onUpdateProfile?: (name: string, avatarUrl: string) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  language,
  onLanguageToggle,
  onPinChangeRequest,
  onUpdateProfile,
}) => {
  const t = translations[language];

  // Profile Edit modal states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editAvatar, setEditAvatar] = useState(profile.avatarUrl || '');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

