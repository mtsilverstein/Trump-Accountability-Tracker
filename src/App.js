import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { supabase } from './supabaseClient';
import { INITIAL_DATA } from './initialData';

// ==================== ERROR BOUNDARY (Priority Action #3) ====================
// Catches JavaScript errors anywhere in child component tree and displays fallback UI

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          background: '#0a0a0f', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontFamily: 'Inter, sans-serif',
          padding: '20px'
        }}>
          <div style={{ 
            textAlign: 'center', 
            maxWidth: '400px',
            padding: '32px',
            background: '#13131a',
            borderRadius: '16px',
            border: '1px solid rgba(239,68,68,0.3)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#ef4444', margin: '0 0 12px 0', fontSize: '20px' }}>Something went wrong</h2>
            <p style={{ color: '#6b6b7b', margin: '0 0 24px 0', fontSize: '14px', lineHeight: 1.6 }}>
              The tracker encountered an error. This has been logged automatically.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                background: '#ef4444',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==================== RETRY LOGIC (Priority Action #4) ====================
// Exponential backoff for failed API requests

async function fetchWithRetry(fetchFn, maxAttempts = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fetchFn();
      return result;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === maxAttempts) {
        throw error;
      }
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    setError(null);
    try {
      // Use retry logic for fetching
      const result = await fetchWithRetry(async () => {
        const { data: result, error } = await supabase
          .from('tracker_data')
          .select('data, updated_at')
          .eq('id', 'main')
          .single();
        if (error) throw error;
        return result;
      });
      
      if (result?.data && Object.keys(result.data).length > 0) {
        setData(result.data);
        setLastSync(result.updated_at);
      }
    } catch (err) {
      console.error('Error fetching data after retries:', err);
      setError(err.message);
      // Still show the page with initial/cached data
    } finally {
      setLoading(false);
    }
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
    { id: 'overview', label: 'Home', icon: '📊' },
    { id: 'promises', label: 'Promises', icon: '❌' },
    { id: 'constitution', label: 'Const.', icon: '📜' },
    { id: 'lawsuits', label: 'Legal', icon: '⚖️' },
    { id: 'money', label: 'Money', icon: '💰' },
    { id: 'ice', label: 'ICE', icon: '⚠️' },
    { id: 'polls', label: 'Polls', icon: '📉' },
    { id: 'action', label: 'Act', icon: '📞' },
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
        padding: '10px 2px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #ef4444' : '2px solid transparent',
        color: active ? '#fff' : '#6b6b7b',
        cursor: 'pointer',
        fontSize: '8px',
        fontWeight: '600',
        textAlign: 'center',
        fontFamily: 'inherit',
        touchAction: 'manipulation',
      }}
    >
      <div style={{ fontSize: '14px', marginBottom: '2px' }}>{icon}</div>
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

      {/* Error Banner - shows when data fetch failed but we're showing cached data */}
      {error && (
        <div style={{ 
          background: 'rgba(239,68,68,0.1)', 
          borderBottom: '1px solid rgba(239,68,68,0.3)',
          padding: '12px 20px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '12px', color: '#fca5a5' }}>
            ⚠️ Could not refresh data. Showing cached version.{' '}
            <button 
              onClick={fetchData}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#ef4444', 
                textDecoration: 'underline', 
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'inherit'
              }}
            >
              Retry
            </button>
          </span>
        </div>
      )}

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
              <a href="https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/debt-to-the-penny" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '10px', fontSize: '10px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: U.S. Treasury →</a>
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
              <a href="https://www.forbes.com/profile/donald-trump/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '10px', fontSize: '10px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: Forbes Billionaires →</a>
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

          {/* Trump's Personal Enrichment - THE MAIN STORY */}
          <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #13131a 0%, #0f0f14 100%)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#22c55e', marginBottom: '16px', fontWeight: '600', textAlign: 'center' }}>TRUMP'S PERSONAL ENRICHMENT</div>
            
            {/* Main wealth gain */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: 'clamp(48px, 10vw, 64px)', fontWeight: '800', color: '#22c55e', lineHeight: 1 }}>
                +${wealthGain.toFixed(1)}B
              </div>
              <div style={{ fontSize: '14px', color: '#6b6b7b', marginTop: '8px' }}>Net worth gain since taking office</div>
              <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px', fontWeight: '600' }}>+{wealthGainPercent}% increase</div>
            </div>

            {/* Comparison that makes sense */}
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '14px 16px', background: '#0a0a0f', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#6b6b7b' }}>Presidential salary he "donated"</span>
                <span style={{ fontSize: '14px', color: '#4a4a5a', fontWeight: '600' }}>$400K/year</span>
              </div>
              <div style={{ padding: '14px 16px', background: '#0a0a0f', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#6b6b7b' }}>What he gained instead</span>
                <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: '600' }}>${wealthGain.toFixed(1)}B</span>
              </div>
              <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.1)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '500' }}>That's equivalent to...</span>
                <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: '700' }}>{Math.round((wealthGain * 1e9) / 400000).toLocaleString()} years of salary</span>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#6b6b7b', textAlign: 'center' }}>
              Most of this came from crypto ventures launched <em>while in office</em>
            </div>
            <div style={{ marginTop: '12px' }}>
              <ActionLink onClick={() => handleTabClick('money')} color="#22c55e">See Full Breakdown →</ActionLink>
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

          {/* Polls Summary */}
          <Card glow="#3b82f6" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500' }}>Approval Rating</span>
              <span style={{ fontSize: '9px', color: '#3b82f6', background: 'rgba(59,130,246,0.15)', padding: '4px 10px', borderRadius: '4px', fontWeight: '600' }}>JAN 2026</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>39%</div>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Approve</div>
              </div>
              <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(107,107,123,0.1)', borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#6b6b7b' }}>56%</div>
                <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Disapprove</div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
              <strong style={{ color: '#ef4444' }}>58%</strong> say ICE has gone "too far" • <strong style={{ color: '#ef4444' }}>54%</strong> say country worse off
            </div>
            <div style={{ marginTop: '12px' }}>
              <ActionLink onClick={() => handleTabClick('polls')} color="#3b82f6">All Poll Data →</ActionLink>
            </div>
          </Card>

          {/* Golf Summary */}
          <Card glow="#eab308">
            <div style={{ fontSize: '13px', color: '#6b6b7b', fontWeight: '500', marginBottom: '12px' }}>Taxpayer-Funded Golf (2025)</div>
            <div style={{ fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: '700', color: '#eab308', marginBottom: '8px' }}>$110.6M</div>
            <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '16px' }}>88 golf club visits • 25% of days in office</div>
            <div style={{ padding: '14px 16px', background: 'rgba(234,179,8,0.08)', borderRadius: '10px', border: '1px solid rgba(234,179,8,0.15)', fontSize: '13px', color: '#a8a8b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#eab308' }}>Why it matters:</strong> Each Mar-a-Lago trip costs ~$3.4M. Secret Service pays Trump's resorts directly.
            </div>
            <a href="https://www.citizensforethics.org/reports-investigations/crew-reports/trumps-term-2-corruption-by-the-numbers-more-golf-trips-more-foreign-visitors-and-more-profits/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', fontSize: '10px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: CREW, GAO →</a>
            <div style={{ marginTop: '12px' }}>
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
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: <a href="https://apnews.com/article/trump-deportations-court-order" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>AP News</a> • <a href="https://www.aclu.org/news/immigrants-rights" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>ACLU</a></div>
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
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: <a href="https://www.aclu.org/news/immigrants-rights" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>ACLU</a> • <a href="https://www.npr.org/sections/immigration" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>NPR</a></div>
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
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: <a href="https://cpj.org/americas/usa/" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>Committee to Protect Journalists</a> • <a href="https://pen.org/press-freedom/" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>PEN America</a></div>
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
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: <a href="https://www.citizensforethics.org/reports-investigations/crew-investigations/" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>CREW</a> • <a href="https://oversightdemocrats.house.gov/" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>House Oversight</a></div>
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
            <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '12px' }}>Sources: <a href="https://apnews.com/article/trump-jan-6-pardons" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>AP News</a> • <a href="https://www.npr.org/2025/01/20/trump-jan-6-pardons" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>NPR</a></div>
          </Card>

        </>}

        {/* LAWSUITS */}
        {activeTab === 'lawsuits' && <>
          <PageHeader title="Legal Challenges" subtitle="Unprecedented legal battles involving the administration" />
          
          {/* BREAKING NEWS - Trump suing own agencies */}
          <Card style={{ marginBottom: '24px', border: '1px solid rgba(239,68,68,0.4)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, #13131a 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '9px', fontWeight: '700', padding: '4px 8px', borderRadius: '4px', background: '#ef4444', color: '#fff', animation: 'pulse 2s infinite' }}>BREAKING</span>
              <span style={{ fontSize: '12px', color: '#fca5a5', fontWeight: '600' }}>Trump Suing His Own Government</span>
            </div>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 12px 0', fontWeight: '700' }}>$10 Billion Lawsuit Against IRS & Treasury</h3>
            <p style={{ fontSize: '13px', color: '#d4d4dc', lineHeight: 1.6, margin: '0 0 12px 0' }}>
              President Trump filed suit against the IRS and Treasury Department—agencies he oversees—seeking $10B in damages over a 2020 tax return leak. This unprecedented move could put taxpayers on the hook for a massive payout to the sitting president.
            </p>
            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '4px', fontWeight: '600' }}>WHY IT MATTERS</div>
              <p style={{ fontSize: '12px', color: '#a8a8b8', margin: 0, lineHeight: 1.5 }}>
                A sitting president suing agencies he controls raises unprecedented conflict-of-interest questions. The leaker (Charles Littlejohn) is already serving 5 years in prison.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href="https://www.npr.org/2026/01/30/nx-s1-5693662/trump-sues-irs-and-treasury-for-10-billion-over-leaked-tax-information" target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#6b6b7b', textDecoration: 'underline' }}>NPR</a>
              <span style={{ color: '#3a3a4a' }}>•</span>
              <a href="https://www.cbsnews.com/news/trump-sues-irs-treasury-10-billion-letting-tax-returns-leak/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#6b6b7b', textDecoration: 'underline' }}>CBS News</a>
              <span style={{ color: '#3a3a4a' }}>•</span>
              <a href="https://www.cnbc.com/2026/01/29/trump-sues-irs-and-treasury-for-10-billion-over-leak-of-tax-records.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#6b6b7b', textDecoration: 'underline' }}>CNBC</a>
              <span style={{ color: '#4a4a5a', fontSize: '10px', marginLeft: 'auto' }}>Filed Jan 29, 2026</span>
            </div>
          </Card>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(168,85,247,0.08)', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#a855f7' }}>358+</div>
              <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Lawsuits Against Admin (2025)</div>
            </div>
            <div style={{ textAlign: '24px', padding: '16px', background: 'rgba(59,130,246,0.08)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>24</div>
              <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Supreme Court Emergency Cases</div>
            </div>
          </div>

          <Card style={{ marginBottom: '24px', borderLeft: '3px solid #ef4444' }}>
            <div style={{ fontSize: '13px', color: '#d4d4dc', lineHeight: 1.7 }}>
              <strong style={{ color: '#ef4444' }}>Historic:</strong> More lawsuits were filed against the Trump administration in 2025 than any first year of any presidency in history. According to SCOTUSblog, "Never before has the court been asked to rule on the legality of so many presidential actions in such a short period of time."
            </div>
            <a href="https://www.scotusblog.com/2026/01/looking-back-at-2025-the-supreme-court-and-the-trump-administration/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '10px', fontSize: '10px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: SCOTUSblog →</a>
          </Card>

          <Card style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#a855f7', fontWeight: '600', marginBottom: '8px' }}>Major Areas of Litigation</div>
            <div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '16px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22c55e' }}></span> Blocked</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}></span> Mixed/Partial</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }}></span> Pending</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }}></span> Ongoing</span>
            </div>
            
            {[
              { area: 'Birthright Citizenship', status: 'Blocked', desc: 'Multiple courts blocked EO to end birthright citizenship. Supreme Court hearing expected Feb-Apr 2026.', color: '#22c55e', url: 'https://www.scotusblog.com/case-files/cases/trump-v-casa-inc/' },
              { area: 'Federal Workforce Cuts', status: 'Mixed', desc: 'Probationary employee firings ruled illegal. DOGE cuts face multiple challenges.', color: '#f59e0b', url: 'https://www.afge.org/article/summary-of-afge-lawsuits-against-trump--how-litigation-works-2/' },
              { area: 'Tariffs (IEEPA)', status: 'Pending', desc: 'Major case on Trump\'s use of emergency powers for tariffs. Supreme Court arguments underway.', color: '#3b82f6', url: 'https://www.scotusblog.com/case-files/cases/learning-resources-inc-v-trump/' },
              { area: 'Immigration Enforcement', status: 'Ongoing', desc: '100+ lawsuits on F-1 visa revocations alone. Minneapolis suing over Operation Metro Surge.', color: '#ef4444', url: 'https://www.aclu.org/news/immigrants-rights' },
              { area: 'Transgender Military Ban', status: 'Blocked', desc: 'Preliminary injunction granted. Administration appealed to Supreme Court.', color: '#22c55e', url: 'https://www.lambdalegal.org/in-court/cases/doe-v-trump' },
              { area: 'DEI Programs', status: 'Mixed', desc: 'Federal funding freezes temporarily blocked. Multiple state AG lawsuits pending.', color: '#f59e0b', url: 'https://www.justsecurity.org/107087/tracker-litigation-legal-challenges-trump-administration/' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '10px', borderLeft: `3px solid ${item.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>{item.area}</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', background: `${item.color}20`, color: item.color }}>{item.status}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#a8a8b8', margin: '0 0 8px 0', lineHeight: 1.5 }}>{item.desc}</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#6b6b7b', textDecoration: 'underline' }}>View case details →</a>
              </div>
            ))}
          </Card>

          {/* Trump's Own Lawsuits */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #eab308' }}>
            <div style={{ fontSize: '14px', color: '#eab308', fontWeight: '600', marginBottom: '16px' }}>Lawsuits Filed BY Trump (2025-2026)</div>
            <p style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '16px' }}>The president has also filed numerous personal lawsuits while in office:</p>
            
            {[
              { target: 'IRS & Treasury', amount: '$10B', date: 'Jan 29, 2026', desc: 'Over tax return leaks to media', url: 'https://www.npr.org/2026/01/30/nx-s1-5693662/trump-sues-irs-and-treasury-for-10-billion-over-leaked-tax-information' },
              { target: 'BBC', amount: '$5B', date: 'Jan 2026', desc: 'Over documentary editing of Jan 6 remarks', url: 'https://www.foxnews.com/media/trump-files-powerhouse-10-billion-lawsuit-bbc-documentary-editing-jan-6-remarks' },
              { target: 'JPMorgan Chase', amount: '$5B', date: 'Jan 2026', desc: 'For closing his accounts in 2021', url: 'https://www.cbsnews.com/news/trump-sues-irs-treasury-10-billion-letting-tax-returns-leak/' },
              { target: 'New York Times', amount: 'Unspecified', date: '2025', desc: 'Defamation over business articles (dismissed, refiled)', url: 'https://www.nytimes.com/2025/trump-lawsuit' },
            ].map((suit, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{suit.target}</div>
                  <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '2px' }}>{suit.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', color: '#eab308', fontWeight: '600' }}>{suit.amount}</div>
                  <a href={suit.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '9px', color: '#6b6b7b', textDecoration: 'underline' }}>{suit.date}</a>
                </div>
              </div>
            ))}
            
            <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,0.08)', borderRadius: '8px', marginTop: '12px', fontSize: '12px', color: '#a8a8b8' }}>
              <strong style={{ color: '#eab308' }}>Total sought:</strong> $20B+ in personal lawsuits while serving as president
            </div>
          </Card>

          <Card style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600', marginBottom: '16px' }}>Supreme Court Record (2025)</div>
            <div style={{ padding: '14px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: '#d4d4dc', margin: 0, lineHeight: 1.6 }}>
                The Supreme Court overwhelmingly sided with the Trump administration in 2025, ruling in favor in <strong>23 of 24</strong> emergency docket cases. Only Justice Jackson voted against the administration in every case.
              </p>
            </div>
            <div style={{ fontSize: '12px', color: '#6b6b7b', lineHeight: 1.7 }}>
              The lone exception: <em>Margolin v. National Association of Immigration Judges</em> — the only case where Justices Thomas and Alito voted against the administration.
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600', marginBottom: '16px' }}>Comprehensive Trackers</div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <a href="https://www.justsecurity.org/107087/tracker-litigation-legal-challenges-trump-administration/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 14px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', textDecoration: 'none' }}>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}>Just Security Litigation Tracker</div>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '2px' }}>Comprehensive database of all legal challenges</div>
              </a>
              <a href="https://www.lawfaremedia.org/projects-series/trials-of-the-trump-administration/tracking-trump-administration-litigation" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 14px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', textDecoration: 'none' }}>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}>Lawfare Trump Administration Tracker</div>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '2px' }}>Detailed case analysis and updates</div>
              </a>
              <a href="https://ballotpedia.org/Multistate_lawsuits_against_the_federal_government_during_the_Trump_administration,_2025-2026" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 14px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', textDecoration: 'none' }}>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}>Ballotpedia Multistate Lawsuits</div>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '2px' }}>State-level legal challenges</div>
              </a>
            </div>
          </Card>
        </>}

        {/* MONEY */}
        {activeTab === 'money' && <>
          <PageHeader title="Follow the Money" subtitle="How Trump is profiting from the presidency" />
          
          {/* The Big Picture - Total Enrichment */}
          <Card glow="#22c55e" style={{ marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '1.5px', color: '#6b6b7b', marginBottom: '8px' }}>ESTIMATED WEALTH GAINED SINCE TAKING OFFICE</div>
              <div style={{ fontSize: 'clamp(42px, 8vw, 56px)', fontWeight: '800', color: '#22c55e', lineHeight: 1 }}>$4.3B+</div>
              <div style={{ fontSize: '13px', color: '#6b6b7b', marginTop: '8px' }}>Net worth: $2.3B → $6.6B (Forbes)</div>
            </div>
            
            {/* Wealth breakdown bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '8px' }}>WHERE IT COMES FROM</div>
              <div style={{ display: 'flex', height: '32px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ flex: '7', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#fff', fontWeight: '600' }}>CRYPTO 73%</span>
                </div>
                <div style={{ flex: '2', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#fff', fontWeight: '600' }}>TRUTH</span>
                </div>
                <div style={{ flex: '1', background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', color: '#000', fontWeight: '600' }}>RE</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#8b5cf6', borderRadius: '2px', marginRight: '4px' }}></span>Crypto (~$11.6B potential)</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px', marginRight: '4px' }}></span>Truth Social (~$2B)</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#eab308', borderRadius: '2px', marginRight: '4px' }}></span>Real Estate</span>
              </div>
            </div>
            
            <a href="https://www.nytimes.com/interactive/2025/07/02/business/donald-trump-wealth-net-worth.html" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: NYT, Forbes, Accountable.US →</a>
          </Card>

          {/* Crypto Empire */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>🪙</span>
              <span style={{ fontSize: '14px', color: '#a78bfa', fontWeight: '600' }}>The Crypto Empire</span>
            </div>
            
            <div style={{ padding: '16px', background: 'rgba(139,92,246,0.08)', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#a78bfa', marginBottom: '4px' }}>HOUSE JUDICIARY COMMITTEE FINDING (NOV 2025)</div>
              <p style={{ fontSize: '14px', color: '#e8e8ed', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                "Donald Trump has turned the Oval Office into the world's most corrupt crypto startup operation, minting staggering personal fortunes for him and his family."
              </p>
              <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '8px' }}>— Rep. Jamie Raskin, Ranking Member</div>
            </div>

            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: '$TRUMP Memecoin', value: '~$4.4B', note: 'Token holdings (80% owned by Trump entities)', color: '#8b5cf6' },
                { label: 'World Liberty Financial', value: '$550M+', note: 'Token sale revenue (75% to Trump)', color: '#a78bfa' },
                { label: 'Crypto income (H1 2025)', value: '$800M+', note: 'Cash realized from sales', color: '#c4b5fd' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '2px' }}>{item.note}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', fontSize: '12px', color: '#fca5a5', lineHeight: 1.6 }}>
              <strong>The catch:</strong> Buyers of $TRUMP memecoin are down 92% from peak. Melania's token crashed 99%. The Trumps profit; retail investors lose.
            </div>
            
            <a href="https://democrats-judiciary.house.gov/media-center/press-releases/new-report-exposes-the-trump-family-s-multi-billion-dollar-crypto-empire-fueled-by-self-dealing-and-corrupt-foreign-interests" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: House Judiciary Committee Democrats Report →</a>
          </Card>

          {/* Taxpayer-Funded Golf */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>⛳</span>
              <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>Taxpayer-Funded Golf (2025)</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>$110.6M</div>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Estimated cost to taxpayers</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#f87171' }}>88</div>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginTop: '4px' }}>Golf club visits (25% of days)</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {[
                { label: 'Cost per Mar-a-Lago trip', value: '~$3.4M', note: 'Air Force One, Secret Service, Coast Guard' },
                { label: 'Cost per Bedminster trip', value: '~$1.1M', note: 'Smaller aircraft' },
                { label: 'Scotland trip (July 2025)', value: '~$10M', note: '5-day trip, new course ribbon-cutting' },
                { label: 'First term total (2017-2021)', value: '$151.5M', note: 'On pace to exceed $300M this term' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#a8a8b8' }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: '#4a4a5a' }}>{item.note}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>{item.value}</div>
                </div>
              ))}
            </div>
            
            <a href="https://www.gao.gov/products/gao-19-178" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: GAO Report, CREW, HuffPost →</a>
          </Card>

          {/* Secret Service Payments TO Trump */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #eab308' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '18px' }}>🏨</span>
              <span style={{ fontSize: '14px', color: '#eab308', fontWeight: '600' }}>Secret Service Pays Trump's Businesses</span>
            </div>
            
            <p style={{ fontSize: '13px', color: '#a8a8b8', marginBottom: '16px', lineHeight: 1.6 }}>
              When agents protect Trump at his properties, they pay for rooms and meals at resorts he owns. This money goes directly into his pocket.
            </p>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
              {[
                { label: 'Second term (first months)', value: '$100K+', note: '"Just the tip of the iceberg" — CREW' },
                { label: 'First term total', value: '~$2M', note: 'FOIA records' },
                { label: 'Nightly rate charged', value: 'Up to $800+', note: 'Above government rate' },
                { label: 'Bedminster cottage', value: '$17K/month', note: 'For Secret Service use' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#a8a8b8' }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: '#4a4a5a' }}>{item.note}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#eab308' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,0.08)', borderRadius: '8px', fontSize: '12px', color: '#fcd34d', lineHeight: 1.6 }}>
              <strong>Eric Trump claimed</strong> in 2019 the family charged Secret Service "like $50." Records show this was false.
            </div>
            
            <a href="https://www.citizensforethics.org/reports-investigations/crew-investigations/secret-service-has-spent-nearly-100k-at-trump-properties/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: CREW FOIA Records →</a>
          </Card>

          {/* Other Revenue Streams */}
          <Card style={{ marginBottom: '16px', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600', marginBottom: '16px' }}>Other Revenue Streams (2025)</div>
            
            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              {[
                { label: 'Trump Bibles', value: '$3M', note: 'Lee Greenwood partnership' },
                { label: 'Trump Watches', value: '$2.8M', note: 'Licensing fees' },
                { label: 'Trump Sneakers & Fragrances', value: '$2.5M', note: 'Licensing fees' },
                { label: '"45" Guitar', value: '$1M', note: 'Licensing fees' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '12px 14px', background: '#0a0a0f', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#a8a8b8' }}>{item.label}</div>
                    <div style={{ fontSize: '10px', color: '#4a4a5a' }}>{item.note}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>{item.value}</div>
                </div>
              ))}
            </div>
            
            <a href="https://time.com/7342470/trump-net-worth-wealth-crypto/" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: TIME, Trump Financial Disclosure →</a>
          </Card>

          {/* The Contrast */}
          <Card style={{ background: 'linear-gradient(135deg, #13131a 0%, #0f0f14 100%)' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#4a4a5a', marginBottom: '16px', fontWeight: '600', textAlign: 'center' }}>THE CONTRAST</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
              <div style={{ padding: '20px', background: 'rgba(239,68,68,0.06)', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '8px' }}>NATIONAL DEBT ADDED</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>+{fmt(debtSinceInauguration)}</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>Your share: ~${Math.round((data.debt?.perHousehold || 285127) * (debtSinceInauguration / (36.18 * 1e12))).toLocaleString()}</div>
              </div>
              <div style={{ padding: '20px', background: 'rgba(34,197,94,0.06)', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '8px' }}>TRUMP'S GAIN</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>+$4.3B</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>+187% since Jan 2024</div>
              </div>
            </div>
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
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>{iceStats.totalShootings || 30}+</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Total Shootings</div>
                  <div style={{ fontSize: '9px', color: '#4a4a5a', marginTop: '2px' }}>Since Jan 2025</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{iceStats.shootingDeaths || 8}</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Killed</div>
                  <div style={{ fontSize: '9px', color: '#4a4a5a', marginTop: '2px' }}>By gunfire</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(220,38,38,0.1)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: '#f87171' }}>2</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>US Citizens</div>
                  <div style={{ fontSize: '9px', color: '#4a4a5a', marginTop: '2px' }}>Killed</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', padding: '10px 12px', background: '#0a0a0f', borderRadius: '6px', fontSize: '11px', color: '#888' }}>
                <strong style={{ color: '#fca5a5' }}>Note:</strong> 5 US citizens have been shot total (2 killed: Renee Good, Alex Pretti). <a href="https://en.wikipedia.org/wiki/List_of_shootings_by_U.S._immigration_agents_in_the_second_Trump_administration" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>Wikipedia</a>
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
              Data compiled from: <a href="https://en.wikipedia.org/wiki/List_of_killings_by_law_enforcement_officers_in_the_United_States" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>Wikipedia</a> • <a href="https://www.npr.org/sections/immigration" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>NPR</a> • <a href="https://www.aclu.org/news/immigrants-rights" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>ACLU</a> • <a href="https://www.vera.org/topics/immigration" target="_blank" rel="noopener noreferrer" style={{ color: '#6b6b7b', textDecoration: 'underline' }}>Vera Institute</a>
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

        {/* POLLS */}
        {activeTab === 'polls' && <>
          <PageHeader title="Approval Ratings" subtitle="Public opinion tracking from major pollsters" />
          
          {/* Current Approval */}
          <Card glow="#ef4444" style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#4a4a5a', marginBottom: '16px', fontWeight: '600', textAlign: 'center' }}>CURRENT APPROVAL (JAN 2026)</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: '48px', fontWeight: '800', color: '#ef4444', lineHeight: 1 }}>39%</div>
                <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '8px' }}>Overall Approval</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>CNN/SSRS Jan 2026</div>
              </div>
              <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(34,197,94,0.08)', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ fontSize: '48px', fontWeight: '800', color: '#6b6b7b', lineHeight: 1 }}>56%</div>
                <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '8px' }}>Disapproval</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>Civiqs Jan 28, 2026</div>
              </div>
            </div>

            <div style={{ padding: '14px 16px', background: '#0a0a0f', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>NET APPROVAL TREND</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>-12.9</div>
                <div style={{ fontSize: '12px', color: '#6b6b7b' }}>
                  Silver Bulletin average<br/>
                  <span style={{ color: '#ef4444' }}>↓ Down from -12.0 last week</span>
                </div>
              </div>
            </div>
            
            <a href="https://www.natesilver.net/p/trump-approval-ratings-nate-silver-bulletin" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: Silver Bulletin →</a>
          </Card>

          {/* Poll Comparison */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600', marginBottom: '16px' }}>Recent Poll Results (Jan 2026)</div>
            
            {[
              { pollster: 'Fox News', approve: 44, disapprove: 56, date: 'Jan 23-26', color: '#ef4444' },
              { pollster: 'Emerson', approve: 41, disapprove: 50, date: 'Jan 2026', color: '#f97316' },
              { pollster: 'CNN/SSRS', approve: 39, disapprove: 61, date: 'Jan 2026', color: '#eab308' },
              { pollster: 'Marist', approve: 38, disapprove: 56, date: 'Jan 12-13', color: '#22c55e' },
              { pollster: 'Reuters/Ipsos', approve: 38, disapprove: 58, date: 'Jan 2026', color: '#3b82f6' },
              { pollster: 'Civiqs', approve: 39, disapprove: 56, date: 'Jan 28', color: '#a855f7' },
            ].map((poll, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#a8a8b8', fontWeight: '500' }}>{poll.pollster}</span>
                  <span style={{ fontSize: '10px', color: '#4a4a5a' }}>{poll.date}</span>
                </div>
                <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', background: '#0a0a0f' }}>
                  <div style={{ width: `${poll.approve}%`, background: poll.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#fff' }}>{poll.approve}%</span>
                  </div>
                  <div style={{ width: `${poll.disapprove}%`, background: '#3a3a4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#888' }}>{poll.disapprove}%</span>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* Key Findings */}
          <Card style={{ marginBottom: '24px', borderLeft: '3px solid #f97316' }}>
            <div style={{ fontSize: '14px', color: '#f97316', fontWeight: '600', marginBottom: '16px' }}>Key Findings</div>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444', marginBottom: '4px' }}>54%</div>
                <div style={{ fontSize: '12px', color: '#a8a8b8' }}>Say country is <strong>worse off</strong> than a year ago</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>Fox News, Jan 2026</div>
              </div>
              
              <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', marginBottom: '4px' }}>58%</div>
                <div style={{ fontSize: '12px', color: '#a8a8b8' }}>Say Trump has <strong>gone too far</strong> in using presidential power</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>CNN, Jan 2026</div>
              </div>
              
              <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#eab308', marginBottom: '4px' }}>58%</div>
                <div style={{ fontSize: '12px', color: '#a8a8b8' }}>Say ICE has <strong>gone too far</strong> in deportation crackdown</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>Reuters/Ipsos, Jan 2026</div>
              </div>
              
              <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e', marginBottom: '4px' }}>37%</div>
                <div style={{ fontSize: '12px', color: '#a8a8b8' }}>Say Trump puts <strong>country above personal gain</strong></div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>CNN, Jan 2026</div>
              </div>
              
              <div style={{ padding: '14px', background: '#0a0a0f', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>29%</div>
                <div style={{ fontSize: '12px', color: '#a8a8b8' }}>Independent approval (down from 48% at start of term)</div>
                <div style={{ fontSize: '10px', color: '#4a4a5a', marginTop: '4px' }}>CNN, Jan 2026</div>
              </div>
            </div>
          </Card>

          {/* Immigration Approval */}
          <Card style={{ marginBottom: '24px', borderLeft: '3px solid #dc2626' }}>
            <div style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600', marginBottom: '12px' }}>Immigration Approval (Record Low)</div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#dc2626', marginBottom: '8px' }}>39%</div>
            <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '16px' }}>Down from 50% in Feb 2025 — record low for second term</div>
            
            <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.08)', borderRadius: '8px', fontSize: '12px', color: '#fca5a5', lineHeight: 1.6 }}>
              Poll conducted Jan 24-26, largely <strong>after</strong> Alex Pretti shooting. Immigration was Trump's strongest issue in the 2024 election.
            </div>
            <a href="https://www.aljazeera.com/news/2026/1/27/trumps-approval-on-immigration-falls-to-record-low-new-poll-finds" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '12px', fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: Reuters/Ipsos via Al Jazeera →</a>
          </Card>

          {/* Historical Context */}
          <Card>
            <div style={{ fontSize: '14px', color: '#a855f7', fontWeight: '600', marginBottom: '16px' }}>Historical Context</div>
            <div style={{ fontSize: '13px', color: '#a8a8b8', lineHeight: 1.7 }}>
              <p style={{ margin: '0 0 12px 0' }}>Trump's current approval (~39-44%) is comparable to his first term at this point (-16.4 net approval), but notably lower than other second-term presidents one year in:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: '#0a0a0f', borderRadius: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>-12.9</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Trump (2026)</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: '#0a0a0f', borderRadius: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6' }}>-8.5</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Obama (2014)</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: '#0a0a0f', borderRadius: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#22c55e' }}>-10.4</div>
                  <div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>Bush (2006)</div>
                </div>
              </div>
            </div>
            <a href="https://www.nbcnews.com/politics/trump-administration/trumps-approval-rating-takes-hit-first-year-back-office-rcna253192" target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '16px', fontSize: '11px', color: '#4a4a5a', textDecoration: 'underline' }}>Source: NBC News →</a>
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

// Wrap App with ErrorBoundary for production safety
function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
