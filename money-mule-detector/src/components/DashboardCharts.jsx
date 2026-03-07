import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from 'recharts';

/* ━━━ TOKEN COLORS ━━━ */
const COLORS = {
  cyan: '#00e5ff',
  red: '#ff4d6d',
  purple: '#a855f7',
  orange: '#f97316',
  gray: '#8892a4',
  mutedBar: '#2a3448'
};

/* ━━━ ROW 1: Risk Score Trend ━━━ */
export function RiskScoreTrendChart({ data }) {
  // Transform Suspicious accounts data for the trend line
  const safeData = data || [];
  const chartData = safeData.map((acc, i) => ({
    name: acc.account_id ? acc.account_id.substring(0, 5) + '..' : `T-${i}`,
    score: acc.suspicion_score || 0
  })).slice(0, 15);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e2435', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          itemStyle={{ color: COLORS.cyan, fontWeight: 'bold' }}
        />
        <Area type="monotone" dataKey="score" stroke={COLORS.cyan} strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ━━━ ROW 1: Flagged Entities by Ring ━━━ */
export function FlaggedEntitiesChart({ fraudRings }) {
  // Mock trend data based on rings
  const safeRings = fraudRings || [];
  const ringLabels = safeRings.slice(0, 5).map(r => r.ring_id);
  
  const chartData = [
    { time: '10am', r1: 2, r2: 1, r3: 0 },
    { time: '12pm', r1: 5, r2: 2, r3: 1 },
    { time: '2pm',  r1: 8, r2: 4, r3: 2 },
    { time: '4pm',  r1: 12, r2: 7, r3: 4 },
    { time: '6pm',  r1: 9, r2: 10, r3: 3 },
  ];

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
        <XAxis dataKey="time" tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ backgroundColor: '#1e2435', border: 'none', borderRadius: '8px' }} />
        <Line type="monotone" dataKey="r1" stroke={COLORS.red} strokeWidth={2} dot={{ r: 3, fill: COLORS.red }} />
        <Line type="monotone" dataKey="r2" stroke={COLORS.cyan} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="r3" stroke={COLORS.gray} strokeWidth={1} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ━━━ ROW 3: Risk Distribution Donut ━━━ */
export function RiskDistributionDonut({ suspiciousAccounts }) {
  const safeAccounts = suspiciousAccounts || [];
  const highCounter = safeAccounts.filter(a => a.suspicion_score > 85).length || 0;
  const medCounter = safeAccounts.filter(a => a.suspicion_score >= 50 && a.suspicion_score <= 85).length || 0;
  const lowCounter = safeAccounts.filter(a => a.suspicion_score < 50).length || 0;

  const data = [
    { name: 'Critical/Hub', value: highCounter || 12 },
    { name: 'High Risk', value: medCounter || 18 },
    { name: 'Medium Risk', value: lowCounter || 9 },
    { name: 'Normal', value: 35 } // Dummy padding for visual
  ];

  const pieColors = [COLORS.red, COLORS.orange, COLORS.purple, COLORS.mutedBar];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          stroke="transparent"
          paddingAngle={4}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: '#1e2435', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ━━━ ROW 3: Ring Activity Timeline Bar ━━━ */
export function RingActivityBar({ fraudRings }) {
  const safeRings = fraudRings || [];
  const chartData = safeRings.slice(0, 6).map(ring => ({
    name: ring.ring_id ? ring.ring_id.replace('RING_', 'R') : 'R-?',
    count: ring.member_accounts ? ring.member_accounts.length : 0
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e2435', border: 'none', borderRadius: '8px' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.cyan : COLORS.mutedBar} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
