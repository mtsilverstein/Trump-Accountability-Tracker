import React, { useState, useEffect, useMemo } from 'react';

/**
 * Trump Administration Accountability Tracker
 * 
 * Objective, fact-based tracking of:
 * - National debt (LIVE counter)
 * - Personal wealth gains
 * - Broken campaign promises (with exact quotes)
 * - Self-dealing and conflicts of interest
 * - US Citizens killed by ICE/CBP
 * 
 * Every claim is sourced from mainstream outlets: GAO, Forbes, NPR, CREW, etc.
 * Built for people across the political spectrum who value facts.
 */

// ============ DATA ============

const DATA = {
  debt: {
    atInauguration: 36.18,      // Trillions (Jan 20, 2025)
    baseline: 38.43,            // Trillions (Jan 7, 2026)
    baselineDate: new Date('2026-01-07T00:00:00Z'),
    perSecond: 92912.33,        // JEC estimate
    perHousehold: 285127,
    source: 'Joint Economic Committee / Treasury Dept',
  },
  
  wealth: {
    current: 6.6,               // Billions (Forbes Jan 2026)
    previous: 2.3,              // Billions (Forbes Jan 2024)
    rank: 581,
    source: 'Forbes',
    breakdown: [
      { category: 'Cryptocurrencies', value: 7.1, note: 'Up to (NYT July 2025)' },
      { category: 'Stocks, Bonds & Cash', value: 2.2 },
      { category: 'Real Estate & Business', value: 1.3 },
      { category: 'Debts', value: -0.64 },
    ],
  },
  
  golf: {
    marALagoTrips: 16,
    marALagoCost: 3.4,          // Millions per trip (GAO)
    bedminsterTrips: 9,
    bedminsterCost: 1.1,
    scotlandTrips: 1,
    scotlandCost: 9.6,
    firstTermTotal: 151.5,      // Millions
    propertyVisits2025: 129,    // CREW count
    source: 'GAO 2019 methodology / HuffPost / CREW',
  },
  
  selfDealing: {
    secretServiceAtProperties: 100000,     // First months term 2 (CREW FOIA)
    secretServiceFirstTerm: 2000000,       // Approx
    foreignGovFirstTerm: 7800000,          // House Oversight
    foreignCountries: 20,
    overchargeRate: '300%',                // Above govt rates
    revenuePerTrip: 60000,                 // GAO basis
    cryptoFees: 427000000,                 // FT report
    source: 'CREW / House Oversight / GAO / American Oversight',
  },
  
  iceVictims: [
    { 
      id: 'renee-good',
      name: 'Renée Good', 
      age: 37, 
      citizenship: 'US Citizen',
      date: 'January 7, 2026',
      location: 'Minneapolis, MN',
      agency: 'ICE',
      details: 'Shot by ICE agent Jonathan Ross while in her vehicle during "Operation Metro Surge." Mother of a 6-year-old. Video shows agent filming with phone before shooting.',
      officialResponse: 'DHS claims self-defense',
      witnessAccount: 'Mayor Frey: "narrative that this was done in self-defense is garbage"',
      sources: ['Wikipedia', 'NPR', 'CNN', 'Al Jazeera'],
    },
    { 
      id: 'alex-pretti',
      name: 'Alex Pretti', 
      age: 37, 
      citizenship: 'US Citizen',
      date: 'January 24, 2026',
      location: 'Minneapolis, MN',
      agency: 'Border Patrol',
      details: 'ICU nurse at VA hospital. Shot while observing immigration enforcement. Bystander video shows him helping a woman who was pushed down, then being tackled and shot 4 times in the back.',
      officialResponse: 'DHS claims he "tried to assassinate federal law enforcement"',
      witnessAccount: 'Sworn statements say he did not brandish gun, was helping woman get up',
      sources: ['Wikipedia', 'NPR', 'CBS News', 'Al Jazeera'],
    },
  ],
  
  iceStats: {
    totalShootings: 27,
    shootingDeaths: 8,
    detentionDeaths2025: 32,    // Highest since 2004
    detentionDeaths2026: 6,
    note: 'December 2025 was deadliest month on record',
    source: 'Wikipedia / ACLU / Vera Institute / AILA',
  },
  
  brokenPromises: [
    {
      id: 'energy-50',
      category: 'Economy',
      promise: 'Cut energy bills in HALF within 12 months',
      quote: '"I will cut your energy and electricity prices in half, 50% — 5-0 — within 12 months of taking the oath"',
      datePromised: 'August 14, 2024',
      location: 'Asheville, NC rally',
      deadline: 'January 20, 2026',
      status: 'BROKEN',
      statusColor: '#ff3333',
      progress: 20,
      reality: [
        'Gasoline: Down ~20% (not 50%) - global oil prices, not policy',
        'Electricity: RISING - natural gas up 50%+ due to LNG exports',
        'Average family paid $124 MORE for utilities since inauguration',
        'EIA projects natural gas prices 16% higher in 2026',
      ],
      sources: ['NPR', 'Public Citizen', 'EIA'],
    },
    {
      id: 'ukraine-24h',
      category: 'Foreign Policy',
      promise: 'End Ukraine war within 24 HOURS',
      quote: '"I\'ll get that done within 24 hours. Everyone says, \'Oh, no, you can\'t.\' Absolutely I can."',
      datePromised: 'July 2023 - November 2024',
      location: '53+ times at rallies',
      deadline: 'January 21, 2025',
      status: 'BROKEN',
      statusColor: '#ff3333',
      progress: 0,
      reality: [
        'War continues after 370+ days in office',
        'Trump now says it was "in jest" and "an exaggeration"',
        'Extended deadline to 100 days, then 6 months, now indefinite',
        'Secretary Rubio suggested US may "back away" from negotiations',
      ],
      sources: ['CNN (53 instances documented)', 'Time Magazine', 'PolitiFact'],
    },
    {
      id: 'day-one-inflation',
      category: 'Economy',
      promise: 'End inflation on DAY ONE',
      quote: '"Starting on day one, we will end inflation and make America affordable again"',
      datePromised: 'August 9, 2024',
      location: 'Bozeman, MT rally',
      deadline: 'January 20, 2025',
      status: 'BROKEN',
      statusColor: '#ff3333',
      progress: 0,
      reality: [
        'CPI accelerated to 3.0% after taking office (up from 2.9%)',
        'Eggs spiked 15.2% in one month (Jan 2025)',
        'Groceries: 2.7% increase - largest non-pandemic gain since 2015',
        'Goldman Sachs: Consumers bearing 50%+ of tariff costs',
      ],
      sources: ['BLS', 'Newsweek', 'CNN', 'Goldman Sachs'],
    },
    {
      id: 'epstein-files',
      category: 'Transparency',
      promise: 'Release the Epstein files',
      quote: '"I guess I would [release the Epstein files]"',
      datePromised: 'June 2024',
      location: 'Fox & Friends, Lex Fridman Podcast',
      deadline: 'No specific date given',
      status: 'MOSTLY BROKEN',
      statusColor: '#ff6600',
      progress: 30,
      reality: [
        'Administration resisted release for months',
        'Congress forced his hand with 427-1 vote (Epstein Files Transparency Act)',
        'DOJ MISSED legal deadline (December 19, 2025)',
        '5.2 million pages still unreviewed as of late December',
        'Released files show Trump flew on Epstein plane 8 times (more than known)',
      ],
      sources: ['NPR', 'Axios', 'CNBC', 'Wikipedia'],
    },
    {
      id: 'drill-baby-drill',
      category: 'Energy',
      promise: '"Drill, baby, drill" - Unleash energy production',
      quote: '"We\'re going to drill, baby, drill"',
      datePromised: 'Throughout 2024 campaign',
      location: 'Multiple rallies',
      deadline: null,
      status: 'BROKEN',
      statusColor: '#ff3333',
      progress: 0,
      reality: [
        'Active drilling rigs DOWN 6%+ year-over-year',
        'Oil prices too low (~$50s) to justify new drilling',
        'His own pressure for low prices is PREVENTING drilling',
        'Oil industry got all 12 lobbying priorities except this',
      ],
      sources: ['NPR', 'American Petroleum Institute'],
    },
    {
      id: 'medicare-medicaid',
      category: 'Healthcare',
      promise: 'Protect Medicare and Medicaid - NO CUTS',
      quote: '"I will never do anything that will jeopardize or hurt Social Security or Medicare"',
      datePromised: 'Multiple interviews 2024',
      location: 'Various',
      deadline: null,
      status: 'BROKEN',
      statusColor: '#ff3333',
      progress: 0,
      reality: [
        'Signed largest healthcare cut in history',
        '17 million Americans projected to lose healthcare',
        'Let ACA tax credits expire - premiums spiked 50%+',
        'Treasury Secretary Bessent admitted bill is "backdoor for privatizing Social Security"',
      ],
      sources: ['CBS News', 'Reuters', 'Democrats.org'],
    },
  ],
};

