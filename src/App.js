import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { INITIAL_DATA } from './initialData';

function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('overview');
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('tracker-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracker_data' },
        (payload) => { if (payload.new?.data) { setData(payload.new.data); setLastSync(new Date().toISOString()); } })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchData() {
    try {
      const { data: result, error } = await supabase.from('tracker_data').select('data, updated_at').eq('id', 'main').single();
      if (error) throw error;
      if (result?.data && Object.keys(result.data).length > 0) { setData(result.data); setLastSync(result.updated_at); }
    } catch (err) { console.error('Error:', err); }
    finally { setLoading(false); }
  }

  const INAUGURATION = new Date('2025-01-20T17:00:00Z');
  const liveDebt = useMemo(() => {
    const baselineDate = new Date(data.debt?.baselineDate || '2026-01-07T00:00:00Z');
    return ((data.debt?.baseline || 38.43) * 1e12) + (((now - baselineDate.getTime()) / 1000) * (data.debt?.perSecond || 92912.33));
  }, [now, data.debt]);
  const debtSinceInauguration = liveDebt - ((data.debt?.atInauguration || 36.18) * 1e12);
  const timeSinceInauguration = useMemo(() => {
    const sec = Math.floor((now - INAUGURATION.getTime()) / 1000);
    return { days: Math.floor(sec / 86400), hours: Math.floor((sec % 86400) / 3600), minutes: Math.floor((sec % 3600) / 60), seconds: sec % 60 };
  }, [now]);
  
  const wealthGain = (data.wealth?.current || 6.6) - (data.wealth?.previous || 2.3);
  const wealthGainPercent = Math.round((wealthGain / (data.wealth?.previous || 2.3)) * 100);
  const golf = data.golf || {};
  const totalTrips = (golf.marALagoTrips || 0) + (golf.bedminsterTrips || 0) + (golf.scotlandTrips || 0);
  const selfDealing = data.selfDealing || {};
  const selfDealingFromGolf = totalTrips * (selfDealing.revenuePerTrip || 60000);

  const fmt = (val, dec = 2) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(dec)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(dec)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(dec)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(dec)}K`;
    return `$${val.toLocaleString()}`;
  };
  const pad = (n) => String(n).padStart(2, '0');

  const iceVictims = data.iceVictims || [];
  const iceStats = data.iceStats || {};
  const brokenPromises = data.brokenPromises || [];
  const wealth = data.wealth || {};

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #252530', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        Loading...
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'promises', label: 'Promises', icon: '❌' },
    { id: 'constitution', label: 'Constitution', icon: '📜' },
    { id: 'money', label: 'Money', icon: '💰' },
    { id: 'ice', label: 'ICE', icon: '⚠️' },
    { id: 'action', label: 'Act Now', icon: '📞' },
  ];

  const Card = ({ children, style, glow }) => (
    <div style={{ 
      background: '#13131a', 
      borderRadius: '16px', 
      padding: '24px', 
      border: '1px solid #1e1e28',
      boxShadow: glow ? `0 0 40px ${glow}15, 0 4px 20px rgba(0,0,0,0.4)` : '0 4px 20px rgba(0,0,0,0.3)',
      ...style 
    }}>{children}</div>
  );

  const PageHeader = ({ title, subtitle }) => (
    <div style={{ marginBottom: '32px', textAlign: 'center' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#fff', margin: '0 0 8px 0' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '14px', color: '#6b6b7b', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>{subtitle}</p>}
    </div>
  );

  // Simple button component
  const NavButton = ({ active, onClick, icon, label }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 0',
        minWidth: '0',
        padding: '12px 4px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #ef4444' : '2px solid transparent',
        color: active ? '#fff' : '#6b6b7b',
        cursor: 'pointer',
        fontSize: '9px',
        fontWeight: '600',
        textAlign: 'center',
        fontFamily: 'inherit',
        touchAction: 'manipulation',
      }}
    >
      <div style={{ fontSize: '16px', marginBottom: '4px' }}>{icon}</div>
      {label}
    </button>
  );

  const ActionLink = ({ onClick, children, color }) => (
    <button
      type="button"
      onClick={onClick}
      style={{ 
        display: 'block',
        width: '100%', 
        padding: '14px', 
        background: `${color}15`, 
        border: `1px solid ${color}40`, 
        borderRadius: '10px', 
        color: color, 
        fontSize: '13px', 
        fontWeight: '600',
        cursor: 'pointer',
        textAlign: 'center',
        fontFamily: 'inherit',
        touchAction: 'manipulation',
      }}
    >{children}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: 'Inter, -apple-system, sans-serif', color: '#e8e8ed', lineHeight: 1.6 }}>
      
      {/* Header */}
      <header style={{ background: 'linear-gradient(180deg, #0f0f14 0%, #0a0a0f 100%)', padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'rgba(239,68,68,0.1)', padding: '6px 14px', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '10px', letterSpacing: '1.5px', color: '#ef4444', fontWeight: '600' }}>LIVE TRACKER</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: '800', color: '#fff', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Trump Accountability</h1>
          <p style={{ fontSize: '14px', color: '#6b6b7b', margin: '0 0 24px 0' }}>Facts with sources. Updated automatically.</p>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '14px 24px', background: '#13131a', borderRadius: '12px', border: '1px solid #1e1e28', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <span style={{ fontSize: '11px', color: '#6b6b7b', fontWeight: '500' }}>TERM TO DATE</span>
            <span style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>
              {timeSinceInauguration.days}<span style={{ color: '#4a4a5a' }}>d</span> {pad(timeSinceInauguration.hours)}<span style={{ color: '#4a4a5a' }}>h</span> {pad(timeSinceInauguration.minutes)}<span style={{ color: '#4a4a5a' }}>m</span> {pad(timeSinceInauguration.seconds)}<span style={{ color: '#4a4a5a' }}>s</span>
            </span>
          </div>
          
          {lastSync && <div style={{ fontSize: '10px', color: '#3a3a4a', marginTop: '16px' }}>Last sync: {new Date(lastSync).toLocaleString()}</div>}
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background: '#0a0a0f', position: 'sticky', top: 0, zIndex: 1000, borderBottom: '1px solid #1a1a22' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', padding: '0 4px' }}>
          {tabs.map(t => (
            <NavButton key={t.id} active={activeTab === t.id} onClick={() => handleTabClick(t.id)} icon={t.icon} label={t.label} />
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px 48px' }}>
        
        {/* OVERVIEW */}
        {activeTab === 'overview' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            {/* Debt Card */}
            <Card glow="#ef4444">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500' }}>U.S. National Debt</span>
                <span style={{ fontSize: '9px', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '4px 10px', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }}></span> LIVE</span>
              </div>
              <div style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-1px' }}>
                ${(liveDebt / 1e12).toFixed(6)}T
              </div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', margin: '8px 0 16px' }}>+{fmt(data.debt?.perSecond || 92912.33, 0)}/second</div>
              <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Added This Term</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>+${(debtSinceInauguration / 1e12).toFixed(6)}T</div>
              </div>
            </Card>

            {/* Wealth Card */}
            <Card glow="#22c55e">
              <div style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500', marginBottom: '12px' }}>Trump Net Worth</div>
              <div style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: '700', color: '#22c55e', letterSpacing: '-1px' }}>${wealth.current || 6.6}B</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', margin: '8px 0 16px' }}>Forbes • Rank #{wealth.rank || 581}</div>
              <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Gained Since Jan 2024</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>+${wealthGain.toFixed(1)}B <span style={{ fontSize: '14px', fontWeight: '500' }}>(+{wealthGainPercent}%)</span></div>
              </div>
            </Card>

            {/* Promises Card */}
            <Card glow="#f97316">
              <div style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500', marginBottom: '12px' }}>Campaign Promises Tracked</div>
              <div style={{ fontSize: '48px', fontWeight: '700', color: '#f97316', lineHeight: 1 }}>
                {brokenPromises.filter(p => p.status === 'BROKEN').length}<span style={{ fontSize: '24px', color: '#6b6b7b' }}>/{brokenPromises.length}</span>
              </div>
              <div style={{ fontSize: '14px', color: '#f97316', margin: '8px 0 16px', fontWeight: '500' }}>Broken So Far</div>
              <ActionLink onClick={() => handleTabClick('promises')} color="#f97316">View All Promises →</ActionLink>
            </Card>
          </div>

          {/* The Contrast - clean stock charts */}
          <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #13131a 0%, #0f0f14 100%)' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#4a4a5a', marginBottom: '20px', fontWeight: '600', textAlign: 'center' }}>THE CONTRAST</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
              
              {/* Trump's Gain - Green Up Chart */}
              <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(34,197,94,0.04)', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.12)' }}>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trump's Gain</div>
                <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: '700', color: '#22c55e', marginBottom: '12px' }}>+${wealthGain.toFixed(1)}B</div>
                <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ display: 'block' }}>
                  <defs>
                    <linearGradient id="greenFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,35 C10,33 20,30 30,26 C40,22 50,18 60,14 C70,11 80,8 90,6 L100,4 L100,40 L0,40 Z" fill="url(#greenFill)"/>
                  <path d="M0,35 C10,33 20,30 30,26 C40,22 50,18 60,14 C70,11 80,8 90,6 L100,4" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '8px' }}>
                  <span style={{ color: '#22c55e', fontSize: '14px' }}>▲</span>
                  <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '600' }}>UP</span>
                </div>
              </div>
              
              <div style={{ fontSize: '12px', color: '#3a3a4a', fontWeight: '600' }}>vs</div>
              
              {/* Debt - Red Down Chart */}
              <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(239,68,68,0.04)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.12)' }}>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Added to Debt</div>
                <div style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', marginBottom: '12px' }}>+{fmt(debtSinceInauguration)}</div>
                <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ display: 'block' }}>
                  <defs>
                    <linearGradient id="redFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02"/>
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,6 C10,8 20,12 30,16 C40,20 50,24 60,28 C70,31 80,34 90,36 L100,38 L100,40 L0,40 Z" fill="url(#redFill)"/>
                  <path d="M0,6 C10,8 20,12 30,16 C40,20 50,24 60,28 C70,31 80,34 90,36 L100,38" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '8px' }}>
                  <span style={{ color: '#ef4444', fontSize: '14px' }}>▼</span>
                  <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>DOWN</span>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
              For every <span style={{ color: '#22c55e', fontWeight: '600' }}>$1</span> Trump gained, debt increased by <span style={{ color: '#ef4444', fontWeight: '700' }}>${Math.round(debtSinceInauguration / (wealthGain * 1e9)).toLocaleString()}</span>
            </div>
          </Card>

          {/* ICE Summary */}
          <Card glow="#dc2626" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', boxShadow: '0 0 12px rgba(220,38,38,0.6)' }} />
              <span style={{ fontSize: '13px', color: '#fca5a5', fontWeight: '600' }}>U.S. Citizens Killed by Federal Agents</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {iceVictims.slice(0, 2).map(v => (
                <div key={v.id} style={{ background: 'rgba(220,38,38,0.08)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>{v.name}</div>
                  <div style={{ fontSize: '11px', color: '#fca5a5' }}>Age {v.age} • {v.agency}</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>{v.date}</div>
                </div>
              ))}
            </div>
            <ActionLink onClick={() => handleTabClick('ice')} color="#fca5a5">Full Details →</ActionLink>
          </Card>

          {/* Constitution Summary */}
          <Card glow="#a855f7" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>📜</span>
              <span style={{ fontSize: '13px', color: '#c4b5fd', fontWeight: '600' }}>Constitutional Concerns</span>
            </div>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              {[
                { title: 'Defying Court Orders', desc: 'Federal judges found administration in contempt', color: '#a855f7' },
                { title: 'Due Process Violations', desc: 'Deportations without hearings', color: '#f59e0b' },
                { title: 'First Amendment', desc: 'Force against protesters, threats to press', color: '#3b82f6' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '2px' }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <ActionLink onClick={() => handleTabClick('constitution')} color="#a855f7">View All Concerns →</ActionLink>
          </Card>

          {/* Golf Summary */}
          <Card glow="#eab308">
            <div style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500', marginBottom: '12px' }}>Taxpayer-Funded Golf</div>
            <div style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: '700', color: '#eab308', marginBottom: '8px' }}>{fmt(selfDealingFromGolf)}</div>
            <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '16px' }}>{totalTrips} trips to Trump properties</div>
            <div style={{ padding: '14px 16px', background: 'rgba(234,179,8,0.08)', borderRadius: '10px', border: '1px solid rgba(234,179,8,0.15)', fontSize: '13px', color: '#a8a8b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#eab308' }}>Why it matters:</strong> Secret Service pays Trump's resorts. Money goes directly to his pocket.
            </div>
            <div style={{ marginTop: '16px' }}>
              <ActionLink onClick={() => handleTabClick('money')} color="#eab308">Full Breakdown →</ActionLink>
            </div>
          </Card>
        </>}

        {/* PROMISES */}
        {activeTab === 'promises' && <>
          <PageHeader title="Broken Promises" subtitle="Exact quotes matched against verifiable outcomes" />
          {brokenPromises.map(p => (
            <Card key={p.id} style={{ marginBottom: '16px', borderLeft: `3px solid ${p.statusColor || '#ef4444'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0, flex: 1 }}>{p.title}</h3>
                <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: `${p.statusColor || '#ef4444'}20`, color: p.statusColor || '#ef4444', marginLeft: '12px' }}>{p.status}</span>
              </div>
              <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', borderLeft: '2px solid #3a3a4a', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '6px' }}>THE PROMISE</div>
                <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>"{p.quote}"</p>
                <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '8px' }}>— {p.date}</div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', borderLeft: `2px solid ${p.statusColor || '#ef4444'}` }}>
                <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '6px' }}>REALITY</div>
                <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>{p.reality}</p>
              </div>
              <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: {(p.sources || []).join(' • ')}</div>
            </Card>
          ))}
        </>}

        {/* CONSTITUTION */}
        {activeTab === 'constitution' && <>
          <PageHeader title="Constitutional Concerns" subtitle="Documented actions, rulings, and statements that challenge constitutional principles" />
          
          <div style={{ padding: '14px 16px', background: 'rgba(147,51,234,0.08)', borderRadius: '10px', marginBottom: '24px', fontSize: '12px', color: '#c4b5fd', border: '1px solid rgba(147,51,234,0.2)' }}>
            <strong>Note:</strong> This section presents documented facts—direct quotes, court rulings, and official actions. Each item includes primary sources for verification.
          </div>

          {/* Defying Court Orders */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: 'rgba(168,85,247,0.2)', color: '#a855f7' }}>SEPARATION OF POWERS</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>Administration Defies Federal Court Orders</h3>
            <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                Multiple federal judges have issued rulings finding the administration in contempt or violation of court orders regarding deportation flights and immigration enforcement. In January 2026, a federal judge ruled the administration violated a court order by continuing deportation flights after a temporary restraining order was issued.
              </p>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.06)', borderRadius: '8px', borderLeft: '2px solid #a855f7' }}>
              <div style={{ fontSize: '12px', color: '#a855f7', marginBottom: '6px' }}>CONSTITUTIONAL PRINCIPLE</div>
              <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                Article III establishes the judiciary as a co-equal branch. Executive defiance of court orders undermines judicial review—a cornerstone of constitutional checks and balances since Marbury v. Madison (1803).
              </p>
            </div>
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: AP News • Reuters • Federal Court Records • ACLU</div>
          </Card>

          {/* Due Process */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>5TH & 14TH AMENDMENTS</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>Deportations Without Due Process</h3>
            <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                Reports document individuals—including U.S. citizens and legal residents—being detained and in some cases deported without access to attorneys or immigration hearings. The ACLU has filed multiple emergency lawsuits citing due process violations.
              </p>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: '8px', borderLeft: '2px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px' }}>CONSTITUTIONAL TEXT</div>
              <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                "No person shall be... deprived of life, liberty, or property, without due process of law." — Fifth Amendment
              </p>
            </div>
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: ACLU • NPR • Washington Post • Court Filings</div>
          </Card>

          {/* First Amendment */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>1ST AMENDMENT</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>Threats Against Press and Protesters</h3>
            <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                The administration has called for revoking broadcast licenses of critical news networks, labeled journalists "enemies of the people," and federal agents have used force against peaceful protesters. Two U.S. citizens have been shot by federal agents during immigration protests in January 2026.
              </p>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', borderLeft: '2px solid #3b82f6' }}>
              <div style={{ fontSize: '12px', color: '#3b82f6', marginBottom: '6px' }}>CONSTITUTIONAL TEXT</div>
              <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                "Congress shall make no law... abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble." — First Amendment
              </p>
            </div>
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: Committee to Protect Journalists • PEN America • NPR • Video Evidence</div>
          </Card>

          {/* Emoluments */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #22c55e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>ARTICLE I, SECTION 9</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>Foreign Payments to President's Businesses</h3>
            <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                Foreign governments have spent millions at Trump properties. Saudi Arabia, China, and other nations have booked rooms at Trump hotels during official visits. The President has not divested from his businesses and continues to profit while in office.
              </p>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', borderLeft: '2px solid #22c55e' }}>
              <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '6px' }}>CONSTITUTIONAL TEXT</div>
              <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                "No Person holding any Office... shall, without the Consent of the Congress, accept of any present, Emolument... from any King, Prince, or foreign State." — Emoluments Clause
              </p>
            </div>
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: CREW • House Oversight Committee • GSA Records • Financial Times</div>
          </Card>

          {/* Pardon Power */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>ARTICLE II & RULE OF LAW</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>Pardons for January 6th Defendants</h3>
            <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                On his first day in office, President Trump issued pardons to over 1,500 individuals convicted of crimes related to the January 6th, 2021 Capitol attack, including those convicted of assaulting police officers. This included commutations for Oath Keepers and Proud Boys leaders convicted of seditious conspiracy.
              </p>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', borderLeft: '2px solid #ef4444' }}>
              <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '6px' }}>CONCERN</div>
              <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                While the pardon power is constitutionally broad, using it to pardon those who attacked Congress during certification of an election the President lost raises unprecedented rule-of-law concerns.
              </p>
            </div>
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: DOJ Records • White House Statements • AP News • NPR</div>
          </Card>

        </>}

        {/* MONEY */}
        {activeTab === 'money' && <>
          <PageHeader title="Follow the Money" subtitle="Self-dealing and taxpayer money flowing to Trump businesses" />
          
          <Card glow="#eab308" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#eab308', fontWeight: '600', marginBottom: '12px' }}>💡 KEY INSIGHT</div>
            <p style={{ fontSize: '15px', color: '#e8e8ed', lineHeight: 1.7, margin: 0 }}>
              When Trump golfs at Mar-a-Lago, taxpayers pay for Secret Service rooms <strong style={{ color: '#eab308' }}>at a resort he owns</strong>. This money goes <strong style={{ color: '#eab308' }}>directly into his bank account</strong>.
            </p>
          </Card>
          
          <Card style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#eab308', fontWeight: '600', marginBottom: '16px' }}>Golf Self-Dealing (Term to Date)</div>
            {[
              { l: 'Golf trips to Trump properties', v: totalTrips, s: 'CREW' },
              { l: 'Total property visits', v: golf.propertyVisits2025 || 129, s: 'CREW' },
              { l: 'Est. cost per trip', v: fmt(selfDealing.revenuePerTrip || 60000), s: 'GAO' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#888' }}>{r.l}</span>
                <span style={{ fontSize: '13px' }}><span style={{ color: '#eab308', fontWeight: '600' }}>{r.v}</span> <span style={{ color: '#4a4a5a', fontSize: '10px' }}>({r.s})</span></span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(234,179,8,0.1)', borderRadius: '10px', marginTop: '8px' }}>
              <span style={{ fontWeight: '600', color: '#fff' }}>Est. to Trump's pocket</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#eab308' }}>{fmt(selfDealingFromGolf)}</span>
            </div>
          </Card>

          <Card style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600', marginBottom: '12px' }}>Crypto Ventures</div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#22c55e', marginBottom: '8px' }}>{fmt(selfDealing.cryptoFees || 427000000)}</div>
            <div style={{ fontSize: '13px', color: '#6b6b7b' }}>Trading fees from $TRUMP memecoin + World Liberty Financial</div>
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: Financial Times • Bloomberg</div>
          </Card>

          <Card>
            <div style={{ fontSize: '14px', color: '#60a5fa', fontWeight: '600', marginBottom: '16px' }}>"America First" vs Israel Military Aid</div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#60a5fa', marginBottom: '8px' }}>$21.7B+</div>
            <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '16px' }}>U.S. military aid since Oct 2023</div>
            {[
              { l: 'Arms sales since Jan 2025', v: '$10.1B+' },
              { l: 'Emergency transfer (Mar 2025)', v: '$4B' },
              { l: 'Bypassed Congress', v: '2 times' }
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#888' }}>{r.l}</span>
                <span style={{ fontSize: '13px', color: '#60a5fa', fontWeight: '600' }}>{r.v}</span>
              </div>
            ))}
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: Brown University • State Dept • Quincy Institute</div>
          </Card>
        </>}

        {/* ICE */}
        {activeTab === 'ice' && <>
          <PageHeader title="Citizens Killed by Federal Agents" subtitle="Documented incidents with sources" />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { v: iceVictims.filter(x => x.citizenship === 'US Citizen').length, l: 'US Citizens', c: '#dc2626' },
              { v: `${iceStats.totalShootings || 27}+`, l: 'Shootings', c: '#ef4444' },
              { v: iceStats.shootingDeaths || 8, l: 'Deaths', c: '#f87171' },
              { v: iceStats.detentionDeaths2025 || 32, l: '2025 Detention', c: '#fca5a5' }
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '16px', background: 'rgba(220,38,38,0.08)', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: s.c }}>{s.v}</div>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(220,38,38,0.08)', borderRadius: '10px', marginBottom: '24px', fontSize: '12px', color: '#fca5a5' }}>
            <strong>Context:</strong> 2025 had highest ICE detention deaths since 2004.
          </div>

          {iceVictims.map(v => (
            <Card key={v.id} style={{ marginBottom: '16px', borderLeft: '3px solid #dc2626' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: '0 0 4px 0' }}>{v.name}</h3>
              <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>Age {v.age} • {v.citizenship} • {v.agency}</div>
              <div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '12px' }}>{v.date} • {v.location}</div>
              <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', color: '#d4d4dc', lineHeight: 1.6 }}>{v.details}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px', background: 'rgba(220,38,38,0.08)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#fca5a5', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>OFFICIAL</div>
                  <div style={{ fontSize: '11px', color: '#a8a8b8', lineHeight: 1.5 }}>{v.officialResponse}</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#86efac', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>WITNESS</div>
                  <div style={{ fontSize: '11px', color: '#a8a8b8', lineHeight: 1.5 }}>{v.witnessAccount}</div>
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: {(v.sources || []).join(' • ')}</div>
            </Card>
          ))}
        </>}

        {/* SOURCES */}
        {activeTab === 'sources' && <>
          <PageHeader title="Sources & Methodology" subtitle="Every claim backed by reputable sources" />
          {[
            { c: 'National Debt', s: 'Treasury Debt to the Penny • JEC • CBO', icon: '📊' },
            { c: 'Wealth', s: 'Forbes • Bloomberg • NYT', icon: '💰' },
            { c: 'Golf/Travel', s: 'GAO 2019 Report • CREW • HuffPost', icon: '⛳' },
            { c: 'Self-Dealing', s: 'CREW • American Oversight • House Oversight', icon: '🏨' },
            { c: 'Promises', s: 'PolitiFact • CNN • NPR • BLS • EIA', icon: '📝' },
            { c: 'Constitution', s: 'Federal Court Records • ACLU • AP News • DOJ', icon: '📜' },
            { c: 'ICE/CBP', s: 'NPR • AP • ACLU • Vera Institute', icon: '⚠️' },
            { c: 'Israel Aid', s: 'Brown University • State Dept • Quincy', icon: '🌍' }
          ].map((x, i) => (
            <Card key={i} style={{ marginBottom: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{x.icon}</span>
                <h3 style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: '600' }}>{x.c}</h3>
              </div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', paddingLeft: '26px' }}>{x.s}</div>
            </Card>
          ))}
          
          <Card style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '14px', color: '#fff', margin: '0 0 12px 0', fontWeight: '600' }}>Methodology</h3>
            <p style={{ fontSize: '13px', color: '#6b6b7b', margin: 0, lineHeight: 1.7 }}>
              All data is objective and verifiable. Every claim requires mainstream sources. ICE incidents require multiple source verification. Data auto-updates via AI news monitoring every 30 minutes.
            </p>
            <div style={{ marginTop: '16px', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
              <strong style={{ color: '#a8a8b8' }}>Found an error?</strong> We welcome corrections with sources.
            </div>
          </Card>
        </>}

        {/* TAKE ACTION */}
        {activeTab === 'action' && <>
          <PageHeader title="Take Action" subtitle="Your voice matters. Make it heard." />
          
          <Card glow="#3b82f6" style={{ marginBottom: '24px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📞</div>
            <h3 style={{ fontSize: '20px', color: '#fff', margin: '0 0 12px 0', fontWeight: '700' }}>Contact Your Representatives</h3>
            <p style={{ fontSize: '14px', color: '#6b6b7b', margin: '0 0 24px 0', lineHeight: 1.7 }}>
              Your elected officials work for you. They need to hear from constituents. One phone call can make a difference.
            </p>
            
            <a 
              href="https://www.house.gov/representatives/find-your-representative" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '18px 20px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '12px', marginBottom: '12px', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '16px', color: '#3b82f6', fontWeight: '700' }}>Find Your Representative</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '6px' }}>house.gov — U.S. House of Representatives</div>
            </a>
            
            <a 
              href="https://www.senate.gov/senators/senators-contact.htm" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '18px 20px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '12px', marginBottom: '12px', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '16px', color: '#3b82f6', fontWeight: '700' }}>Contact Your Senators</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '6px' }}>senate.gov — U.S. Senate</div>
            </a>
            
            <a 
              href="https://www.usa.gov/elected-officials" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '18px 20px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '12px', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '16px', color: '#3b82f6', fontWeight: '700' }}>All Elected Officials</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '6px' }}>usa.gov — Federal, state, and local contacts</div>
            </a>
          </Card>

          <Card style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: '#a855f7', margin: '0 0 16px 0', fontWeight: '600' }}>Organizations Fighting for Accountability</h3>
            
            <a 
              href="https://www.aclu.org/take-action" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '14px 16px', background: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', borderRadius: '8px', marginBottom: '10px', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '13px', color: '#a855f7', fontWeight: '600' }}>ACLU Action Center</div>
              <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Defending civil liberties and constitutional rights</div>
            </a>

            <a 
              href="https://www.citizensforethics.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '14px 16px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '8px', marginBottom: '10px', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '13px', color: '#eab308', fontWeight: '600' }}>CREW (Citizens for Ethics)</div>
              <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Tracking corruption and conflicts of interest</div>
            </a>

            <a 
              href="https://www.commoncause.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '14px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', textDecoration: 'none' }}
            >
              <div style={{ fontSize: '13px', color: '#22c55e', fontWeight: '600' }}>Common Cause</div>
              <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Protecting democracy and voting rights</div>
            </a>
          </Card>

          <Card style={{ borderLeft: '3px solid #ef4444' }}>
            <h3 style={{ fontSize: '14px', color: '#ef4444', margin: '0 0 12px 0', fontWeight: '600' }}>Tips for Effective Calls</h3>
            <ul style={{ fontSize: '13px', color: '#a8a8b8', margin: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
              <li>Be polite but firm — staffers track constituent sentiment</li>
              <li>State your name and that you're a constituent</li>
              <li>Focus on one specific issue per call</li>
              <li>Ask for the representative's position on the issue</li>
              <li>Calls are more impactful than emails</li>
            </ul>
          </Card>
        </>}
      </main>

      <footer style={{ borderTop: '1px solid #1a1a22', padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#4a4a5a', marginBottom: '12px' }}>Built for transparency • Auto-updates every 30 min</div>
        <button
          type="button"
          onClick={() => handleTabClick('sources')}
          style={{ background: 'none', border: 'none', color: '#6b6b7b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
        >View Sources & Methodology</button>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::selection { background: rgba(239,68,68,.3) }
        nav div::-webkit-scrollbar { display: none }
        a, button { touch-action: manipulation; -webkit-touch-callout: none; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
      `}</style>
    </div>
  );
}

export default App;
