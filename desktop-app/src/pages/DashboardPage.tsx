import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────
interface Lead {
  id: string;
  client: string;
  platform: string;
  service: string;
  budget: string;
  score: number;
  status: 'hot' | 'warm' | 'cold' | 'won' | 'lost';
  date: string;
  notes: string;
}

interface Proposal {
  id: string;
  client: string;
  platform: string;
  service: string;
  amount: string;
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected';
  date: string;
}

interface AgentActivity {
  id: string;
  agent: string;
  action: string;
  detail: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// ─── Mock Data (will be replaced with real CRM data) ─────
const MOCK_LEADS: Lead[] = [
  { id: '1', client: 'Ahmed Tech Solutions', platform: 'Upwork', service: 'Website Development', budget: '$1,500 - $3,000', score: 87, status: 'hot', date: '2026-06-13', notes: 'Client posted 3 similar jobs. High hire rate.' },
  { id: '2', client: 'Sarah\'s Boutique', platform: 'Fiverr', service: 'Android App', budget: '$800 - $1,200', score: 72, status: 'warm', date: '2026-06-13', notes: 'Buyer requested quote for e-commerce app.' },
  { id: '3', client: 'Pak Digital Agency', platform: 'LinkedIn', service: 'AI Automation', budget: '$5,000+', score: 94, status: 'hot', date: '2026-06-12', notes: 'Enterprise client. Looking for AI chatbot system.' },
  { id: '4', client: 'Global Traders', platform: 'Freelancer', service: 'Desktop Software', budget: '$2,000 - $4,000', score: 65, status: 'warm', date: '2026-06-12', notes: 'Inventory management system needed.' },
  { id: '5', client: 'Local Restaurant', platform: 'Facebook', service: 'Website Development', budget: '$500 - $800', score: 45, status: 'cold', date: '2026-06-11', notes: 'Small budget, but local client.' },
];

const MOCK_PROPOSALS: Proposal[] = [
  { id: '1', client: 'Ahmed Tech Solutions', platform: 'Upwork', service: 'Website', amount: '$2,500', status: 'draft', date: '2026-06-13' },
  { id: '2', client: 'Pak Digital Agency', platform: 'LinkedIn', service: 'AI System', amount: '$6,000', status: 'sent', date: '2026-06-12' },
  { id: '3', client: 'Sarah\'s Boutique', platform: 'Fiverr', service: 'Android App', amount: '$1,000', status: 'viewed', date: '2026-06-12' },
];

const MOCK_ACTIVITIES: AgentActivity[] = [
  { id: '1', agent: 'Upwork Agent', action: 'Job Found', detail: 'WordPress dev job - $2,500 budget', time: '2 min ago', type: 'success' },
  { id: '2', agent: 'Fiverr Agent', action: 'Buyer Message', detail: 'Sarah asked for app timeline', time: '15 min ago', type: 'info' },
  { id: '3', agent: 'LinkedIn Agent', action: 'Profile View', detail: 'Pak Digital viewed your profile', time: '1 hr ago', type: 'info' },
  { id: '4', agent: 'Proposal Agent', action: 'Draft Ready', detail: 'Proposal for Ahmed Tech created', time: '2 hrs ago', type: 'warning' },
  { id: '5', agent: 'Pricing Agent', action: 'Price Analysis', detail: 'Market rate: $2K-$4K for WP sites', time: '3 hrs ago', type: 'info' },
];

// ─── Helper Functions ────────────────────────────────────
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'from-green-500/20 to-green-500/5 border-green-500/30';
  if (score >= 60) return 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30';
  return 'from-red-500/20 to-red-500/5 border-red-500/30';
}

function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    hot: 'bg-red-500/20 text-red-300 border-red-500/30',
    warm: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    cold: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    won: 'bg-green-500/20 text-green-300 border-green-500/30',
    lost: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    viewed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    approved: 'bg-green-500/20 text-green-300 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return map[status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

function getActivityIcon(type: string): string {
  const map: Record<string, string> = { success: '✦', info: '◈', warning: '⚡', error: '✖' };
  return map[type] || '◈';
}

function getActivityColor(type: string): string {
  const map: Record<string, string> = { success: 'text-green-400', info: 'text-cyan-400', warning: 'text-yellow-400', error: 'text-red-400' };
  return map[type] || 'text-cyan-400';
}

// ─── Sub-Components ──────────────────────────────────────

