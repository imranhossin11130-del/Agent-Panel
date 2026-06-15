import React from 'react';
import { Layers, Clipboard, Download, User } from 'lucide-react';
import { ActiveTab, Language } from '../types';
import { translations } from '../translations';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  language: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  language,
}) => {
  const t = translations[language];

  const navItems = [
    { id: 'home' as ActiveTab, label: t.tabHome, icon: Layers },
    { id: 'history' as ActiveTab, label: t.tabHistory, icon: Clipboard },
    { id: 'refill' as ActiveTab, label: t.tabRefill, icon: Download },
    { id: 'profile' as ActiveTab, label: t.tabProfile, icon: User },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-slate-950/45 backdrop-blur-lg border-t border-white/10 shadow-2xl px-2 py-2 flex justify-around items-center z-40 shrink-0 rounded-t-3xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className="flex flex-col items-center flex-1 py-1 relative focus:outline-hidden group cursor-pointer"
          >
            {/* Animated bar indicator above selected tab */}
            {isActive && (
              <span className="absolute top-[-8px] w-8 h-1 bg-gradient-to-r from-rose-400 to-pink-500 rounded-full active-glow"></span>
            )}
            
            {/* Icon wrapper */}
            <div 
              className={`
                p-1.5 rounded-2xl transition-all duration-200
                ${isActive 
                  ? 'text-rose-300 bg-white/10 scale-105' 
                  : 'text-white/40 group-hover:text-white/80 group-active:scale-95'
                }
              `}
            >
              <Icon size={18} className={`${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            </div>

            {/* Label text */}
            <span 
              className={`
                text-[10px] mt-0.5 font-bold transition-all tracking-wide
                ${isActive 
                  ? 'text-rose-300 scale-100 font-black' 
                  : 'text-white/40 font-semibold group-hover:text-white/80'
                }
              `}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
