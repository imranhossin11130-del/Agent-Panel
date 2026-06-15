import React, { useState } from 'react';
import { Bell, LogOut, Globe, CheckCircle2 } from 'lucide-react';
import { AgentProfile, Language } from '../types';
import { translations } from '../translations';

interface HeaderProps {
  profile: AgentProfile;
  language: Language;
  onLanguageToggle: () => void;
  onNotificationClick: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  language,
  onLanguageToggle,
  onNotificationClick,
  onLogout,
}) => {
  const t = translations[language];
  const [showNotifications, setShowNotifications] = useState(false);

  const mockNotifications = [
    { id: '1', bn: 'কমিশন রিফিল: ৳৪৫.০০ সফলভাবে যোগ হয়েছে', en: 'Commission Refill: ৳45.00 added successfully', time: '10 min ago' },
    { id: '2', bn: 'রকেট কুইক রিফিল রিকোয়েন্ট অনুমোদিত হয়েছে', en: 'Rocket Quick Refill Request Approved', time: '1 hour ago' },
    { id: '3', bn: 'সতর্কতা: আপনার সিকিউরিটি পিন কাউকে শেয়ার করবেন না', en: 'Security Alert: Do not share your PIN with anyone', time: '1 day ago' },
  ];

  return (
    <header className="relative flex items-center justify-between bg-white/5 backdrop-blur-md px-4 py-3 border-b border-white/10 z-50">
      {/* Profile info left */}
      <div className="flex items-center space-x-3">
        <div className="relative">
          <img
            src={profile.avatarUrl || `/src/assets/images/meghla_maya_avatar_1781538356391.jpg`}
            alt={profile.name}
            className="w-12 h-12 rounded-full border-2 border-rose-450 object-cover shadow-sm hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // fallback if for some reason the generated image doesn't resolve yet
              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/agent/120/120';
            }}
          />
          <div className="absolute -bottom-1 -right-1 bg-green-400 border-2 border-slate-900 rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
            <span className="block w-1.5 h-1.5 bg-white rounded-full"></span>
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="flex items-center text-[10px] font-black text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full w-max mb-0.5">
            <CheckCircle2 size={10} className="mr-0.5 fill-rose-300 text-slate-900" />
            {t.verifiedAgent}
          </span>
          <span className="text-sm font-black text-white leading-tight">
            {profile.name}
          </span>
        </div>
      </div>

      {/* Action buttons right */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onLanguageToggle}
          className="p-2 bg-white/5 hover:bg-white/15 text-white/90 border border-white/10 rounded-full transition-all flex items-center text-xs font-black"
          title="Change Language"
        >
          <Globe size={16} className="text-white/80 mr-1 animate-spin-slow" />
          <span>{language === 'bn' ? 'EN' : 'বাংলা'}</span>
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              onNotificationClick();
            }}
            className="p-2 bg-white/5 hover:bg-white/15 text-white/90 border border-white/10 rounded-full transition-all relative"
          >
            <Bell size={18} className="text-white/90" />
            <span className="absolute -top-1 -right-1 bg-rose-550 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black">
              3
            </span>
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-3.5 w-72 glass-card rounded-2xl shadow-2xl py-2 z-50 animate-bounce-in flex flex-col">
              <div className="px-4 py-2 border-b border-white/10 flex justify-between items-center bg-white/5">
                <span className="text-xs font-black text-white/90">
                  {language === 'bn' ? 'নোটিফিকেশনসমূহ' : 'Notifications'}
                </span>
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-[10px] text-rose-300 hover:text-rose-200 hover:underline font-black"
                >
                  {language === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {mockNotifications.map((notif) => (
                  <div key={notif.id} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <p className="text-xs text-white/80 font-semibold leading-relaxed">
                      {language === 'bn' ? notif.bn : notif.en}
                    </p>
                    <span className="text-[9px] text-white/40 mt-1 block font-mono">
                      {notif.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            onLogout?.();
          }}
          className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-300 rounded-full text-white/90 border border-white/10 transition-all"
          title={t.logoutBtn}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
