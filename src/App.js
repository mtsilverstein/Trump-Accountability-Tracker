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
  const selfDealing = data.selfDealing || {};

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
  const lawsuits = data.lawsuits || [];
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
    { id: 'lawsuits', label: 'Lawsuits', icon: '⚖️' },
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
              <div style={{ fontSize: '12px', color: '#6b6b7b', margin: '8px 0 12px' }}>+{fmt(data.debt?.perSecond || 92912.33, 0)}/second</div>
              
              <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Added This Term</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>+${(debtSinceInauguration / 1e12).toFixed(6)}T</div>
              </div>
            </Card>

            {/* Wealth Card */}
            <Card glow="#22c55e">
              <div style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500', marginBottom: '12px' }}>Trump Net Worth</div>
              <div style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: '700', color: '#22c55e', letterSpacing: '-1px' }}>${wealth.current || 6.6}B</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', margin: '8px 0 12px' }}>Forbes • Rank #{wealth.rank || 581}</div>
              
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

          {/* The Contrast - Combined Chart */}
          <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #13131a 0%, #0f0f14 100%)' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#4a4a5a', marginBottom: '16px', fontWeight: '600', textAlign: 'center' }}>THE CONTRAST</div>
            
            {/* Combined comparison chart */}
            <div style={{ position: 'relative', padding: '20px 16px', background: '#0a0a0f', borderRadius: '12px', marginBottom: '16px' }}>
              <svg width="100%" height="120" viewBox="0 0 200 120" preserveAspectRatio="none" style={{ display: 'block' }}>
                {/* Grid lines */}
                <line x1="0" y1="30" x2="200" y2="30" stroke="#1a1a22" strokeWidth="0.5"/>
                <line x1="0" y1="60" x2="200" y2="60" stroke="#1a1a22" strokeWidth="0.5"/>
                <line x1="0" y1="90" x2="200" y2="90" stroke="#1a1a22" strokeWidth="0.5"/>
                
                {/* Debt line (red) - starts low, climbs high */}
                <path d="M0,100 L20,95 L40,92 L60,85 L80,78 L100,68 L120,55 L140,45 L160,32 L180,22 L200,15" 
                      fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                
                {/* Wealth line (green) - also climbs but different pattern */}
                <path d="M0,95 L20,90 L40,88 L60,82 L80,78 L100,72 L120,65 L140,58 L160,48 L180,40 L200,30" 
                      fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                
                {/* End dots (static, no pulsing) */}
                <circle cx="200" cy="15" r="4" fill="#ef4444"/>
                <circle cx="200" cy="30" r="4" fill="#22c55e"/>
              </svg>
              
              {/* Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '3px', background: '#ef4444', borderRadius: '2px' }}></div>
                  <span style={{ fontSize: '11px', color: '#ef4444' }}>Debt Added: +{fmt(debtSinceInauguration)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '3px', background: '#22c55e', borderRadius: '2px' }}></div>
                  <span style={{ fontSize: '11px', color: '#22c55e' }}>Trump Gained: +${wealthGain.toFixed(1)}B</span>
                </div>
              </div>
            </div>
            
            {/* Stats comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(239,68,68,0.06)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginBottom: '6px', textTransform: 'uppercase' }}>National Debt Added</div>
                <div style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>+{fmt(debtSinceInauguration)}</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>Since Jan 20, 2025</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(34,197,94,0.06)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginBottom: '6px', textTransform: 'uppercase' }}>Trump's Wealth Gain</div>
                <div style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: '700', color: '#22c55e' }}>+${wealthGain.toFixed(1)}B</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>+{wealthGainPercent}% since Jan 2024</div>
              </div>
            </div>
            
            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
              For every <span style={{ color: '#22c55e', fontWeight: '600' }}>$1</span> Trump gained, the national debt increased by <span style={{ color: '#ef4444', fontWeight: '700' }}>${Math.round(debtSinceInauguration / (wealthGain * 1e9)).toLocaleString()}</span>
            </div>
          </Card>

          {/* ICE Summary */}
          <Card glow="#dc2626" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', boxShadow: '0 0 12px rgba(220,38,38,0.6)', animation: 'pulse 2s infinite' }} />
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
            <div style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500', marginBottom: '12px' }}>Taxpayer-Funded Golf (2025)</div>
            <div style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: '700', color: '#eab308', marginBottom: '8px' }}>$110.6M</div>
            <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '16px' }}>88 golf club visits • 25% of days in office</div>
            <div style={{ padding: '14px 16px', background: 'rgba(234,179,8,0.08)', borderRadius: '10px', border: '1px solid rgba(234,179,8,0.15)', fontSize: '13px', color: '#a8a8b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#eab308' }}>Why it matters:</strong> Each Mar-a-Lago trip costs ~$3.4M. Secret Service pays Trump's resorts directly.
            </div>
            <div style={{ marginTop: '16px' }}>
              <ActionLink onClick={() => handleTabClick('money')} color="#eab308">Full Breakdown →</ActionLink>
            </div>
          </Card>
        </>}

        {/* PROMISES */}
        {activeTab === 'promises' && <>
          <PageHeader title="Broken Promises" subtitle="Exact quotes matched against verifiable outcomes" />
          {brokenPromises.length === 0 ? (
            <Card><p style={{ color: '#6b6b7b', textAlign: 'center' }}>Loading promises data...</p></Card>
          ) : brokenPromises.map(p => (
            <Card key={p.id} style={{ marginBottom: '16px', borderLeft: `3px solid ${p.statusColor || '#ef4444'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0, flex: 1 }}>{p.title || p.promise}</h3>
                <span style={{ fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', background: `${p.statusColor || '#ef4444'}20`, color: p.statusColor || '#ef4444', marginLeft: '12px' }}>{p.status}</span>
              </div>
              <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', borderLeft: '2px solid #3a3a4a', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '6px' }}>THE PROMISE</div>
                <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>"{p.quote}"</p>
                <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '8px' }}>— {p.date || p.datePromised}</div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', borderLeft: `2px solid ${p.statusColor || '#ef4444'}` }}>
                <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '6px' }}>REALITY</div>
                {Array.isArray(p.reality) ? (
                  <ul style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                    {p.reality.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                ) : (
                  <p style={{ fontSize: '14px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>{p.reality}</p>
                )}
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

        {/* LAWSUITS */}
        {activeTab === 'lawsuits' && <>
          <PageHeader title="Legal Challenges" subtitle="Lawsuits against Trump and his administration" />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(168,85,247,0.08)', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#a855f7' }}>{lawsuits.length || '100+'}</div>
              <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Active Cases</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(59,130,246,0.08)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{lawsuits.filter(l => l.status === 'Ruling' || l.ruling).length || '—'}</div>
              <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Rulings Issued</div>
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(168,85,247,0.08)', borderRadius: '10px', marginBottom: '24px', fontSize: '12px', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.2)' }}>
            <strong>Note:</strong> This section tracks legal challenges to Trump administration policies, executive orders, and actions. Data updates automatically from news sources.
          </div>

          {lawsuits.length === 0 ? (
            <Card>
              <p style={{ color: '#6b6b7b', textAlign: 'center', margin: 0 }}>
                Lawsuit tracking is being set up. According to NYT, over 100 lawsuits have been filed against the Trump administration in 2025-2026.
              </p>
              <div style={{ marginTop: '16px', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#a855f7', marginBottom: '8px', fontWeight: '600' }}>Key Areas of Litigation:</div>
                <ul style={{ fontSize: '13px', color: '#a8a8b8', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                  <li>Immigration enforcement & deportations</li>
                  <li>Executive order overreach</li>
                  <li>Due process violations</li>
                  <li>First Amendment challenges</li>
                  <li>Environmental rollbacks</li>
                  <li>Federal employee firings</li>
                </ul>
              </div>
            </Card>
          ) : lawsuits.map(l => (
            <Card key={l.id} style={{ marginBottom: '16px', borderLeft: '3px solid #a855f7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0, flex: 1 }}>{l.title}</h3>
                <span style={{ 
                  fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', marginLeft: '12px',
                  background: l.status === 'Ruling' ? 'rgba(34,197,94,0.2)' : l.status === 'Dismissed' ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.2)',
                  color: l.status === 'Ruling' ? '#22c55e' : l.status === 'Dismissed' ? '#ef4444' : '#a855f7'
                }}>{l.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '12px' }}>
                <div><span style={{ color: '#6b6b7b' }}>Plaintiff:</span> <span style={{ color: '#d4d4dc' }}>{l.plaintiff}</span></div>
                <div><span style={{ color: '#6b6b7b' }}>Defendant:</span> <span style={{ color: '#d4d4dc' }}>{l.defendant}</span></div>
                <div><span style={{ color: '#6b6b7b' }}>Court:</span> <span style={{ color: '#d4d4dc' }}>{l.court}</span></div>
                <div><span style={{ color: '#6b6b7b' }}>Filed:</span> <span style={{ color: '#d4d4dc' }}>{l.filed}</span></div>
              </div>
              <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>{l.summary}</p>
              </div>
              {l.ruling && (
                <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', borderLeft: '2px solid #22c55e', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '6px' }}>RULING</div>
                  <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>{l.ruling}</p>
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#4a4a5a' }}>Sources: {(l.sources || []).join(' • ')}</div>
            </Card>
          ))}
        </>}

        {/* MONEY */}
        {activeTab === 'money' && <>
          <PageHeader title="Follow the Money" subtitle="Self-dealing and taxpayer money flowing to Trump businesses" />
          
          <Card glow="#eab308" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#eab308', fontWeight: '600', marginBottom: '12px' }}>💡 KEY INSIGHT</div>
            <p style={{ fontSize: '15px', color: '#e8e8ed', lineHeight: 1.7, margin: 0 }}>
              When Trump golfs at Mar-a-Lago, taxpayers pay ~$3.4 million per trip for Secret Service, Coast Guard, and Air Force One. The Secret Service pays for rooms <strong style={{ color: '#eab308' }}>at resorts Trump owns</strong>, putting taxpayer money directly into his pocket.
            </p>
          </Card>
          
          {/* Golf Costs - The Big Picture */}
          <Card glow="#dc2626" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '16px' }}>⛳</span>
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>Taxpayer-Funded Golf (2025)</span>
            </div>
            <div style={{ fontSize: '42px', fontWeight: '700', color: '#ef4444', marginBottom: '8px' }}>$110.6M</div>
            <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '16px' }}>Estimated total cost for 88 golf club visits in 2025</div>
            
            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {[
                { l: 'Golf club visits in 2025', v: '88', note: '25% of days in office' },
                { l: 'Total property visits', v: '99', note: 'Includes non-golf visits' },
                { l: 'Cost per Mar-a-Lago trip', v: '$3.4M', note: 'GAO 2019 report' },
                { l: 'Cost per Bedminster trip', v: '$1.1M', note: 'Smaller aircraft' },
                { l: 'Scotland trip (July 2025)', v: '~$10M', note: '5-day trip' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#a8a8b8' }}>{r.l}</span>
                    {r.note && <span style={{ fontSize: '10px', color: '#4a4a5a', marginLeft: '8px' }}>({r.note})</span>}
                  </div>
                  <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '700' }}>{r.v}</span>
                </div>
              ))}
            </div>
            
            <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '4px' }}>First Term Comparison</div>
              <div style={{ fontSize: '13px', color: '#d4d4dc' }}>Trump spent <strong style={{ color: '#ef4444' }}>$151.5M</strong> on golf over 4 years in his first term. He's on pace to exceed <strong style={{ color: '#ef4444' }}>$300M</strong> this term.</div>
            </div>
            
            <a href="https://www.citizensforethics.org/reports-investigations/crew-investigations/secret-service-has-spent-nearly-100k-at-trump-properties/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6b6b7b', textDecoration: 'underline' }}>Source: CREW, GAO, HuffPost →</a>
          </Card>
          
          {/* Secret Service Payments TO Trump */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #eab308' }}>
            <div style={{ fontSize: '14px', color: '#eab308', fontWeight: '600', marginBottom: '12px' }}>Secret Service Payments to Trump Businesses</div>
            <p style={{ fontSize: '13px', color: '#a8a8b8', marginBottom: '16px', lineHeight: 1.6 }}>
              These are payments from Secret Service directly to Trump's hotels and resorts - money that goes into his pocket.
            </p>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              {[
                { l: 'Second term (so far)', v: '$100,000+', note: 'First months of 2025' },
                { l: 'First term total', v: '~$2M', note: '2017-2021' },
                { l: 'Charged per night', v: 'Up to $800+', note: 'Above gov rate' },
                { l: 'Bedminster cottage rental', v: '$17,000/mo', note: 'For Secret Service' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#a8a8b8' }}>{r.l}</span>
                    {r.note && <span style={{ fontSize: '10px', color: '#4a4a5a', marginLeft: '8px' }}>({r.note})</span>}
                  </div>
                  <span style={{ fontSize: '14px', color: '#eab308', fontWeight: '700' }}>{r.v}</span>
                </div>
              ))}
            </div>
            <a href="https://www.citizensforethics.org/reports-investigations/crew-investigations/the-secret-service-spent-nearly-2-million-at-trump-properties/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6b6b7b', textDecoration: 'underline' }}>Source: CREW FOIA Records →</a>
          </Card>

          {/* Crypto */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #22c55e' }}>
            <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600', marginBottom: '12px' }}>Crypto Ventures</div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#22c55e', marginBottom: '8px' }}>{fmt(selfDealing.cryptoFees || 427000000)}</div>
            <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '12px' }}>Trading fees from $TRUMP memecoin + World Liberty Financial</div>
            <a href="https://www.ft.com/content/trump-crypto" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6b6b7b', textDecoration: 'underline' }}>Source: Financial Times, Bloomberg →</a>
          </Card>

          {/* Israel Aid */}
          <Card style={{ borderLeft: '3px solid #60a5fa' }}>
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
            <a href="https://watson.brown.edu/costsofwar/costs/economic/budget" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#6b6b7b', textDecoration: 'underline' }}>Source: Brown University Costs of War Project →</a>
          </Card>
        </>}

        {/* ICE */}
        {activeTab === 'ice' && (() => {
          // Filter out invalid entries (no name or empty name)
          const validVictims = iceVictims.filter(v => v.name && v.name.trim() && v.name.trim() !== '');
          const shootingVictims = validVictims.filter(v => v.details?.toLowerCase().includes('shot') || v.details?.toLowerCase().includes('shooting'));
          const usCitizenVictims = validVictims.filter(v => v.citizenship === 'US Citizen');
          
          // Helper for age display
          const formatAge = (age) => (!age || age === 0) ? 'Unknown' : age;
          
          return <>
            <PageHeader title="Federal Agent Violence" subtitle="Shootings and deaths involving ICE, Border Patrol, and CBP" />
            
            {/* Explanation */}
            <Card style={{ marginBottom: '24px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '13px', color: '#d4d4dc', lineHeight: 1.7 }}>
                This page tracks <strong style={{ color: '#fca5a5' }}>shootings by federal immigration agents</strong> (ICE, Border Patrol, CBP) and <strong style={{ color: '#fca5a5' }}>deaths in immigration detention</strong>. These are separate categories—shootings occur during enforcement operations, while detention deaths occur in custody facilities.
              </div>
            </Card>

            {/* Shooting Stats */}
            <Card glow="#dc2626" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>Shootings by Federal Agents</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>{iceStats.totalShootings || 27}+</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Total Shootings</div>
                  <div style={{ fontSize: '9px', color: '#4a4a5a', marginTop: '2px' }}>Since Jan 2025</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{iceStats.shootingDeaths || 8}</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Killed</div>
                  <div style={{ fontSize: '9px', color: '#4a4a5a', marginTop: '2px' }}>By gunfire</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#f87171' }}>{usCitizenVictims.length}</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>US Citizens</div>
                  <div style={{ fontSize: '9px', color: '#4a4a5a', marginTop: '2px' }}>Shot or killed</div>
                </div>
              </div>
            </Card>

            {/* Detention Deaths */}
            <Card style={{ marginBottom: '24px', borderLeft: '3px solid #f97316' }}>
              <div style={{ fontSize: '14px', color: '#f97316', fontWeight: '600', marginBottom: '12px' }}>Deaths in Immigration Detention</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '14px', background: 'rgba(249,115,22,0.1)', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#f97316' }}>{iceStats.detentionDeaths2025 || 32}</div>
                  <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Deaths in 2025</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(249,115,22,0.1)', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#fb923c' }}>{iceStats.detentionDeaths2026 || 6}</div>
                  <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Deaths in 2026</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '12px', padding: '10px 12px', background: '#0a0a0f', borderRadius: '6px' }}>
                <strong style={{ color: '#f97316' }}>Note:</strong> 2025 had the highest ICE detention deaths since 2004. December 2025 was the deadliest month on record.
              </div>
            </Card>

            {/* Section header for individual incidents */}
            <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #1e1e28' }}>
              <span style={{ color: '#fff', fontWeight: '600' }}>Documented Shooting Incidents</span> • {validVictims.length} on record
            </div>

            {/* Individual Victim Cards */}
            {validVictims.map(v => (
              <Card key={v.id} style={{ marginBottom: '16px', borderLeft: `3px solid ${v.citizenship === 'US Citizen' ? '#dc2626' : '#f97316'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>{v.name}</h3>
                  {v.citizenship === 'US Citizen' && (
                    <span style={{ fontSize: '9px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px', background: 'rgba(220,38,38,0.2)', color: '#fca5a5' }}>US CITIZEN</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#a8a8b8', marginBottom: '4px' }}>
                  {formatAge(v.age) !== 'Unknown' && <>Age {formatAge(v.age)} • </>}
                  {v.citizenship && v.citizenship !== 'Unknown' && <>{v.citizenship} • </>}
                  {v.agency}
                </div>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '12px' }}>
                  {v.date}{v.location && <> • {v.location}</>}
                </div>
                {v.details && (
                  <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', color: '#d4d4dc', lineHeight: 1.6 }}>{v.details}</div>
                )}
                {(v.officialResponse || v.witnessAccount) && (
                  <div style={{ display: 'grid', gridTemplateColumns: v.officialResponse && v.witnessAccount ? '1fr 1fr' : '1fr', gap: '10px' }}>
                    {v.officialResponse && (
                      <div style={{ padding: '12px', background: 'rgba(220,38,38,0.08)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#fca5a5', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>OFFICIAL STATEMENT</div>
                        <div style={{ fontSize: '11px', color: '#a8a8b8', lineHeight: 1.5 }}>{v.officialResponse}</div>
                      </div>
                    )}
                    {v.witnessAccount && (
                      <div style={{ padding: '12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#86efac', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>WITNESS / OTHER ACCOUNT</div>
                        <div style={{ fontSize: '11px', color: '#a8a8b8', lineHeight: 1.5 }}>{v.witnessAccount}</div>
                      </div>
                    )}
                  </div>
                )}
                {v.sources && v.sources.length > 0 && (
                  <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: {v.sources.join(' • ')}</div>
                )}
              </Card>
            ))}

            {/* Data source */}
            <div style={{ fontSize: '10px', color: '#4a4a5a', textAlign: 'center', marginTop: '24px' }}>
              Data compiled from: Wikipedia • NPR • AP News • ACLU • Vera Institute • Local news reports
            </div>
          </>;
        })()}

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
