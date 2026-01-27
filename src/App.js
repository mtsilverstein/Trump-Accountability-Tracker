import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { INITIAL_DATA } from './initialData';

function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('overview');
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
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
  const totalGolfCost = ((golf.marALagoTrips || 0) * (golf.marALagoCost || 0)) + ((golf.bedminsterTrips || 0) * (golf.bedminsterCost || 0)) + ((golf.scotlandTrips || 0) * (golf.scotlandCost || 0));
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

  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>Loading...</div>;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'promises', label: 'Broken Promises', icon: '❌' },
    { id: 'money', label: 'Follow the Money', icon: '💰' },
    { id: 'ice', label: 'ICE Deaths', icon: '⚠️' },
    { id: 'sources', label: 'Sources', icon: '📑' },
  ];

  const Card = ({ children, style }) => <div style={{ background: '#16161e', borderRadius: '12px', padding: '24px', border: '1px solid #252530', ...style }}>{children}</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f14', fontFamily: 'Inter, -apple-system, sans-serif', color: '#e8e8ed', lineHeight: 1.6 }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #1e1e28', padding: '24px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '11px', letterSpacing: '2px', color: '#ef4444', fontWeight: '600' }}>LIVE ACCOUNTABILITY TRACKER</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: '700', color: '#fff', margin: '0 0 4px 0' }}>Trump Administration</h1>
          <p style={{ fontSize: '14px', color: '#6b6b7b', margin: 0 }}>Facts with sources. Updated automatically.</p>
          <div style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '16px', padding: '12px 20px', background: '#16161e', borderRadius: '8px', border: '1px solid #1e1e28' }}>
            <span style={{ fontSize: '12px', color: '#6b6b7b' }}>Term to Date:</span>
            <span style={{ fontSize: '20px', fontWeight: '600', fontFamily: 'JetBrains Mono, monospace', color: '#fff' }}>
              {timeSinceInauguration.days}d {pad(timeSinceInauguration.hours)}h {pad(timeSinceInauguration.minutes)}m {pad(timeSinceInauguration.seconds)}s
            </span>
          </div>
          {lastSync && <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '12px' }}>Last sync: {new Date(lastSync).toLocaleString()}</div>}
        </div>
      </header>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #1e1e28', background: '#0f0f14', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '4px', padding: '8px 20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={(e) => { e.preventDefault(); setActiveTab(t.id); window.scrollTo(0, 0); }} style={{
              padding: '10px 16px', background: activeTab === t.id ? '#1e1e28' : 'transparent', border: 'none', borderRadius: '6px',
              color: activeTab === t.id ? '#fff' : '#6b6b7b', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === t.id ? '600' : '400', fontFamily: 'inherit', whiteSpace: 'nowrap',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation'
            }}><span style={{ marginRight: '6px' }}>{t.icon}</span>{t.label}</button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
        
        {/* OVERVIEW */}
        {activeTab === 'overview' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {/* Debt */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#6b6b7b' }}>U.S. National Debt</span>
                <span style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' }}>● LIVE</span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>${(liveDebt / 1e12).toFixed(6)}T</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '8px' }}>+{fmt(data.debt?.perSecond || 92912.33, 0)}/second</div>
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6b6b7b' }}>Added Term to Date</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444', marginTop: '4px' }}>+{fmt(debtSinceInauguration)}</div>
              </div>
            </Card>
            {/* Wealth */}
            <Card>
              <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '16px' }}>Trump Personal Net Worth</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#22c55e' }}>${wealth.current || 6.6}B</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '8px' }}>Forbes • Rank #{wealth.rank || 581}</div>
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(34,197,94,0.08)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6b6b7b' }}>Gained Since Jan 2024</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e', marginTop: '4px' }}>+${wealthGain.toFixed(1)}B (+{wealthGainPercent}%)</div>
              </div>
            </Card>
            {/* Promises */}
            <Card>
              <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '16px' }}>Campaign Promises</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#f97316' }}>{brokenPromises.filter(p => p.status === 'BROKEN').length}/{brokenPromises.length}</div>
              <div style={{ fontSize: '14px', color: '#f97316', marginTop: '8px' }}>Broken</div>
              <button onClick={() => setActiveTab('promises')} style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '6px', color: '#f97316', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>View All →</button>
            </Card>
          </div>

          {/* Contrast */}
          <Card style={{ marginBottom: '32px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '12px', letterSpacing: '2px', color: '#6b6b7b', margin: '0 0 24px 0' }}>THE CONTRAST</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '32px' }}>
              <div><div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '8px' }}>Trump's Gain</div><div style={{ fontSize: '36px', fontWeight: '700', color: '#22c55e' }}>+${wealthGain.toFixed(1)}B</div></div>
              <div style={{ fontSize: '24px', color: '#3a3a4a' }}>vs</div>
              <div><div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '8px' }}>Added to Your Debt</div><div style={{ fontSize: '36px', fontWeight: '700', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>+{fmt(debtSinceInauguration)}</div></div>
            </div>
            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>
              For every <span style={{ color: '#22c55e', fontWeight: '600' }}>$1</span> Trump gained, debt increased by <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '18px' }}>${Math.round(debtSinceInauguration / (wealthGain * 1e9)).toLocaleString()}</span>
            </div>
          </Card>

          {/* ICE */}
          <Card style={{ marginBottom: '32px', borderColor: '#dc2626' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', boxShadow: '0 0 12px rgba(220,38,38,0.5)' }} />
              <h2 style={{ fontSize: '14px', color: '#fca5a5', margin: 0 }}>U.S. Citizens Killed by Federal Immigration Agents</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {iceVictims.map(v => (
                <div key={v.id} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>{v.name}</div>
                  <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>Age {v.age} • {v.citizenship} • {v.agency}</div>
                  <div style={{ fontSize: '12px', color: '#6b6b7b' }}>{v.date} • {v.location}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setActiveTab('ice')} style={{ marginTop: '16px', padding: '10px 16px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Full Details →</button>
          </Card>

          {/* Golf */}
          <Card>
            <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '16px' }}>Taxpayer-Funded Golf (Term to Date)</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#eab308' }}>${totalGolfCost.toFixed(1)}M</div>
            <div style={{ fontSize: '13px', color: '#6b6b7b', marginTop: '8px' }}>{totalTrips} trips • {golf.propertyVisits2025 || 0} property visits</div>
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(234,179,8,0.08)', borderRadius: '8px', fontSize: '13px', color: '#a8a8b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#eab308' }}>Why it matters:</strong> Taxpayers pay for Secret Service at resorts Trump profits from. Est. <strong style={{ color: '#eab308' }}>{fmt(selfDealingFromGolf)}</strong> to his pocket.
            </div>
            <button onClick={() => setActiveTab('money')} style={{ marginTop: '16px', padding: '10px 16px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '6px', color: '#eab308', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Full Breakdown →</button>
          </Card>
        </>}

        {/* PROMISES */}
        {activeTab === 'promises' && <>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', margin: '0 0 8px 0' }}>Campaign Promises vs Reality</h2>
          <p style={{ fontSize: '14px', color: '#6b6b7b', margin: '0 0 24px 0' }}>Exact quotes. Verifiable outcomes.</p>
          {brokenPromises.map(p => (
            <Card key={p.id} style={{ marginBottom: '16px', borderLeft: `3px solid ${p.statusColor || '#ef4444'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div><div style={{ fontSize: '11px', color: '#6b6b7b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{p.category}</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>{p.promise}</h3>
                  <div style={{ fontSize: '12px', color: '#6b6b7b', marginTop: '4px' }}>{p.datePromised}</div></div>
                <div style={{ padding: '6px 12px', background: `${p.statusColor || '#ef4444'}20`, borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: p.statusColor || '#ef4444', height: 'fit-content' }}>{p.status}</div>
              </div>
              <div style={{ padding: '16px', background: '#0f0f14', borderRadius: '8px', borderLeft: `2px solid ${p.statusColor || '#ef4444'}`, marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#a8a8b8', fontStyle: 'italic' }}>"{p.quote}"</div>
              </div>
              {p.deadline && <div style={{ fontSize: '12px', color: '#6b6b7b', marginBottom: '12px' }}><strong>Deadline:</strong> {p.deadline}</div>}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#6b6b7b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Reality</div>
                {(p.reality || []).map((f, i) => <div key={i} style={{ fontSize: '13px', color: '#d4d4dc', padding: '8px 0 8px 16px', borderLeft: '2px solid #3a3a4a', marginBottom: '4px' }}>{f}</div>)}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b6b7b', marginBottom: '6px' }}><span>Fulfilled</span><span>{p.progress || 0}%</span></div>
                <div style={{ height: '4px', background: '#252530', borderRadius: '2px' }}><div style={{ height: '100%', width: `${p.progress || 0}%`, background: p.statusColor || '#ef4444', borderRadius: '2px' }} /></div>
              </div>
              <div style={{ fontSize: '11px', color: '#4a4a5a' }}>Sources: {(p.sources || []).join(' • ')}</div>
            </Card>
          ))}
        </>}

        {/* MONEY */}
        {activeTab === 'money' && <>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', margin: '0 0 8px 0' }}>Follow the Money</h2>
          <p style={{ fontSize: '14px', color: '#6b6b7b', margin: '0 0 24px 0' }}>Self-dealing, conflicts of interest, taxpayer money to Trump businesses.</p>
          <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(234,179,8,0.1) 0%, #16161e 100%)', borderColor: 'rgba(234,179,8,0.3)' }}>
            <h3 style={{ fontSize: '14px', color: '#eab308', margin: '0 0 12px 0' }}>The Key Insight Most People Miss</h3>
            <p style={{ fontSize: '15px', color: '#e8e8ed', lineHeight: 1.7, margin: 0 }}>
              When Trump golfs at Mar-a-Lago, taxpayers pay for Secret Service rooms <strong style={{ color: '#eab308' }}>at a resort he owns</strong>. This money goes <strong style={{ color: '#eab308' }}>directly into his bank account</strong>.
            </p>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[{ label: 'Secret Service @ Properties', value: '~$2M', sub: 'First term', color: '#ef4444' },
              { label: 'Foreign Governments', value: fmt(selfDealing.foreignGovFirstTerm || 7800000), sub: `${selfDealing.foreignCountries || 20} countries`, color: '#f97316' },
              { label: 'Overcharge Rate', value: selfDealing.overchargeRate || '300%', sub: 'Above govt rates', color: '#eab308' },
              { label: 'Crypto Fees', value: fmt(selfDealing.cryptoFees || 427000000), sub: '$TRUMP + WLF', color: '#22c55e' }
            ].map((s, i) => <Card key={i} style={{ padding: '16px' }}><div style={{ fontSize: '11px', color: '#6b6b7b', marginBottom: '8px' }}>{s.label}</div><div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div><div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '4px' }}>{s.sub}</div></Card>)}
          </div>
          <Card style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: '#eab308', margin: '0 0 16px 0' }}>Golf Trip Self-Dealing</h3>
            {[{ l: 'Golf trips', v: totalTrips }, { l: 'Property visits (CREW)', v: golf.propertyVisits2025 || 129 }, { l: 'Revenue per trip (GAO)', v: fmt(selfDealing.revenuePerTrip || 60000) }].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#0f0f14', borderRadius: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b6b7b' }}>{r.l}</span><span style={{ fontSize: '13px', color: '#eab308', fontWeight: '600' }}>{r.v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', background: 'rgba(234,179,8,0.1)', borderRadius: '6px', marginTop: '8px' }}>
              <span style={{ fontWeight: '600', color: '#fff' }}>Est. to Trump's pocket</span><span style={{ fontSize: '18px', fontWeight: '700', color: '#eab308' }}>{fmt(selfDealingFromGolf)}</span>
            </div>
          </Card>
          <Card>
            <h3 style={{ fontSize: '14px', color: '#6b6b7b', margin: '0 0 16px 0' }}>"America First" vs Israel Military Aid</h3>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#60a5fa', marginBottom: '8px' }}>$21.7B+</div>
            <div style={{ fontSize: '13px', color: '#6b6b7b', marginBottom: '16px' }}>U.S. military aid to Israel since Oct 2023</div>
            {[{ l: 'Arms sales since Jan 2025', v: '$10.1B+' }, { l: 'Emergency transfer (Mar 2025)', v: '$4B' }, { l: 'Bypassed Congress', v: '2 times' }].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#0f0f14', borderRadius: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6b6b7b' }}>{r.l}</span><span style={{ fontSize: '13px', color: '#60a5fa', fontWeight: '600' }}>{r.v}</span>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '12px' }}>Sources: Brown/Costs of War • State Dept • Quincy Institute</div>
          </Card>
        </>}

        {/* ICE */}
        {activeTab === 'ice' && <>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', margin: '0 0 8px 0' }}>U.S. Citizens Killed by Federal Immigration Agents</h2>
          <p style={{ fontSize: '14px', color: '#6b6b7b', margin: '0 0 24px 0' }}>Documented incidents with official and witness accounts.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[{ v: iceVictims.filter(x => x.citizenship === 'US Citizen').length, l: 'US Citizens Killed', c: '#dc2626' },
              { v: `${iceStats.totalShootings || 27}+`, l: 'Total Shootings', c: '#ef4444' },
              { v: iceStats.shootingDeaths || 8, l: 'Shooting Deaths', c: '#f87171' },
              { v: iceStats.detentionDeaths2025 || 32, l: '2025 Detention Deaths', c: '#fca5a5' }
            ].map((s, i) => <div key={i} style={{ textAlign: 'center', padding: '16px', background: 'rgba(220,38,38,0.08)', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)' }}><div style={{ fontSize: '28px', fontWeight: '700', color: s.c }}>{s.v}</div><div style={{ fontSize: '10px', color: '#6b6b7b', marginTop: '4px' }}>{s.l}</div></div>)}
          </div>
          <div style={{ padding: '16px', background: 'rgba(220,38,38,0.08)', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', color: '#fca5a5' }}>
            <strong>Context:</strong> 2025 had highest ICE detention deaths since 2004. December 2025 was deadliest month on record.
          </div>
          {iceVictims.map(v => (
            <Card key={v.id} style={{ marginBottom: '16px', borderColor: '#dc2626' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: '0 0 4px 0' }}>{v.name}</h3>
              <div style={{ fontSize: '13px', color: '#fca5a5' }}>Age {v.age} • {v.citizenship} • {v.agency}</div>
              <div style={{ fontSize: '12px', color: '#6b6b7b' }}>{v.date} • {v.location}</div>
              <div style={{ padding: '16px', background: '#0f0f14', borderRadius: '8px', margin: '16px 0', fontSize: '14px', color: '#d4d4dc', lineHeight: 1.6 }}>{v.details}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(220,38,38,0.08)', borderRadius: '6px' }}><div style={{ fontSize: '10px', color: '#fca5a5', marginBottom: '6px', fontWeight: '600' }}>OFFICIAL</div><div style={{ fontSize: '12px', color: '#a8a8b8' }}>{v.officialResponse}</div></div>
                <div style={{ padding: '12px', background: 'rgba(34,197,94,0.08)', borderRadius: '6px' }}><div style={{ fontSize: '10px', color: '#86efac', marginBottom: '6px', fontWeight: '600' }}>WITNESS</div><div style={{ fontSize: '12px', color: '#a8a8b8' }}>{v.witnessAccount}</div></div>
              </div>
              <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '12px' }}>Sources: {(v.sources || []).join(' • ')}</div>
            </Card>
          ))}
        </>}

        {/* SOURCES */}
        {activeTab === 'sources' && <>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', margin: '0 0 24px 0' }}>Data Sources & Methodology</h2>
          {[{ c: 'National Debt', s: 'Treasury Debt to the Penny • JEC • CBO' },
            { c: 'Wealth', s: 'Forbes • Bloomberg • NYT' },
            { c: 'Golf/Travel', s: 'GAO 2019 Report • CREW • HuffPost' },
            { c: 'Self-Dealing', s: 'CREW • American Oversight • House Oversight • FT' },
            { c: 'Promises', s: 'PolitiFact • CNN Fact Check • NPR • BLS • EIA' },
            { c: 'ICE/CBP', s: 'Wikipedia • NPR • AP • ACLU • Vera Institute' },
            { c: 'Israel Aid', s: 'Brown Costs of War • State Dept • Quincy • CFR' }
          ].map((x, i) => <Card key={i} style={{ marginBottom: '12px', padding: '16px' }}><h3 style={{ fontSize: '13px', color: '#fff', margin: '0 0 8px 0' }}>{x.c}</h3><div style={{ fontSize: '12px', color: '#6b6b7b' }}>{x.s}</div></Card>)}
          <Card style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '13px', color: '#fff', margin: '0 0 12px 0' }}>Methodology</h3>
            <p style={{ fontSize: '13px', color: '#6b6b7b', margin: 0, lineHeight: 1.7 }}>
              Objective, verifiable facts. All claims require mainstream sources. ICE incidents require multiple sources. Auto-updates via AI monitoring.<br/><br/>
              <strong style={{ color: '#a8a8b8' }}>Found an error?</strong> Open to corrections with sources.
            </p>
          </Card>
        </>}
      </main>

      <footer style={{ borderTop: '1px solid #1e1e28', padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#4a4a5a' }}>Built for transparency • Auto-updates via AI</div>
      </footer>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}*{box-sizing:border-box}::selection{background:rgba(239,68,68,.3)}@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');`}</style>
    </div>
  );
}

export default App;