function StatCard({ icon, label, value, sub, color, glow }: {
  icon: string; label: string; value: string; sub?: string; color: string; glow?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-5 group hover:border-white/[0.12] transition-all duration-500`}>
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
      {glow && <div className={`absolute -bottom-4 -left-4 w-16 h-16 rounded-full ${glow} opacity-10 blur-xl`} />}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs text-slate-500 uppercase tracking-widest">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function AgentCard({ name, status, lastAction, icon, color }: {
  name: string; status: string; lastAction: string; icon: string; color: string;
}) {
  const isActive = status === 'active';
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-300 group">
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-sm font-bold shadow-lg`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs text-slate-500 truncate">{lastAction}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
        <span className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-green-400' : 'text-slate-600'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getScoreBg(lead.score)} border flex items-center justify-center`}>
        <span className={`text-sm font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{lead.client}</p>
        <p className="text-xs text-slate-500">{lead.service} · {lead.budget}</p>
      </div>
      <div className="text-right">
        <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-full border ${getStatusBadge(lead.status)}`}>
          {lead.status}
        </span>
        <p className="text-[10px] text-slate-600 mt-1">{lead.platform}</p>
      </div>
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: Proposal }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{proposal.client}</p>
        <p className="text-xs text-slate-500">{proposal.service} · {proposal.platform}</p>
      </div>
      <p className="text-sm font-semibold text-white">{proposal.amount}</p>
      <span className={`inline-flex px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-full border ${getStatusBadge(proposal.status)}`}>
        {proposal.status}
      </span>
    </div>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'proposals' | 'agents'>('overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            Business Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">{dateStr} · {timeStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-xs font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
            Agents Active
          </div>
        </div>
      </div>

      {/* ─── Stat Cards Row ─── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="🎯" label="Hot Leads" value="3" sub="+2 today" color="from-red-500 to-orange-500" glow="bg-red-500" />
        <StatCard icon="📋" label="Proposals" value="5" sub="2 pending approval" color="from-purple-500 to-pink-500" glow="bg-purple-500" />
        <StatCard icon="💰" label="Pipeline" value="$9,500" sub="This month target" color="from-cyan-500 to-blue-500" glow="bg-cyan-500" />
        <StatCard icon="🤖" label="Active Agents" value="12" sub="All systems go" color="from-green-500 to-emerald-500" glow="bg-green-500" />
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {(['overview', 'leads', 'proposals', 'agents'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === tab
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">
          {/* Left Column: Leads + Proposals */}
          <div className="col-span-2 space-y-5">
            {/* Hot Leads */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Hot Leads
                </h3>
                <span className="text-xs text-slate-500">{MOCK_LEADS.length} total</span>
              </div>
              <div className="p-3 space-y-2">
                {MOCK_LEADS.filter(l => l.status === 'hot' || l.status === 'warm').map(lead => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </div>
            </div>

            {/* Pending Proposals */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  Proposals Pending Approval
                </h3>
                <span className="text-xs text-slate-500">{MOCK_PROPOSALS.length} total</span>
              </div>
              <div className="p-3 space-y-2">
                {MOCK_PROPOSALS.map(p => (
                  <ProposalRow key={p.id} proposal={p} />
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Paste Job', icon: '📋', color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 hover:from-cyan-500/30 hover:to-blue-500/30' },
                  { label: 'New Proposal', icon: '✍️', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30' },
                  { label: 'Price Calculator', icon: '💰', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30' },
                  { label: 'Daily Report', icon: '📊', color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30 hover:from-yellow-500/30 hover:to-orange-500/30' },
                ].map(action => (
                  <button
                    key={action.label}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${action.color} border transition-all duration-300 group`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{action.icon}</span>
                    <span className="text-xs font-medium text-white">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Agents + Activity */}
          <div className="space-y-5">
            {/* Agent Status */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">Agent Status</h3>
              </div>
              <div className="p-3 space-y-2">
                <AgentCard name="Upwork Agent" status="active" lastAction="Scanning jobs..." icon="U" color="from-green-500 to-emerald-600" />
                <AgentCard name="Fiverr Agent" status="active" lastAction="Monitoring messages" icon="F" color="from-green-500 to-emerald-600" />
                <AgentCard name="LinkedIn Agent" status="active" lastAction="Outreach planned" icon="L" color="from-blue-500 to-indigo-600" />
                <AgentCard name="Proposal Agent" status="active" lastAction="Draft ready for review" icon="P" color="from-purple-500 to-pink-600" />
                <AgentCard name="Pricing Agent" status="idle" lastAction="Last analysis 3h ago" icon="$" color="from-slate-600 to-slate-700" />
                <AgentCard name="WhatsApp Boss" status="active" lastAction="Connected to boss" icon="W" color="from-green-500 to-emerald-600" />
              </div>
            </div>

            {/* Activity Feed */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">Activity Feed</h3>
              </div>
              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {MOCK_ACTIVITIES.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                    <span className={`text-xs mt-0.5 ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium">{activity.agent}</p>
                      <p className="text-xs text-slate-500 truncate">{activity.detail}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Status */}
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Platform Status</h3>
              <div className="space-y-2">
                {[
                  { name: 'Upwork', status: 'Connected', color: 'bg-green-400' },
                  { name: 'Fiverr', status: 'Connected', color: 'bg-green-400' },
                  { name: 'LinkedIn', status: 'Connected', color: 'bg-green-400' },
                  { name: 'Freelancer', status: 'Setup needed', color: 'bg-yellow-400' },
                  { name: 'PeoplePerHour', status: 'Setup needed', color: 'bg-yellow-400' },
                  { name: 'WhatsApp', status: 'Connected', color: 'bg-green-400' },
                ].map(platform => (
                  <div key={platform.name} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-slate-400">{platform.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${platform.color}`} />
                      <span className="text-[10px] text-slate-500">{platform.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">All Leads</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-xs bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-lg hover:bg-cyan-500/30 transition-all">
                + Add Lead
              </button>
              <button className="px-3 py-1.5 text-xs bg-white/[0.05] border border-white/[0.08] text-slate-300 rounded-lg hover:bg-white/[0.08] transition-all">
                Paste Job URL
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {MOCK_LEADS.map(lead => (
              <div key={lead.id} className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getScoreBg(lead.score)} border flex items-center justify-center`}>
                  <span className={`text-lg font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{lead.client}</p>
                  <p className="text-xs text-slate-500">{lead.service} · {lead.budget}</p>
                  <p className="text-xs text-slate-600 mt-1">{lead.notes}</p>
                </div>
                <div className="text-right space-y-1">
                  <span className={`inline-flex px-2.5 py-1 text-[10px] uppercase tracking-wider font-medium rounded-full border ${getStatusBadge(lead.status)}`}>
                    {lead.status}
                  </span>
                  <p className="text-[10px] text-slate-600">{lead.platform} · {lead.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'proposals' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Proposals</h3>
              <button className="px-3 py-1.5 text-xs bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-all">
                + Create Proposal
              </button>
            </div>
            <div className="p-3 space-y-2">
              {MOCK_PROPOSALS.map(proposal => (
                <ProposalRow key={proposal.id} proposal={proposal} />
              ))}
            </div>
          </div>

          {/* Proposal Builder Preview */}
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Proposal Builder</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Client Name</label>
                <input
                  type="text"
                  placeholder="Enter client name..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Service Type</label>
                <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all">
                  <option value="">Select service...</option>
                  <option value="website">Website Development</option>
                  <option value="desktop">Desktop Software</option>
                  <option value="android">Android App</option>
                  <option value="automation">Automation System</option>
                  <option value="ai">AI Tools & Agent</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Job Description / Requirements</label>
                <textarea
                  rows={4}
                  placeholder="Paste the job description here..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                />
              </div>
              <button className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium text-sm hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20">
                Generate Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'CEO / Master', desc: 'Controls all subagents, creates daily plan, assigns tasks, reviews results', icon: '👑', color: 'from-yellow-500 to-orange-600', status: 'active' },
            { name: 'Upwork Agent', desc: 'Searches jobs, analyzes posts, scores jobs, drafts custom proposals', icon: '🔍', color: 'from-green-500 to-emerald-600', status: 'active' },
            { name: 'Fiverr Agent', desc: 'Optimizes gigs, monitors messages, drafts replies, suggests improvements', icon: '🎯', color: 'from-green-500 to-teal-600', status: 'active' },
            { name: 'LinkedIn Agent', desc: 'Finds potential clients, creates outreach messages, tracks conversations', icon: '💼', color: 'from-blue-500 to-indigo-600', status: 'active' },
            { name: 'Proposal Agent', desc: 'Writes professional proposals for all service types with multiple versions', icon: '✍️', color: 'from-purple-500 to-pink-600', status: 'active' },
            { name: 'Pricing Agent', desc: 'Estimates project price, shows packages, calculates timeline, detects risky clients', icon: '💰', color: 'from-yellow-500 to-amber-600', status: 'active' },
            { name: 'Client Chat Agent', desc: 'Reads messages, detects intent, drafts replies, asks missing requirements', icon: '💬', color: 'from-cyan-500 to-blue-600', status: 'active' },
            { name: 'WhatsApp Boss', desc: 'Connects with you via WhatsApp, sends alerts, receives commands', icon: '📱', color: 'from-green-500 to-emerald-600', status: 'active' },
            { name: 'YouTube Research', desc: 'Studies freelancing videos, extracts strategies, saves to knowledge base', icon: '🎓', color: 'from-red-500 to-pink-600', status: 'idle' },
            { name: 'Facebook/IG Lead', desc: 'Finds potential clients from pages, groups, posts. Never auto-messages.', icon: '👥', color: 'from-blue-500 to-purple-600', status: 'idle' },
            { name: 'Freelancer Agent', desc: 'Searches projects, analyzes requirements, prepares bids, tracks replies', icon: '🏗️', color: 'from-orange-500 to-red-600', status: 'setup' },
            { name: 'PeoplePerHour', desc: 'Searches jobs, prepares offers, tracks client messages', icon: '⏰', color: 'from-indigo-500 to-purple-600', status: 'setup' },
          ].map(agent => (
            <div key={agent.name} className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-5 hover:border-white/[0.12] transition-all duration-300 group">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl shadow-lg shrink-0 group-hover:scale-105 transition-transform`}>
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{agent.name}</h4>
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${
                      agent.status === 'active' ? 'text-green-400' : agent.status === 'idle' ? 'text-yellow-400' : 'text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === 'active' ? 'bg-green-400' : agent.status === 'idle' ? 'bg-yellow-400' : 'bg-slate-600'
                      }`} />
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{agent.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
