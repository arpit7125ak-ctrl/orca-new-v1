import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ExpandablePanel({ title, subtitle, defaultExpanded = true, children, icon: Icon, extraHeader }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-base)] rounded-xl p-4 shrink-0 shadow-sm card-enter interactive-card">
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          {Icon && <Icon className="w-4 h-4 text-white/50 group-hover:text-white/80 transition" />}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-white/80 transition flex items-center space-x-1.5">
              {title}
            </h3>
            {subtitle && <div className="text-[9px] text-white/30">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {extraHeader}
          <button className="text-white/30 hover:text-white/70 transition">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
