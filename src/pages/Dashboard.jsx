import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollection } from '../firebase/db';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend } from 'recharts';

const todayISO = () => new Date().toISOString().split('T')[0];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ revenue: 0, monthlyRevenue: 0, activeMembers: 0, totalMembers: 0, dailyAttendance: 0, expiringSoon: 0, totalExpenses: 0, monthlyExpenses: 0, netProfit: 0 });
  const [chartData, setChartData] = useState({ revenueTrend: [], memberStatus: [], revenueByPlan: [], revVsExp: [] });
  const [recentActivity, setRecentActivity] = useState([]);
  const [expiringSoonList, setExpiringSoonList] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllAttendance, setShowAllAttendance] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [members, payments, attendance, expenses] = await Promise.all([
          getCollection('members'),
          getCollection('payments'),
          getCollection('attendance'),
          getCollection('expenses'),
        ]);

        const now = new Date();
        const totalRev = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const activeMembersCount = members.filter(m => m.status === 'Active').length;

        // Monthly revenue
        const monthlyRev = payments
          .filter(p => { const d = new Date(p.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        // Expenses
        const totalExp = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const monthlyExp = expenses
          .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);

        // Today's check-ins — support both new (date/checkInTime) and old (timestamp) schema
        const today = todayISO();
        const todayCheckins = attendance.filter(a =>
          a.date === today || new Date(a.checkInTime || a.timestamp || 0).toDateString() === now.toDateString()
        );
        todayCheckins.sort((a, b) => new Date(b.checkInTime || b.timestamp || 0) - new Date(a.checkInTime || a.timestamp || 0));
        setTodayAttendance(todayCheckins);

        // Expiring in next 7 days
        const in7days = new Date(); in7days.setDate(in7days.getDate() + 7);
        const expiringSoon = members.filter(m => {
          if (!m.expiryDate) return false;
          const exp = new Date(m.expiryDate);
          return exp >= now && exp <= in7days;
        });
        setExpiringSoonList(expiringSoon);

        setStats({
          revenue: totalRev, monthlyRevenue: monthlyRev,
          activeMembers: activeMembersCount, totalMembers: members.length,
          dailyAttendance: todayCheckins.length, expiringSoon: expiringSoon.length,
          totalExpenses: totalExp, monthlyExpenses: monthlyExp,
          netProfit: monthlyRev - monthlyExp,
        });

        // Revenue trend by date
        const groupedPayments = {};
        payments.forEach(p => {
          const dateStr = new Date(p.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          groupedPayments[dateStr] = (groupedPayments[dateStr] || 0) + (Number(p.amount) || 0);
        });
        const revTrend = Object.keys(groupedPayments).map(k => ({ name: k, value: groupedPayments[k] }));

        const expiredCount = members.length - activeMembersCount;
        const memberStatusData = [
          { name: 'Active', value: activeMembersCount, color: '#7c3aed' },
          { name: 'Expired', value: expiredCount > 0 ? expiredCount : 0, color: '#f59e0b' }
        ];

        const planRev = {};
        payments.forEach(p => { planRev[p.planName] = (planRev[p.planName] || 0) + (Number(p.amount) || 0); });
        const planRevData = Object.keys(planRev).map(k => ({ name: k, value: planRev[k] }));

        // Revenue vs Expense — last 6 months
        const revVsExp = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const yr = d.getFullYear(); const mo = d.getMonth();
          const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          const rev = payments.filter(p => { const pd = new Date(p.date); return pd.getMonth() === mo && pd.getFullYear() === yr; }).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const exp = expenses.filter(e => { const ed = new Date(e.date); return ed.getMonth() === mo && ed.getFullYear() === yr; }).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          revVsExp.push({ name: label, Revenue: rev, Expenses: exp });
        }

        setChartData({
          revenueTrend: revTrend.length > 0 ? revTrend : [{ name: 'Today', value: 0 }],
          memberStatus: memberStatusData,
          revenueByPlan: planRevData,
          revVsExp,
        });

        const activities = [];
        payments.forEach(p => activities.push({ type: 'payment', title: `Payment ₹${p.amount}`, date: new Date(p.date), id: p.id }));
        attendance.forEach(a => activities.push({ type: 'checkin', title: `${a.memberName} checked in`, date: new Date(a.checkInTime || a.timestamp || 0), id: a.id }));
        activities.sort((a, b) => b.date - a.date);
        setRecentActivity(activities.slice(0, 6));
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const cardBase = "bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-4";

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-h1 text-h1 text-on-surface">Dashboard Overview</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Welcome back to Deep Fitness ERP. Here's what's happening today.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-stack-gap">
        {/* Expense KPIs */}
        <div className={cardBase}>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-primary-container/30 rounded-xl">
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
            </div>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-label-caps text-label-caps bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md text-xs">
              All Time
            </span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Total Revenue</div>
            <div className="font-stat-value text-stat-value text-on-surface">{loading ? '...' : `₹${stats.revenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-secondary-container/30 rounded-xl">
              <span className="material-symbols-outlined text-secondary">show_chart</span>
            </div>
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-label-caps text-label-caps bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-md text-xs">
              This Month
            </span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Monthly Revenue</div>
            <div className="font-stat-value text-stat-value text-on-surface">{loading ? '...' : `₹${stats.monthlyRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-primary-container/30 rounded-xl">
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
            <span className="text-violet-600 dark:text-violet-400 font-label-caps text-label-caps bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-md text-xs">
              {loading ? '—' : `${stats.activeMembers}/${stats.totalMembers}`}
            </span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Active Members</div>
            <div className="font-stat-value text-stat-value text-on-surface">{loading ? '...' : stats.activeMembers}</div>
          </div>
        </div>

        {/* Daily Attendance — Clickable */}
        <button
          onClick={() => navigate('/checkin')}
          className={`${cardBase} text-left cursor-pointer hover:shadow-[0_14px_40px_rgba(207,196,255,0.25)] hover:scale-[1.02] transition-all duration-200 group`}
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-secondary-container/30 rounded-xl group-hover:bg-secondary-container/50 transition-colors">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
            </div>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-label-caps text-label-caps bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md text-xs">
              Today
            </span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Daily Attendance</div>
            <div className="font-stat-value text-stat-value text-on-surface">{loading ? '...' : stats.dailyAttendance}</div>
            <div className="text-xs text-primary mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              View check-ins
            </div>
          </div>
        </button>
      </div>

      {/* Expense KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-gap">
        <div className={cardBase}>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-rose-100 rounded-xl">
              <span className="material-symbols-outlined text-rose-600">receipt_long</span>
            </div>
            <span className="text-rose-600 font-label-caps text-label-caps bg-rose-50 px-2 py-1 rounded-md text-xs">All Time</span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Total Expenses</div>
            <div className="font-stat-value text-stat-value text-on-surface">{loading ? '...' : `₹${stats.totalExpenses.toLocaleString('en-IN')}`}</div>
          </div>
        </div>
        <div className={cardBase}>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-100 rounded-xl">
              <span className="material-symbols-outlined text-amber-600">trending_down</span>
            </div>
            <span className="text-amber-600 font-label-caps text-label-caps bg-amber-50 px-2 py-1 rounded-md text-xs">This Month</span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Monthly Expenses</div>
            <div className="font-stat-value text-stat-value text-on-surface">{loading ? '...' : `₹${stats.monthlyExpenses.toLocaleString('en-IN')}`}</div>
          </div>
        </div>
        <div className={cardBase}>
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-xl ${!loading && stats.netProfit >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              <span className={`material-symbols-outlined ${!loading && stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {!loading && stats.netProfit >= 0 ? 'trending_up' : 'trending_down'}
              </span>
            </div>
            <span className={`font-label-caps text-label-caps px-2 py-1 rounded-md text-xs ${!loading && stats.netProfit >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>This Month</span>
          </div>
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-1 uppercase tracking-wider">Net Profit</div>
            <div className={`font-stat-value text-stat-value ${!loading && stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {loading ? '...' : `${stats.netProfit >= 0 ? '' : '-'}₹${Math.abs(stats.netProfit).toLocaleString('en-IN')}`}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Section */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
            </div>
            <div>
              <h3 className="font-h3 text-h3 text-on-surface">Today's Attendance</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-secondary-container/30 text-secondary font-bold text-lg px-4 py-1.5 rounded-full">
              {loading ? '...' : stats.dailyAttendance}
            </span>
            <button
              onClick={() => navigate('/checkin')}
              className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant/30 px-3 py-1.5 rounded-lg hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">login</span>
              Check In
            </button>
          </div>
        </div>

        {!loading && todayAttendance.length > 0 ? (
          <div className="divide-y divide-outline-variant/10">
            {todayAttendance.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {a.memberName?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">{a.memberName || '—'}</div>
                </div>
                <div className="text-xs text-on-surface-variant shrink-0">
                  {new Date(a.checkInTime || a.timestamp || 0).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Checked In
                </span>
              </div>
            ))}
            {todayAttendance.length > 5 && (
              <button
                onClick={() => setShowAllAttendance(true)}
                className="w-full px-5 py-3 text-center text-xs text-primary font-medium hover:bg-primary/5 transition-colors"
              >
                View all {todayAttendance.length} check-ins today
              </button>
            )}
          </div>
        ) : !loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-30">event_busy</span>
            <p className="text-sm">No check-ins recorded today yet.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-on-surface-variant text-sm gap-2">
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            Loading attendance...
          </div>
        )}
      </div>

      {/* All Today's Attendance Modal */}
      {showAllAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Today's Check-ins</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}<span className="font-semibold text-secondary">{todayAttendance.length} total</span>
                </p>
              </div>
              <button
                onClick={() => setShowAllAttendance(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10 custom-scrollbar">
              {todayAttendance.map((a, i) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {a.memberName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-on-surface truncate">{a.memberName || '—'}</div>
                  </div>
                  <div className="text-xs text-on-surface-variant shrink-0">
                    {new Date(a.checkInTime || a.timestamp || 0).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    In
                  </span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-outline-variant/20">
              <button
                onClick={() => setShowAllAttendance(false)}
                className="w-full py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expiring Soon Alert */}
      {!loading && expiringSoonList.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-300">{expiringSoonList.length} member{expiringSoonList.length > 1 ? 's' : ''} expiring within 7 days</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {expiringSoonList.map(m => (
                <span key={m.id} className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full border border-amber-200 dark:border-amber-700/40">
                  {m.name} — {m.expiryDate}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-gap">
        <div className="lg:col-span-2 bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col">
          <h3 className="font-h3 text-h3 text-on-surface mb-6">Revenue Trend</h3>
          <div className="flex-1 w-full min-h-62.5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.revenueTrend}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col">
          <h3 className="font-h3 text-h3 text-on-surface mb-4">Membership Status</h3>
          <div className="flex-1 flex items-center justify-center relative min-h-45">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData.memberStatus} innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                  {chartData.memberStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
              <span className="font-stat-value text-stat-value text-on-surface">{stats.totalMembers}</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant">Total</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#7c3aed]"></div><span className="text-xs text-on-surface-variant">Active</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div><span className="text-xs text-on-surface-variant">Expired</span></div>
          </div>
        </div>
      </div>

      {/* Revenue vs Expense Chart */}
      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col">
        <h3 className="font-h3 text-h3 text-on-surface mb-6">Revenue vs Expenses (Last 6 Months)</h3>
        <div className="w-full min-h-55">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData.revVsExp} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `₹${v}`} />
              <Tooltip cursor={{ fill: 'rgba(124,58,237,0.04)' }} formatter={(v, n) => [`₹${v.toLocaleString('en-IN')}`, n]} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="Revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-gap">
        <div className="lg:col-span-2 bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col">
          <h3 className="font-h3 text-h3 text-on-surface mb-6">Revenue by Plan</h3>
          {chartData.revenueByPlan.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm opacity-60 min-h-45">No payment data yet.</div>
          ) : (
            <div className="flex-1 w-full min-h-50">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.revenueByPlan}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip cursor={{ fill: 'rgba(124,58,237,0.06)' }} formatter={v => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col">
          <h3 className="font-h3 text-h3 text-on-surface mb-6">Recent Activity</h3>
          <div className="flex flex-col gap-5 flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-sm text-on-surface-variant">Loading activity...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-sm text-on-surface-variant">No recent activity.</div>
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="flex gap-4 items-start">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${act.type === 'payment' ? 'bg-primary-container/40 text-primary' : 'bg-secondary-container/40 text-secondary'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {act.type === 'payment' ? 'payments' : 'how_to_reg'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-on-surface font-medium">{act.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {act.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {act.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
