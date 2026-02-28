import React from 'react';
import { SwarmAgent, SwarmResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Shield, AlertTriangle, CheckCircle, Smartphone, Globe, Eye, Phone, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SwarmVisualizerProps {
  agents: SwarmAgent[];
  result: SwarmResult | null;
  isAnalyzing: boolean;
}

const AgentIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'metadata': return <Globe className="w-4 h-4" />;
    case 'vision': return <Eye className="w-4 h-4" />;
    case 'ocr': return <Activity className="w-4 h-4" />;
    case 'audio': return <Phone className="w-4 h-4" />;
    case 'behavior': return <Shield className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
};

export const SwarmVisualizer: React.FC<SwarmVisualizerProps> = ({ agents, result, isAnalyzing }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">🐝 Swarm Intelligence</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Parallel AI Agent Network</p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
          isAnalyzing ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        )}>
          {isAnalyzing ? "Analyzing..." : "Ready"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-2xl border transition-all duration-300",
              agent.status === 'analyzing' ? "bg-zinc-900/50 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]" : "bg-zinc-900/30 border-zinc-800/50"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  agent.status === 'analyzing' ? "bg-cyan-500/20 text-cyan-400" : "bg-zinc-800 text-zinc-500"
                )}>
                  <AgentIcon type={agent.type} />
                </div>
                <span className="text-xs font-bold text-zinc-300">{agent.name}</span>
              </div>
              <div className={cn(
                "w-2 h-2 rounded-full",
                agent.status === 'idle' ? "bg-zinc-700" :
                agent.status === 'analyzing' ? "bg-cyan-500 animate-pulse" :
                agent.status === 'complete' ? "bg-emerald-500" : "bg-red-500"
              )} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Risk Score</span>
                <span className={cn(
                  agent.risk_score > 0.7 ? "text-red-400" : agent.risk_score > 0.4 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {Math.round(agent.risk_score * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${agent.risk_score * 100}%` }}
                  className={cn(
                    "h-full transition-colors duration-500",
                    agent.risk_score > 0.7 ? "bg-red-500" : agent.risk_score > 0.4 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                />
              </div>
              
              <AnimatePresence mode="wait">
                {agent.explanation && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-zinc-400 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5"
                  >
                    {agent.explanation}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-6 rounded-3xl border-2 mt-8",
            result.action_level === 'critical' ? "bg-red-500/10 border-red-500/30" :
            result.action_level === 'warning' ? "bg-amber-500/10 border-amber-500/30" :
            "bg-emerald-500/10 border-emerald-500/30"
          )}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              "p-3 rounded-2xl",
              result.action_level === 'critical' ? "bg-red-500/20 text-red-400" :
              result.action_level === 'warning' ? "bg-amber-500/20 text-amber-400" :
              "bg-emerald-500/20 text-emerald-400"
            )}>
              {result.action_level === 'critical' ? <AlertTriangle className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-white mb-1">Swarm Consensus</h4>
              <p className="text-sm text-zinc-300 mb-4">{result.action_message}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Final Risk</div>
                  <div className="text-xl font-bold text-white">{Math.round(result.risk_score * 100)}%</div>
                </div>
                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Agents Active</div>
                  <div className="text-xl font-bold text-white">{result.agents.length}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Process Time</div>
                  <div className="text-xl font-bold text-white">{result.processing_time.toFixed(2)}s</div>
                </div>
                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Confidence</div>
                  <div className="text-xl font-bold text-white">High</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