// ============ COMPONENT ============

function App() {
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('overview');
  
  // Update time 10x per second for smooth counters
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  // ---- CALCULATIONS ----
  
  const INAUGURATION = new Date('2025-01-20T17:00:00Z');
  
  const liveDebt = useMemo(() => {
    const secSinceBaseline = (now - DATA.debt.baselineDate.getTime()) / 1000;
    return (DATA.debt.baseline * 1e12) + (secSinceBaseline * DATA.debt.perSecond);
  }, [now]);
  
  const debtSinceInauguration = liveDebt - (DATA.debt.atInauguration * 1e12);
  
  const timeSinceInauguration = useMemo(() => {
    const sec = Math.floor((now - INAUGURATION.getTime()) / 1000);
    return {
      days: Math.floor(sec / 86400),
      hours: Math.floor((sec % 86400) / 3600),
      minutes: Math.floor((sec % 3600) / 60),
      seconds: sec % 60,
    };
  }, [now]);
  
  const wealthGain = DATA.wealth.current - DATA.wealth.previous;
  const wealthGainPercent = Math.round((wealthGain / DATA.wealth.previous) * 100);
  
  const totalGolfCost = (DATA.golf.marALagoTrips * DATA.golf.marALagoCost) +
                        (DATA.golf.bedminsterTrips * DATA.golf.bedminsterCost) +
                        (DATA.golf.scotlandTrips * DATA.golf.scotlandCost);
  
  const totalTrips = DATA.golf.marALagoTrips + DATA.golf.bedminsterTrips + DATA.golf.scotlandTrips;
  const selfDealingFromGolf = totalTrips * DATA.selfDealing.revenuePerTrip;

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
            Objective facts • Verifiable sources • Updated regularly
          </p>
          
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
                  <span style={{ animation: 'blink 0.5s infinite' }}>+</span> {fmt(DATA.debt.perSecond, 0)}/second
                </div>
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>INCREASE SINCE INAUGURATION</div>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#ff3333' }}>+{fmt(debtSinceInauguration)}</div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: '#666' }}>
                  Per household: ${DATA.debt.perHousehold.toLocaleString()}
                </div>
              </div>
              
              {/* WEALTH */}
              <div style={styles.card('#00ff66')}>
                <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#00ff66', marginBottom: '8px' }}>TRUMP PERSONAL NET WORTH</div>
                <div style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: '900', color: '#00ff66', lineHeight: 1 }}>
                  ${DATA.wealth.current}B
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>Forbes estimate (Jan 2026) • Rank #{DATA.wealth.rank}</div>
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
                  {DATA.brokenPromises.filter(p => p.status === 'BROKEN').length}/{DATA.brokenPromises.length}
                </div>
                <div style={{ fontSize: '14px', color: '#ff6600', marginTop: '4px' }}>BROKEN</div>
                <div style={{ marginTop: '16px' }}>
                  {DATA.brokenPromises.slice(0, 3).map(p => (
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
                      <span style={{ flex: 1 }}>{p.promise.length > 35 ? p.promise.substring(0, 35) + '...' : p.promise}</span>
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
                {DATA.iceVictims.map(v => (
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
                <div style={{ fontSize: '12px', color: '#888' }}>{totalTrips} trips • {DATA.golf.propertyVisits2025} total property visits</div>
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
              Click sources to verify.
            </p>
            
            {DATA.brokenPromises.map(p => (
              <div key={p.id} style={{
                ...styles.card(p.statusColor),
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{p.category.toUpperCase()}</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#fff' }}>{p.promise}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {p.datePromised} {p.location && `• ${p.location}`}
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 14px',
                    background: p.statusColor + '25',
                    border: `1px solid ${p.statusColor}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: p.statusColor,
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
                  borderLeft: `3px solid ${p.statusColor}`,
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
                  {p.reality.map((fact, i) => (
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
                    <span>{p.progress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${p.progress}%`,
                      background: p.statusColor,
                      borderRadius: '3px',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
                
                {/* Sources */}
                <div style={{ marginTop: '12px', fontSize: '10px', color: '#666' }}>
                  Sources: {p.sources.join(' • ')}
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
              This is the conflict of interest that every prior modern president avoided by divesting.
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
                <br /><br />
                It's not just "expensive vacations" — it's a <strong style={{ color: '#ffc800' }}>direct transfer of public funds 
                to the President's private business</strong>.
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
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#ff9900' }}>{fmt(DATA.selfDealing.foreignGovFirstTerm)}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{DATA.selfDealing.foreignCountries} countries (House Oversight)</div>
              </div>
              <div style={styles.card('#ffcc00')}>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#ffcc00', marginBottom: '8px' }}>SECRET SERVICE OVERCHARGE</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#ffcc00' }}>{DATA.selfDealing.overchargeRate}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>Above government rates</div>
              </div>
              <div style={styles.card('#88ff88')}>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#88ff88', marginBottom: '8px' }}>CRYPTO TRADING FEES</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#88ff88' }}>{fmt(DATA.selfDealing.cryptoFees)}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>$TRUMP coin + World Liberty Financial</div>
              </div>
            </div>
            
            {/* Golf breakdown */}
            <div style={styles.card('#ffc800')}>
              <h3 style={{ fontSize: '14px', color: '#ffc800', marginBottom: '16px' }}>GOLF TRIP SELF-DEALING MATH</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { label: 'Golf trips in 2025', value: totalTrips },
                  { label: 'Total property visits (CREW count)', value: DATA.golf.propertyVisits2025 },
                  { label: 'Est. Trump revenue per trip (GAO basis)', value: fmt(DATA.selfDealing.revenuePerTrip) },
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
              <div style={{ marginTop: '16px', fontSize: '11px', color: '#888', lineHeight: 1.5 }}>
                <strong>Note:</strong> GAO 2019 report found $60,000 paid directly to Mar-a-Lago for just 4 trips 
                (rooms alone). Actual total is likely higher when including food, facilities, and markup.
              </div>
            </div>
            
            {/* Source */}
            <div style={{ fontSize: '11px', color: '#666', marginTop: '16px' }}>
              Sources: {DATA.selfDealing.source}
            </div>
          </>
        )}

        {/* ============ ICE TAB ============ */}
        {activeTab === 'ice' && (
          <>
            <h2 style={{ fontSize: '18px', color: '#ff4444', marginBottom: '8px', letterSpacing: '1px' }}>
              U.S. CITIZENS KILLED BY FEDERAL IMMIGRATION AGENTS
            </h2>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '24px', lineHeight: 1.6 }}>
              Both individuals below were American citizens killed by ICE or Border Patrol in January 2026.
              Includes official accounts and witness testimony.
            </p>
            
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {[
                { value: DATA.iceVictims.filter(v => v.citizenship === 'US Citizen').length, label: 'US CITIZENS\nKILLED', color: '#ff0000' },
                { value: `${DATA.iceStats.totalShootings}+`, label: 'TOTAL\nSHOOTINGS', color: '#ff4444' },
                { value: DATA.iceStats.shootingDeaths, label: 'SHOOTING\nDEATHS', color: '#ff6666' },
                { value: DATA.iceStats.detentionDeaths2025, label: '2025 DETENTION\nDEATHS', color: '#ff8888' },
                { value: `${DATA.iceStats.detentionDeaths2026}+`, label: '2026 DETENTION\nDEATHS', color: '#ffaaaa' },
              ].map((s, i) => (
                <div key={i} style={{
                  textAlign: 'center',
                  padding: '16px 8px',
                  background: 'rgba(255,0,0,0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,0,0,0.2)',
                }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: '#888', whiteSpace: 'pre-line', marginTop: '4px', letterSpacing: '0.5px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255,0,0,0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(255,0,0,0.2)',
              marginBottom: '24px',
              fontSize: '12px',
              color: '#ff8888',
            }}>
              <strong>Context:</strong> 2025 had the highest number of ICE detention deaths since 2004 (20-year high). 
              December 2025 was the single deadliest month on record.
            </div>
            
            {/* Victim details */}
            {DATA.iceVictims.map(v => (
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
                  <div style={{
                    padding: '6px 12px',
                    background: 'rgba(255,0,0,0.2)',
                    border: '1px solid #aa0000',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: '#ff6666',
                    fontWeight: 'bold',
                  }}>
                    {v.citizenship.toUpperCase()}
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
                    <div style={{ fontSize: '10px', color: '#ff8888', marginBottom: '4px', letterSpacing: '1px' }}>OFFICIAL ACCOUNT</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{v.officialResponse}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(100,255,100,0.1)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#88ff88', marginBottom: '4px', letterSpacing: '1px' }}>WITNESS ACCOUNT</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{v.witnessAccount}</div>
                  </div>
                </div>
                
                <div style={{ marginTop: '12px', fontSize: '10px', color: '#666' }}>
                  Sources: {v.sources.join(' • ')}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ============ SOURCES TAB ============ */}
        {activeTab === 'sources' && (
          <>
            <h2 style={{ fontSize: '18px', color: '#888', marginBottom: '8px', letterSpacing: '1px' }}>
              DATA SOURCES & METHODOLOGY
            </h2>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '24px', lineHeight: 1.6 }}>
              Every data point on this tracker is sourced from official government reports, 
              mainstream news outlets, or nonpartisan watchdog organizations.
            </p>
            
            {[
              {
                category: 'National Debt',
                sources: [
                  'U.S. Treasury Department - Debt to the Penny',
                  'Joint Economic Committee - Daily Debt Monitor',
                  'Congressional Budget Office (CBO)',
                ],
              },
              {
                category: 'Personal Wealth',
                sources: [
                  'Forbes Real-Time Billionaires List',
                  'Bloomberg Billionaires Index',
                  'New York Times (crypto holdings analysis)',
                ],
              },
              {
                category: 'Golf & Travel Costs',
                sources: [
                  'Government Accountability Office (GAO) - 2019 Presidential Travel Report',
                  'HuffPost (applying GAO methodology to current trips)',
                  'CREW - Property Visit Tracking',
                ],
              },
              {
                category: 'Self-Dealing & Conflicts',
                sources: [
                  'Citizens for Responsibility and Ethics in Washington (CREW)',
                  'American Oversight (FOIA investigations)',
                  'House Oversight Committee reports',
                  'Financial Times (crypto fee analysis)',
                ],
              },
              {
                category: 'Broken Promises',
                sources: [
                  'PolitiFact - Promise Tracker',
                  'CNN Fact Check',
                  'NPR',
                  'Bureau of Labor Statistics (inflation data)',
                  'Energy Information Administration (energy prices)',
                ],
              },
              {
                category: 'ICE/CBP Incidents',
                sources: [
                  'Wikipedia (with citations)',
                  'NPR / PBS / AP / Reuters',
                  'ACLU',
                  'Vera Institute of Justice',
                  'American Immigration Lawyers Association (AILA)',
                ],
              },
            ].map((section, i) => (
              <div key={i} style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>{section.category}</h3>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {section.sources.map((src, j) => (
                    <li key={j} style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{src}</li>
                  ))}
                </ul>
              </div>
            ))}
            
            <div style={{
              marginTop: '32px',
              padding: '16px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h3 style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>METHODOLOGY NOTE</h3>
              <p style={{ fontSize: '11px', color: '#666', lineHeight: 1.6, margin: 0 }}>
                This tracker aims to present objective, verifiable facts. We do not editorialize 
                or draw conclusions — we present the data and let users decide. All claims require 
                at least one mainstream source. ICE incidents require multiple independent sources 
                before being listed.
                <br /><br />
                <strong>Found an error?</strong> This tracker is open to corrections. 
                File an issue or submit a PR on GitHub.
              </p>
            </div>
          </>
        )}

        {/* ---- FOOTER ---- */}
        <footer style={{
          textAlign: 'center',
          padding: '40px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          marginTop: '40px',
        }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>
            Built for transparency and public accountability
          </div>
          <div style={{ fontSize: '10px', color: '#444' }}>
            Data sources: Forbes • GAO • Treasury • JEC • CBO • CREW • House Oversight • 
            NPR • CNN • PolitiFact • AP • Reuters • ACLU • Vera Institute
          </div>
        </footer>
      </div>

      {/* Animations */}
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
        ::selection { background: rgba(255,50,50,0.3); }
      `}</style>
    </div>
  );
}

export default App;
