import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { INITIAL_DATA } from './initialData';

/**
 * Trump Administration Accountability Tracker
 * 
 * Data is stored in Supabase and auto-updated via Gemini AI
 * Live counters for debt and time run client-side
 */

function App() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('overview');
  
  // Update time 10x per second for smooth counters
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  // Fetch data from Supabase on load
  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('tracker-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'tracker_data' },
        (payload) => {
          console.log('Realtime update received:', payload);
          if (payload.new?.data) {
            setData(payload.new.data);
            setLastSync(new Date().toISOString());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    try {
      const { data: result, error } = await supabase
        .from('tracker_data')
        .select('data, updated_at')
        .eq('id', 'main')
        .single();
      
      if (error) throw error;
      
      if (result?.data && Object.keys(result.data).length > 0) {
        setData(result.data);
        setLastSync(result.updated_at);
      } else {
        // Seed initial data if empty
        await seedInitialData();
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      // Use fallback data
    } finally {
      setLoading(false);
    }
  }

  async function seedInitialData() {
    try {
      const { error } = await supabase
        .from('tracker_data')
        .upsert({ id: 'main', data: INITIAL_DATA, updated_at: new Date().toISOString() });
      
      if (error) throw error;
      console.log('Seeded initial data');
    } catch (err) {
      console.error('Error seeding data:', err);
    }
  }

  // ---- CALCULATIONS ----
  
  const INAUGURATION = new Date('2025-01-20T17:00:00Z');
  
  const liveDebt = useMemo(() => {
    const baselineDate = new Date(data.debt?.baselineDate || '2026-01-07T00:00:00Z');
    const secSinceBaseline = (now - baselineDate.getTime()) / 1000;
    return ((data.debt?.baseline || 38.43) * 1e12) + (secSinceBaseline * (data.debt?.perSecond || 92912.33));
  }, [now, data.debt]);
  
  const debtSinceInauguration = liveDebt - ((data.debt?.atInauguration || 36.18) * 1e12);
  
  const timeSinceInauguration = useMemo(() => {
    const sec = Math.floor((now - INAUGURATION.getTime()) / 1000);
    return {
      days: Math.floor(sec / 86400),
      hours: Math.floor((sec % 86400) / 3600),
      minutes: Math.floor((sec % 3600) / 60),
      seconds: sec % 60,
    };
  }, [now]);
  
  const wealthGain = (data.wealth?.current || 6.6) - (data.wealth?.previous || 2.3);
  const wealthGainPercent = Math.round((wealthGain / (data.wealth?.previous || 2.3)) * 100);
  
  const golf = data.golf || {};
  const totalGolfCost = ((golf.marALagoTrips || 0) * (golf.marALagoCost || 0)) +
                        ((golf.bedminsterTrips || 0) * (golf.bedminsterCost || 0)) +
                        ((golf.scotlandTrips || 0) * (golf.scotlandCost || 0));
  
  const totalTrips = (golf.marALagoTrips || 0) + (golf.bedminsterTrips || 0) + (golf.scotlandTrips || 0);
  const selfDealing = data.selfDealing || {};
  const selfDealingFromGolf = totalTrips * (selfDealing.revenuePerTrip || 60000);

  // ---- HELPERS ----
  
  const fmt = (val, dec = 2) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(dec)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(dec)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(dec)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(dec)}K`;
    return `$${val.toLocaleString()}`;
  };
  
  const pad = (n) => String(n).padStart(2, '0');

  // ---- STYLES ----
  
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      color: '#e0e0e0',
      padding: '20px',
    },
    grid: {
      position: 'fixed',
      inset: 0,
      backgroundImage: 'linear-gradient(rgba(255,50,50,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,50,50,0.03) 1px, transparent 1px)',
      backgroundSize: '50px 50px',
      pointerEvents: 'none',
      zIndex: 0,
    },
    content: {
      position: 'relative',
      zIndex: 1,
      maxWidth: '1400px',
      margin: '0 auto',
    },
    card: (color) => ({
      background: `linear-gradient(145deg, ${color}12 0%, rgba(0,0,0,0.4) 100%)`,
      border: `1px solid ${color}40`,
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '20px',
    }),
    cardStrong: (color) => ({
      background: `linear-gradient(145deg, ${color}18 0%, rgba(0,0,0,0.5) 100%)`,
      border: `2px solid ${color}60`,
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '20px',
      position: 'relative',
    }),
  };
  
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'promises', label: '❌ Broken Promises' },
    { id: 'self-dealing', label: '💰 Self-Dealing' },
    { id: 'ice', label: '⚠️ ICE Deaths' },
    { id: 'sources', label: '📑 Sources' },
  ];

  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading tracker data...</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Connecting to database</div>
        </div>
      </div>
    );
  }

  const iceVictims = data.iceVictims || [];
  const iceStats = data.iceStats || {};
  const brokenPromises = data.brokenPromises || [];
  const wealth = data.wealth || {};

  return (
    <div style={styles.container}>
      <div style={styles.grid} />
      
      <div style={styles.content}>
        {/* ---- HEADER ---- */}
        <header style={{ textAlign: 'center', padding: '30px 20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '4px', color: '#ff3333', marginBottom: '12px' }}>
            ◆ ACCOUNTABILITY DASHBOARD ◆
          </div>
          <h1 style={{
            fontSize: 'clamp(24px, 5vw, 52px)',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 8px 0',
            letterSpacing: '-1px',
          }}>
            TRUMP ADMINISTRATION
          </h1>
          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 20px 0' }}>
            Objective facts • Verifiable sources • Auto-updated
          </p>
          
          {/* Sync status */}
          {lastSync && (
            <div style={{ fontSize: '10px', color: '#444', marginBottom: '12px' }}>
              Last sync: {new Date(lastSync).toLocaleString()}
            </div>
          )}
          
          {/* Time counter */}
          <div style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: '10px', color: '#666', letterSpacing: '2px', marginBottom: '4px' }}>
              TIME SINCE INAUGURATION (JAN 20, 2025)
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', color: '#fff' }}>
              {timeSinceInauguration.days}d {pad(timeSinceInauguration.hours)}h {pad(timeSinceInauguration.minutes)}m {pad(timeSinceInauguration.seconds)}s
            </div>
          </div>
        </header>

        {/* ---- TABS ---- */}
        <nav style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: activeTab === tab.id ? 'rgba(255,50,50,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${activeTab === tab.id ? '#ff3333' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px',
                color: activeTab === tab.id ? '#ff5555' : '#888',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ============ OVERVIEW TAB ============ */}
        {activeTab === 'overview' && (
          <>
            {/* Main stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              
              {/* LIVE DEBT */}
              <div style={styles.cardStrong('#ff3333')}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff3333', animation: 'pulse 1s infinite' }} />
                  <span style={{ fontSize: '10px', color: '#ff3333', letterSpacing: '1px' }}>LIVE</span>
                </div>
                <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#ff6666', marginBottom: '8px' }}>TOTAL U.S. NATIONAL DEBT</div>
                <div style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: '900', color: '#ff3333', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  ${(liveDebt / 1e12).toFixed(6)}T
                </div>
                <div style={{ fontSize: '12px', color: '#ff6666', marginTop: '8px' }}>
                  <span style={{ animation: 'blink 0.5s infinite' }}>+</span> {fmt(data.debt?.perSecond || 92912.33, 0)}/second
                </div>
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>INCREASE SINCE INAUGURATION</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#ff3333' }}>+{fmt(debtSinceInauguration)}</div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: '#666' }}>
                  Per household: ${(data.debt?.perHousehold || 285127).toLocaleString()}
                </div>
              </div>
              
              {/* WEALTH */}
              <div style={styles.card('#00ff66')}>
                <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#00ff66', marginBottom: '8px' }}>TRUMP PERSONAL NET WORTH</div>
                <div style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: '900', color: '#00ff66', lineHeight: 1 }}>
                  ${wealth.current || 6.6}B
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>{wealth.source || 'Forbes'} estimate • Rank #{wealth.rank || 581}</div>
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>GAIN SINCE JAN 2024 (PRE-TERM)</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#00ff66' }}>
                    +${wealthGain.toFixed(1)}B <span style={{ fontSize: '14px', color: '#00cc55' }}>(+{wealthGainPercent}%)</span>
                  </div>
                </div>
              </div>
              
              {/* BROKEN PROMISES */}
              <div style={styles.card('#ff6600')}>
                <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#ff6600', marginBottom: '8px' }}>CAMPAIGN PROMISES</div>
                <div style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: '900', color: '#ff6600', lineHeight: 1 }}>
                  {brokenPromises.filter(p => p.status === 'BROKEN').length}/{brokenPromises.length}
                </div>
                <div style={{ fontSize: '14px', color: '#ff6600', marginTop: '4px' }}>BROKEN</div>
                <div style={{ marginTop: '16px' }}>
                  {brokenPromises.slice(0, 3).map(p => (
                    <div key={p.id} style={{
                      fontSize: '11px',
                      color: '#888',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ color: p.statusColor }}>✗</span>
                      <span style={{ flex: 1 }}>{p.promise?.length > 35 ? p.promise.substring(0, 35) + '...' : p.promise}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('promises')}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: 'rgba(255,102,0,0.2)',
                    border: '1px solid #ff6600',
                    borderRadius: '4px',
                    color: '#ff6600',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  View All Promises →
                </button>
              </div>
            </div>

            {/* THE CONTRAST */}
            <div style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '24px',
              textAlign: 'center',
            }}>
              <h3 style={{ fontSize: '12px', letterSpacing: '3px', color: '#666', marginBottom: '24px' }}>THE CONTRAST</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>TRUMP'S WEALTH GAIN</div>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: '#00ff66' }}>+${wealthGain.toFixed(1)}B</div>
                </div>
                <div style={{ fontSize: '24px', color: '#444' }}>vs</div>
                <div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>ADDED TO YOUR DEBT</div>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: '#ff3333', fontVariantNumeric: 'tabular-nums' }}>+{fmt(debtSinceInauguration)}</div>
                </div>
              </div>
              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,50,50,0.1)', borderRadius: '8px', border: '1px solid rgba(255,50,50,0.2)' }}>
                <div style={{ fontSize: '14px', color: '#ccc' }}>
                  For every <span style={{ color: '#00ff66', fontWeight: 'bold' }}>$1</span> Trump gained personally,
                  the national debt increased by{' '}
                  <span style={{ color: '#ff3333', fontWeight: 'bold', fontSize: '18px' }}>
                    ${Math.round(debtSinceInauguration / (wealthGain * 1e9)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* US CITIZENS KILLED */}
            <div style={{
              ...styles.cardStrong('#aa0000'),
              borderColor: '#880000',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff0000', boxShadow: '0 0 10px #ff0000', animation: 'pulse 2s infinite' }} />
                <h3 style={{ fontSize: '14px', letterSpacing: '2px', color: '#ff4444', margin: 0 }}>
                  U.S. CITIZENS KILLED BY FEDERAL IMMIGRATION AGENTS
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {iceVictims.map(v => (
                  <div key={v.id} style={{
                    background: 'rgba(255,0,0,0.1)',
                    border: '1px solid rgba(255,0,0,0.3)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#fff' }}>{v.name}</div>
                    <div style={{ fontSize: '11px', color: '#ff6666', margin: '4px 0' }}>
                      Age {v.age} • {v.citizenship} • {v.agency}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{v.date} • {v.location}</div>
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '12px', lineHeight: 1.5 }}>{v.details}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setActiveTab('ice')}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  background: 'rgba(255,0,0,0.2)',
                  border: '1px solid #aa0000',
                  borderRadius: '4px',
                  color: '#ff6666',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Full Details & Statistics →
              </button>
            </div>

            {/* GOLF / SELF-DEALING PREVIEW */}
            <div style={styles.card('#ffc800')}>
              <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#ffc800', marginBottom: '8px' }}>TAXPAYER-FUNDED GOLF (2025)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '16px' }}>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#ffc800' }}>${totalGolfCost.toFixed(1)}M</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{totalTrips} trips • {golf.propertyVisits2025 || 0} total property visits</div>
              </div>
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(255,200,0,0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(255,200,0,0.2)',
              }}>
                <div style={{ fontSize: '12px', color: '#ccc' }}>
                  <strong style={{ color: '#ffc800' }}>Key insight:</strong> When Trump golfs at his resorts, 
                  taxpayers pay for security and lodging <em>at properties he profits from</em>. 
                  Est. ~{fmt(selfDealingFromGolf)} went directly to his businesses in 2025.
                </div>
              </div>
              <button
                onClick={() => setActiveTab('self-dealing')}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: 'rgba(255,200,0,0.2)',
                  border: '1px solid #ffc800',
                  borderRadius: '4px',
                  color: '#ffc800',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Full Self-Dealing Breakdown →
              </button>
            </div>
          </>
        )}

        {/* ============ BROKEN PROMISES TAB ============ */}
        {activeTab === 'promises' && (
          <>
            <h2 style={{ fontSize: '18px', color: '#ff6600', marginBottom: '8px', letterSpacing: '1px' }}>
              CAMPAIGN PROMISES vs REALITY
            </h2>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '24px', lineHeight: 1.6 }}>
              Every promise below includes exact quotes, dates, and verifiable outcomes.
            </p>
            
            {brokenPromises.map(p => (
              <div key={p.id} style={{
                ...styles.card(p.statusColor || '#ff3333'),
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{(p.category || '').toUpperCase()}</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#fff' }}>{p.promise}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {p.datePromised} {p.location && `• ${p.location}`}
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 14px',
                    background: (p.statusColor || '#ff3333') + '25',
                    border: `1px solid ${p.statusColor || '#ff3333'}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: p.statusColor || '#ff3333',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.status}
                  </div>
                </div>
                
                {/* Quote */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                  borderLeft: `3px solid ${p.statusColor || '#ff3333'}`,
                  marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {p.quote}
                  </div>
                </div>
                
                {p.deadline && (
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
                    <strong>Deadline:</strong> {p.deadline}
                  </div>
                )}
                
                {/* Reality */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', letterSpacing: '1px' }}>REALITY:</div>
                  {(p.reality || []).map((fact, i) => (
                    <div key={i} style={{
                      fontSize: '12px',
                      color: '#ccc',
                      padding: '6px 0 6px 14px',
                      borderLeft: '2px solid #333',
                      marginBottom: '4px',
                      lineHeight: 1.4,
                    }}>
                      {fact}
                    </div>
                  ))}
                </div>
                
                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                    <span>Promise fulfilled</span>
                    <span>{p.progress || 0}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${p.progress || 0}%`,
                      background: p.statusColor || '#ff3333',
                      borderRadius: '3px',
                    }} />
                  </div>
                </div>
                
                {/* Sources */}
                <div style={{ marginTop: '12px', fontSize: '10px', color: '#666' }}>
                  Sources: {(p.sources || []).join(' • ')}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ============ SELF-DEALING TAB ============ */}
        {activeTab === 'self-dealing' && (
          <>
            <h2 style={{ fontSize: '18px', color: '#ffc800', marginBottom: '8px', letterSpacing: '1px' }}>
              THE SELF-DEALING PROBLEM
            </h2>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '24px', lineHeight: 1.6 }}>
              When the President spends taxpayer money at his own businesses, he profits personally.
            </p>
            
            {/* Key insight */}
            <div style={{
              ...styles.card('#ffc800'),
              borderWidth: '2px',
              marginBottom: '24px',
            }}>
              <h3 style={{ fontSize: '14px', color: '#ffc800', marginBottom: '12px' }}>
                🔑 THE KEY INSIGHT MOST PEOPLE MISS:
              </h3>
              <div style={{ fontSize: '14px', color: '#fff', lineHeight: 1.7, marginBottom: '12px' }}>
                When Trump golfs at Mar-a-Lago, taxpayers pay for Secret Service rooms, meals, and 
                facilities <strong style={{ color: '#ffc800' }}>at a resort Trump owns</strong>.
                <br /><br />
                This money goes <strong style={{ color: '#ffc800' }}>directly into his bank account</strong>.
              </div>
            </div>
            
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={styles.card('#ff6666')}>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#ff6666', marginBottom: '8px' }}>SECRET SERVICE @ TRUMP PROPERTIES</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#ff6666' }}>~$2M</div>
                <div style={{ fontSize: '11px', color: '#888' }}>First term alone</div>
              </div>
              <div style={styles.card('#ff9900')}>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#ff9900', marginBottom: '8px' }}>FOREIGN GOVERNMENTS (FIRST TERM)</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#ff9900' }}>{fmt(selfDealing.foreignGovFirstTerm || 7800000)}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{selfDealing.foreignCountries || 20} countries</div>
              </div>
              <div style={styles.card('#ffcc00')}>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#ffcc00', marginBottom: '8px' }}>SECRET SERVICE OVERCHARGE</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#ffcc00' }}>{selfDealing.overchargeRate || '300%'}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>Above government rates</div>
              </div>
              <div style={styles.card('#88ff88')}>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#88ff88', marginBottom: '8px' }}>CRYPTO TRADING FEES</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#88ff88' }}>{fmt(selfDealing.cryptoFees || 427000000)}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>$TRUMP coin + World Liberty Financial</div>
              </div>
            </div>
            
            {/* Golf breakdown */}
            <div style={styles.card('#ffc800')}>
              <h3 style={{ fontSize: '14px', color: '#ffc800', marginBottom: '16px' }}>GOLF TRIP SELF-DEALING MATH</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { label: 'Golf trips in 2025', value: totalTrips },
                  { label: 'Total property visits (CREW count)', value: golf.propertyVisits2025 || 129 },
                  { label: 'Est. Trump revenue per trip (GAO basis)', value: fmt(selfDealing.revenuePerTrip || 60000) },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}>
                    <span style={{ color: '#888' }}>{row.label}</span>
                    <span style={{ color: '#ffc800', fontWeight: 'bold' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '14px 12px',
                  background: 'rgba(255,200,0,0.15)',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,200,0,0.3)',
                  fontSize: '14px',
                  marginTop: '8px',
                }}>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>Est. total to Trump's pocket (2025 golf)</span>
                  <span style={{ color: '#ffc800', fontWeight: 'bold', fontSize: '18px' }}>{fmt(selfDealingFromGolf)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ ICE TAB ============ */}
        {activeTab === 'ice' && (
          <>
            <h2 style={{ fontSize: '18px', color: '#ff4444', marginBottom: '8px', letterSpacing: '1px' }}>
              U.S. CITIZENS KILLED BY FEDERAL IMMIGRATION AGENTS
            </h2>
            
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {[
                { value: iceVictims.filter(v => v.citizenship === 'US Citizen').length, label: 'US CITIZENS\nKILLED', color: '#ff0000' },
                { value: `${iceStats.totalShootings || 27}+`, label: 'TOTAL\nSHOOTINGS', color: '#ff4444' },
                { value: iceStats.shootingDeaths || 8, label: 'SHOOTING\nDEATHS', color: '#ff6666' },
                { value: iceStats.detentionDeaths2025 || 32, label: '2025 DETENTION\nDEATHS', color: '#ff8888' },
                { value: `${iceStats.detentionDeaths2026 || 6}+`, label: '2026 DETENTION\nDEATHS', color: '#ffaaaa' },
              ].map((s, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  padding: '16px 8px',
                  background: 'rgba(255,0,0,0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,0,0,0.2)',
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: '#888', whiteSpace: 'pre-line', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            
            {/* Victim details */}
            {iceVictims.map(v => (
              <div key={v.id} style={{
                ...styles.cardStrong('#880000'),
                marginBottom: '20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>{v.name}</div>
                    <div style={{ fontSize: '12px', color: '#ff6666', marginTop: '4px' }}>
                      Age {v.age} • {v.citizenship} • Killed by {v.agency}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                      {v.date} • {v.location}
                    </div>
                  </div>
                </div>
                
                <div style={{
                  marginTop: '16px',
                  padding: '14px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#ccc',
                  lineHeight: 1.6,
                }}>
                  {v.details}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(255,100,100,0.1)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#ff8888', marginBottom: '4px' }}>OFFICIAL ACCOUNT</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{v.officialResponse}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(100,255,100,0.1)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#88ff88', marginBottom: '4px' }}>WITNESS ACCOUNT</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{v.witnessAccount}</div>
                  </div>
                </div>
                
                <div style={{ marginTop: '12px', fontSize: '10px', color: '#666' }}>
                  Sources: {(v.sources || []).join(' • ')}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ============ SOURCES TAB ============ */}
        {activeTab === 'sources' && (
          <>
            <h2 style={{ fontSize: '18px', color: '#888', marginBottom: '24px' }}>
              DATA SOURCES & METHODOLOGY
            </h2>
            
            {[
              { category: 'National Debt', sources: ['U.S. Treasury Department', 'Joint Economic Committee', 'CBO'] },
              { category: 'Personal Wealth', sources: ['Forbes', 'Bloomberg', 'New York Times'] },
              { category: 'Golf & Travel', sources: ['GAO', 'HuffPost', 'CREW'] },
              { category: 'Self-Dealing', sources: ['CREW', 'American Oversight', 'House Oversight Committee'] },
              { category: 'Broken Promises', sources: ['PolitiFact', 'CNN', 'NPR', 'BLS', 'EIA'] },
              { category: 'ICE Deaths', sources: ['Wikipedia', 'NPR', 'AP', 'ACLU', 'Vera Institute'] },
            ].map((section, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>{section.category}</h3>
                <div style={{ fontSize: '11px', color: '#666' }}>{section.sources.join(' • ')}</div>
              </div>
            ))}
          </>
        )}

        {/* ---- FOOTER ---- */}
        <footer style={{
          textAlign: 'center',
          padding: '40px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          marginTop: '40px',
        }}>
          <div style={{ fontSize: '11px', color: '#666' }}>
            Built for transparency and accountability • Data auto-updates via AI monitoring
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

export default App;
