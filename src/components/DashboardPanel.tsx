import React from 'react';
import { DashboardStats } from '../types';
import { motion } from 'motion/react';
import { Shield, AlertTriangle, CheckCircle, Activity, Lock, Eye, Terminal } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardPanelProps {
  stats: DashboardStats;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ stats }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Threats Blocked</div>
              <div className="text-2xl font-bold text-white">{stats.threats_blocked_today}</div>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium">Real-time protection active</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Files Sanitized</div>
              <div className="text-2xl font-bold text-white">{stats.files_sanitized}</div>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium">Privacy DNA health: 98%</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">System Load</div>
              <div className="text-2xl font-bold text-white">12%</div>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium">5 Swarm Agents online</div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="w-3 h-3 text-cyan-400" /> Risk Trend (24h)
          </h4>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.risk_trend}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="risk" stroke="#06b6d4" fillOpacity={1} fill="url(#colorRisk)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#06b6d4' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-3xl">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Terminal className="w-3 h-3 text-cyan-400" /> Recent Security Events
          </h4>
          <div className="space-y-3">
            {stats.recent_events.map((event, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                <div className={cn(
                  "p-1.5 rounded-lg mt-0.5",
                  event.type === 'block' ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"
                )}>
                  {event.type === 'block' ? <Lock className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-white font-medium">{event.message}</div>
                  <div className="text-[8px] text-zinc-500 font-bold uppercase mt-1">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
