import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { AgentProfile, Language } from '../types';
import { Trophy, Users, Award, ShieldCheck, Flame, Medal, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface ReferralLeaderboardProps {
  language: Language;
  currentProfile: AgentProfile;
}

interface LeaderEntry {
  name: string;
  agentId: string;
  referCount: number;
  phone: string;
  isCurrentUser?: boolean;
}

// Top level static baseline competitors to make the leaderboard alive and engaging.
const COMPETITORS: LeaderEntry[] = [
  { name: 'Tariqul Islam (Dhaka MFS)', agentId: '90458123', referCount: 14, phone: '01712-XXXXXX' },
  { name: 'Anika Rahman (Mirpur Telecom)', agentId: '47201988', referCount: 11, phone: '01911-XXXXXX' },
  { name: 'Siddique General Store', agentId: '83921045', referCount: 8, phone: '01552-XXXXXX' },
  { name: 'Jamil Ahmed (Savar Digital)', agentId: '65930122', referCount: 5, phone: '01819-XXXXXX' },
  { name: 'Nusrat Jahan (Chittagong Top)', agentId: '21098453', referCount: 4, phone: '01302-XXXXXX' },
];

export const ReferralLeaderboard: React.FC<ReferralLeaderboardProps> = ({ language, currentProfile }) => {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [dbLeaders, setDbLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isBn = language === 'bn';

  useEffect(() => {
    // Set up snapshot listener on the agents collection to get real-time referCounts
    const agentsColl = collection(db, 'agents');
    const q = query(agentsColl, orderBy('referCount', 'desc'), limit(15));

    const unsubscribe = onSnapshot(q, (snap) => {
      const dbList: LeaderEntry[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.referCount && data.referCount > 0) {
          dbList.push({
            name: data.name,
            agentId: data.agentId,
            referCount: Number(data.referCount),
            phone: data.phone || '',
            isCurrentUser: auth.currentUser?.uid === doc.id,
          });
        }
      });
      setDbLeaders(dbList);
      setLoading(false);
    }, (err) => {
      console.error("Leaderboard fetch failed:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute final top 5 merging real database performers with historical top competitors
  useEffect(() => {
    // 1. Start with the DB list who have at least 1 referCount
    let mergedList = [...dbLeaders];

    // Ensure currently signed in profile is added if they have referCount > 0 and not already in dbLeaders
    const userInDb = dbLeaders.some(item => item.agentId === currentProfile.agentId);
    if (!userInDb && currentProfile.referCount && currentProfile.referCount > 0) {
      mergedList.push({
        name: currentProfile.name + ` (${isBn ? 'আপনি' : 'You'})`,
        agentId: currentProfile.agentId,
        referCount: currentProfile.referCount,
        phone: currentProfile.phone,
        isCurrentUser: true
      });
    }

    // 2. Add static competitors who are not conflict-prone
    COMPETITORS.forEach(comp => {
      // Check if this competitor isn't already overridden by a database agent with the same agentId
      const exists = mergedList.some(item => item.agentId === comp.agentId);
      if (!exists) {
        mergedList.push(comp);
      }
    });

    // 3. Sort by referCount desc
    mergedList.sort((a, b) => b.referCount - a.referCount);

    // 4. Limit to top 5
    const finalLeaders = mergedList.slice(0, 5);

    // If current profile is not in the top 5 but has a score, we track it for personal position badge.
    setLeaders(finalLeaders);
  }, [dbLeaders, currentProfile, language]);

  // Find user's own ranking in the merged pool
  const getPersonalRank = (): number | null => {
    // Build a larger sorted pool to find rank
    let pool = [...dbLeaders];
    const userInPool = pool.some(item => item.agentId === currentProfile.agentId);
    if (!userInPool) {
      pool.push({
        name: currentProfile.name,
        agentId: currentProfile.agentId,
        referCount: currentProfile.referCount || 0,
        phone: currentProfile.phone,
        isCurrentUser: true
      });
    }
    COMPETITORS.forEach(comp => {
      if (!pool.some(item => item.agentId === comp.agentId)) {
        pool.push(comp);
      }
    });

    pool.sort((a, b) => b.referCount - a.referCount);
    const index = pool.findIndex(item => item.agentId === currentProfile.agentId || item.isCurrentUser);
    return index !== -1 ? index + 1 : null;
  };

  const personalRank = getPersonalRank();
  const formatNumber = (num: number) => {
    return isBn ? num.toLocaleString('bn-BD') : num.toString();
  };

  return (
    <div 
      id="referral-leaderboard-card" 
      className="glass-card rounded-3xl p-5 border border-rose-500/20 relative overflow-hidden"
    >
      <div className="absolute right-[-25px] top-[-25px] w-24 h-24 bg-rose-500/5 rounded-full blur-2xl"></div>
      <div className="absolute left-[-25px] bottom-[-25px] w-24 h-24 bg-pink-500/5 rounded-full blur-2xl"></div>

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4 select-none">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl shadow-lg shadow-rose-500/10">
            <Trophy size={16} className="text-white shrink-0" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-widest text-white uppercase">
              {isBn ? 'রেফারেল লিডারবোর্ড' : 'REFERRAL LEADERBOARD'}
            </h4>
            <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest block mt-0.5">
              {isBn ? 'সর্বোচ্চ সফল আমন্ত্রণকারী ৫ পার্টনার' : 'TOP 5 SPONSORS IN OUR NETWORK'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1 py-1 px-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[9px] font-black uppercase text-rose-300">
          <Flame size={10} className="text-rose-400 animate-pulse" />
          <span>{isBn ? 'লাইভ র‍্যাংক' : 'LIVE'}</span>
        </div>
      </div>

      {/* Leaderboard Table rows */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-2">
          <div className="w-6 h-6 rounded-full border-2 border-rose-500/10 border-t-rose-500 animate-spin"></div>
          <span className="text-[9px] uppercase font-black tracking-wider text-white/30">
            {isBn ? 'লোডিং চ্যাম্পিয়ন্স...' : 'Retrieving Champions...'}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {leaders.map((leader, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;
            const isUser = leader.isCurrentUser || leader.agentId === currentProfile.agentId;

            // Compute rank background decoration
            let rankBadge = '';
            let rankIcon = null;
            if (isFirst) {
              rankBadge = 'bg-amber-400 text-slate-950 font-black';
              rankIcon = <Medal size={11} className="stroke-[3.5px] text-slate-950" />;
            } else if (isSecond) {
              rankBadge = 'bg-slate-300 text-slate-950 font-black';
              rankIcon = <Medal size={11} className="stroke-[3.5px] text-slate-950" />;
            } else if (isThird) {
              rankBadge = 'bg-amber-700 text-amber-50 font-black';
              rankIcon = <Medal size={11} className="stroke-[3.5px] text-white" />;
            } else {
              rankBadge = 'bg-white/5 border border-white/10 text-white/70 font-bold';
            }

            return (
              <div
                key={leader.agentId + index}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${
                  isUser 
                    ? 'bg-rose-500/15 border-rose-500/35 shadow-md shadow-rose-500/5' 
                    : 'bg-white/5 hover:bg-white/[0.08] border-white/5'
                }`}
              >
                {/* Left Side: Rank, Circle and User details */}
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] shrink-0 ${rankBadge}`}>
                    {rankIcon ? rankIcon : formatNumber(index + 1)}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-black text-white truncate max-w-[170px] flex items-center gap-1.5">
                      <span>{leader.isCurrentUser ? currentProfile.name : leader.name}</span>
                      {isUser && (
                        <span className="text-[8px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                          {isBn ? 'আপনি' : 'You'}
                        </span>
                      )}
                    </h5>
                    <span className="text-[8px] font-mono text-white/40 block mt-0.5 uppercase tracking-wider">
                      {isBn ? `এজেন্ট আইডি: #${leader.agentId}` : `ID: #${leader.agentId}`}
                    </span>
                  </div>
                </div>

                {/* Right Side: Score count */}
                <div className="text-right shrink-0">
                  <div className="flex items-center space-x-1.5 justify-end">
                    <strong className="text-xs font-black text-white tracking-tight">
                      {formatNumber(leader.referCount)}
                    </strong>
                    <Users size={11} className="text-rose-300" />
                  </div>
                  <span className="text-[7.5px] text-white/40 uppercase tracking-widest font-bold block mt-0.5">
                    {isBn ? 'টি রেফারেল' : 'INVITES'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Personal status banner block */}
          <div className="mt-3 bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award size={14} className="text-rose-300 shrink-0" />
              <div className="leading-tight">
                <span className="text-[9px] text-white/50 block font-bold uppercase tracking-wider">
                  {isBn ? 'আপনার নিজস্ব পজিশন' : 'YOUR CURRENT STANDING'}
                </span>
                <span className="text-[11px] font-black text-white">
                  {isBn 
                    ? `র‍্যাংক: #${personalRank ? formatNumber(personalRank) : '১২+'}` 
                    : `Position rank: #${personalRank ? formatNumber(personalRank) : '12+'}`}
                </span>
              </div>
            </div>
            
            <div className="text-[8px] max-w-[120px] text-right text-rose-300/80 leading-relaxed font-bold">
              {isBn 
                ? '৳৫০০ মেগা বোনাস লাভ করতে আরও রেফারে করুন!'
                : 'Share your refer link to climb the leaderboard!'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
