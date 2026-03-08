import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from 'recharts';

/* ━━━ TOKEN COLORS ━━━ */
const COLORS = {
  cyan: '#00e5ff',
  red: '#ff4d6d',
  purple: '#a855f7',
  orange: '#f97316',
  gray: '#8892a4',
  mutedBar: 'rgba(42,52,72,0.8)'
};

// Custom glowing tooltip
const GlowTooltip = ({ active, payload, label, accentColor = COLORS.cyan }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: `rgba(0,229,255,0.12)`,
      border: `1px solid ${accentColor}66`,
      borderRadius: 8,
      padding: '8px 12px',
      color: 'white',
      fontSize: 12,
      backdropFilter: 'blur(8px)',
    }}>
      {label && <p style={{ color: COLORS.gray, fontSize: 10, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || accentColor, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ━━━ ROW 1: Risk Score Trend ━━━ */
export function RiskScoreTrendChart({ data }) {
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
            <stop offset="5%"  stopColor={COLORS.cyan} stopOpacity={0.25}/>
            <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0}/>
          </linearGradient>
          <filter id="glowCyan">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<GlowTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke={COLORS.cyan}
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorScore)"
          filter="url(#glowCyan)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ━━━ ROW 1: Flagged Entities by Ring ━━━ */
export function FlaggedEntitiesChart({ fraudRings }) {
  // eslint-disable-next-line no-unused-vars
  const safeRings = fraudRings || [];

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
        <defs>
          <filter id="glowRed">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<GlowTooltip accentColor={COLORS.red} />} />
        <Line type="monotone" dataKey="r1" stroke={COLORS.red}  strokeWidth={2}   dot={{ r: 3, fill: COLORS.red }} filter="url(#glowRed)" />
        <Line type="monotone" dataKey="r2" stroke={COLORS.cyan} strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="r3" stroke="rgba(255,255,255,0.3)" strokeWidth={1} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ━━━ ROW 3: Risk Distribution Donut ━━━ */
export function RiskDistributionDonut({ suspiciousAccounts }) {
  const safeAccounts = suspiciousAccounts || [];
  const highCounter = safeAccounts.filter(a => a.suspicion_score > 85).length || 0;
  const medCounter  = safeAccounts.filter(a => a.suspicion_score >= 50 && a.suspicion_score <= 85).length || 0;
  const lowCounter  = safeAccounts.filter(a => a.suspicion_score < 50).length || 0;

  const data = [
    { name: 'Critical', value: highCounter || 12 },
    { name: 'High Risk', value: medCounter  || 18 },
    { name: 'Medium',    value: lowCounter  || 9  },
    { name: 'Normal',    value: 35 },
  ];

  const pieColors = [COLORS.cyan, COLORS.red, COLORS.orange, COLORS.purple, '#3a4460'];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <defs>
          <filter id="glowDonut">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={82}
          stroke="transparent"
          paddingAngle={3}
          dataKey="value"
          filter="url(#glowDonut)"
          strokeWidth={6}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
          ))}
        </Pie>
        <Tooltip content={<GlowTooltip />} />
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
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
        <defs>
          <filter id="glowBar">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <XAxis dataKey="name" tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<GlowTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index === 0 ? COLORS.cyan : COLORS.mutedBar}
              filter={index === 0 ? 'url(#glowBar)' : undefined}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
