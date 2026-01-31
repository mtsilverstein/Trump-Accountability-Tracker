/**
 * Vercel API: Trump Accountability Tracker Auto-Update
 * 
 * PRIORITY ACTIONS IMPLEMENTED:
 * ✅ Action 2: Input validation for all data
 * ✅ Action 5: Extended to track polls
 * ✅ Action 6: Extended to track lawsuits
 * ✅ Action 7: Epstein files tracking
 * 
 * Features:
 * - Gemini 2.5 Pro for news analysis
 * - Smart ICE incident handling (unnamed → named updates)
 * - Lawsuit tracking (against admin AND by Trump)
 * - Poll tracking from news
 * - Epstein files tracking
 * - Input validation/sanitization
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Stable Gemini 2.5 Pro model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

const SEARCH_QUERIES = [
  // ICE/Immigration enforcement
  'ICE shooting victim 2026',
  'Border Patrol shooting 2026',
  'ICE agent kills',
  
  // Lawsuits
  'Trump lawsuit federal court 2026',
  'Trump administration sued 2026',
  'lawsuit against Trump',
  'Trump sues',
  
  // Polls
  'Trump approval rating poll January 2026',
  'Trump poll numbers',
  
  // Epstein files - Trump and his circle
  'Epstein files Trump',
  'Epstein files released 2026',
  'Epstein documents DOJ',
  'Trump Epstein flight logs',
  'Epstein files Elon Musk',
  'Epstein files Steve Bannon',
  'Epstein Maxwell Trump',
  'Todd Blanche Epstein',
];

// ==================== INPUT VALIDATION (Priority Action #2) ====================
// Sanitizes and validates ALL data before it enters the database

const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_LENGTH = 100;
const VALID_STATUSES = ['Pending', 'Ruling', 'Dismissed', 'Appealed', 'Blocked', 'Ongoing', 'Mixed'];
const VALID_CITIZENSHIP = ['US Citizen', 'Legal Resident', 'Undocumented', 'Unknown'];
const VALID_AGENCIES = ['ICE', 'Border Patrol', 'CBP', 'DHS', 'Unknown'];

/**
 * Sanitize a string: trim, limit length, remove potentially dangerous characters
 */
function sanitizeString(str, maxLength = MAX_STRING_LENGTH) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Sanitize a number within bounds
 */
function sanitizeNumber(num, min = 0, max = 1000000) {
  const parsed = Number(num);
  if (isNaN(parsed)) return null;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validate and sanitize an ICE incident
 */
function validateIceIncident(incident) {
  if (!incident || typeof incident !== 'object') return null;
  
  const name = sanitizeString(incident.name, 200);
  const date = sanitizeString(incident.date, 50);
  const location = sanitizeString(incident.location, 200);
  
  // Must have name AND (date OR location)
  if (!name || (!date && !location)) return null;
  
  // Validate citizenship
  let citizenship = sanitizeString(incident.citizenship, 50);
  if (!VALID_CITIZENSHIP.includes(citizenship)) {
    citizenship = 'Unknown';
  }
  
  // Validate agency
  let agency = sanitizeString(incident.agency, 50);
  if (!VALID_AGENCIES.includes(agency)) {
    agency = 'Unknown';
  }
  
  return {
    id: sanitizeString(incident.id, 100) || `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name,
    age: sanitizeNumber(incident.age, 0, 150) || 0,
    citizenship,
    date,
    location,
    agency,
    details: sanitizeString(incident.details, 2000),
    officialResponse: sanitizeString(incident.officialResponse, 1000),
    witnessAccount: sanitizeString(incident.witnessAccount, 1000),
    sources: Array.isArray(incident.sources) 
      ? incident.sources.slice(0, 10).map(s => sanitizeString(s, 200)).filter(Boolean)
      : [],
  };
}

/**
 * Validate and sanitize a lawsuit
 */
function validateLawsuit(lawsuit) {
  if (!lawsuit || typeof lawsuit !== 'object') return null;
  
  const title = sanitizeString(lawsuit.title, 300);
  if (!title) return null;
  
  // Validate status
  let status = sanitizeString(lawsuit.status, 50);
  if (!VALID_STATUSES.includes(status)) {
    status = 'Pending';
  }
  
  return {
    id: sanitizeString(lawsuit.id, 100) || `lawsuit-${Date.now()}`,
    title,
    plaintiff: sanitizeString(lawsuit.plaintiff, 300),
    defendant: sanitizeString(lawsuit.defendant, 300),
    court: sanitizeString(lawsuit.court, 200),
    filed: sanitizeString(lawsuit.filed, 50),
    status,
    summary: sanitizeString(lawsuit.summary, 2000),
    ruling: sanitizeString(lawsuit.ruling, 1000),
    amount: sanitizeString(lawsuit.amount, 50),
    category: sanitizeString(lawsuit.category, 100),
    sources: Array.isArray(lawsuit.sources)
      ? lawsuit.sources.slice(0, 10).map(s => sanitizeString(s, 200)).filter(Boolean)
      : [],
  };
}

/**
 * Validate and sanitize poll data
 */
function validatePollData(polls) {
  if (!polls || typeof polls !== 'object') return null;
  
  return {
    overall: {
      approve: sanitizeNumber(polls.overall?.approve, 0, 100),
      disapprove: sanitizeNumber(polls.overall?.disapprove, 0, 100),
      source: sanitizeString(polls.overall?.source, 200),
      date: sanitizeString(polls.overall?.date, 50),
    },
    immigration: {
      approve: sanitizeNumber(polls.immigration?.approve, 0, 100),
      disapprove: sanitizeNumber(polls.immigration?.disapprove, 0, 100),
      source: sanitizeString(polls.immigration?.source, 200),
    },
    economy: {
      approve: sanitizeNumber(polls.economy?.approve, 0, 100),
      disapprove: sanitizeNumber(polls.economy?.disapprove, 0, 100),
      source: sanitizeString(polls.economy?.source, 200),
    },
    netApproval: sanitizeNumber(polls.netApproval, -100, 100),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Validate ICE stats
 */
function validateIceStats(stats) {
  if (!stats || typeof stats !== 'object') return null;
  
  return {
    totalShootings: sanitizeNumber(stats.totalShootings, 0, 10000),
    shootingDeaths: sanitizeNumber(stats.shootingDeaths, 0, 10000),
    usCitizensKilled: sanitizeNumber(stats.usCitizensKilled, 0, 10000),
    usCitizensShot: sanitizeNumber(stats.usCitizensShot, 0, 10000),
    detentionDeaths2025: sanitizeNumber(stats.detentionDeaths2025, 0, 10000),
    detentionDeaths2026: sanitizeNumber(stats.detentionDeaths2026, 0, 10000),
  };
}

/**
 * Validate and sanitize Epstein revelation
 */
function validateEpsteinRevelation(revelation) {
  if (!revelation || typeof revelation !== 'object') return null;
  
  const headline = sanitizeString(revelation.headline, 300);
  if (!headline) return null;
  
  return {
    id: sanitizeString(revelation.id, 100) || `epstein-${Date.now()}`,
    headline,
    details: sanitizeString(revelation.details, 2000),
    involvedPerson: sanitizeString(revelation.involvedPerson, 100),
    date: sanitizeString(revelation.date, 50),
    sources: Array.isArray(revelation.sources)
      ? revelation.sources.slice(0, 10).map(s => sanitizeString(s, 200)).filter(Boolean)
      : [],
  };
}

/**
 * Validate Epstein updates object
 */
function validateEpsteinUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  
  const validRevelations = Array.isArray(updates.newRevelations)
    ? updates.newRevelations.map(validateEpsteinRevelation).filter(Boolean)
    : [];
  
  return {
    newRevelations: validRevelations,
    pagesReleased: sanitizeNumber(updates.pagesReleased, 0, 100000000),
    pagesWithheld: sanitizeNumber(updates.pagesWithheld, 0, 100000000),
    newFlightInfo: sanitizeString(updates.newFlightInfo, 1000),
    dojActions: sanitizeString(updates.dojActions, 1000),
    lastUpdated: new Date().toISOString(),
  };
}

// ==================== NEWS FETCHING ====================

async function fetchNewsRSS(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url);
    const text = await response.text();
    
    const items = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    for (const item of itemMatches.slice(0, 5)) {
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || '';
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      if (title) items.push({ title: sanitizeString(title, 500), pubDate, query });
    }
    return items;
  } catch (err) {
    console.error(`RSS error for "${query}":`, err);
    return [];
  }
}

async function fetchAllNews() {
  const allNews = [];
  for (const query of SEARCH_QUERIES) {
    const news = await fetchNewsRSS(query);
    allNews.push(...news);
  }
  // Dedupe by title
  const seen = new Set();
  return allNews.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, MAX_ARRAY_LENGTH); // Limit total items
}

// ==================== GEMINI API ====================

async function callGemini(prompt) {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error: ${response.status} - ${err}`);
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ==================== SUPABASE ====================

async function getCurrentData() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/tracker_data?id=eq.main&select=data`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const result = await response.json();
  return result[0]?.data || {};
}

async function updateSupabase(data) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/tracker_data?id=eq.main`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    }
  );
  return response.ok;
}

async function logUpdate(logEntry) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/update_logs`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...logEntry,
        }),
      }
    );
    return response.ok;
  } catch (err) {
    console.error('Failed to write update log:', err);
    return false;
  }
}

// ==================== SMART ICE INCIDENT MERGE ====================

function mergeIceIncidents(existing, newIncidents) {
  // Validate all existing incidents
  let result = existing
    .map(validateIceIncident)
    .filter(Boolean);
  
  // Validate and filter new incidents
  const validNew = newIncidents
    .map(validateIceIncident)
    .filter(Boolean);
  
  for (const newInc of validNew) {
    // Check if this matches an existing unnamed incident by date/location
    const matchIndex = result.findIndex(ex => {
      const sameDate = ex.date === newInc.date;
      const sameLocation = ex.location === newInc.location;
      const existingIsUnnamed = ex.name?.toLowerCase().includes('unnamed') || 
                                ex.name?.toLowerCase().includes('unknown') ||
                                ex.name?.toLowerCase().includes('unidentified');
      
      return sameDate && sameLocation && existingIsUnnamed && newInc.name && 
             !newInc.name.toLowerCase().includes('unnamed');
    });
    
    if (matchIndex >= 0) {
      // Update unnamed incident with new name and details
      console.log(`Updating unnamed incident with: ${newInc.name}`);
      result[matchIndex] = { ...result[matchIndex], ...newInc };
    } else {
      // Check for exact ID or name match
      const exactMatch = result.findIndex(ex => 
        ex.id === newInc.id || 
        (ex.name && newInc.name && ex.name.toLowerCase() === newInc.name.toLowerCase())
      );
      
      if (exactMatch >= 0) {
        // Update existing with longer/newer info
        const ex = result[exactMatch];
        for (const field in newInc) {
          if (newInc[field] && (!ex[field] || String(newInc[field]).length > String(ex[field]).length)) {
            ex[field] = newInc[field];
          }
        }
      } else {
        // Truly new incident
        result.push(newInc);
      }
    }
  }
  
  // Limit total incidents
  return result.slice(0, MAX_ARRAY_LENGTH);
}

// ==================== MERGE LAWSUITS ====================

function mergeLawsuits(existing, newLawsuits) {
  // Validate all
  const validExisting = existing.map(validateLawsuit).filter(Boolean);
  const validNew = newLawsuits.map(validateLawsuit).filter(Boolean);
  
  const existingIds = new Set(validExisting.map(l => l.id));
  const existingTitles = new Set(validExisting.map(l => l.title.toLowerCase()));
  
  const trulyNew = validNew.filter(l => 
    !existingIds.has(l.id) && !existingTitles.has(l.title.toLowerCase())
  );
  
  return [...validExisting, ...trulyNew].slice(0, MAX_ARRAY_LENGTH);
}

// ==================== STATIC DATA ====================

function getBrokenPromises() {
  return [
    {
      id: "groceries-down",
      title: "Grocery Prices Down",
      quote: "I won on groceries. I won an election based on that.",
      status: "BROKEN",
      promise: "Bring grocery prices way down",
      reality: "Grocery prices UP 2.4% year-over-year. December 2025 was largest monthly spike since Aug 2022. Coffee up 20%, ground beef up 15.5%.",
      sources: ["CNN", "BLS", "ABC News", "Axios"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "December 2024"
    },
    {
      id: "manufacturing-jobs",
      title: "Manufacturing Jobs",
      quote: "Jobs and factories will come roaring back into our country.",
      status: "BROKEN",
      promise: "Manufacturing jobs roaring back",
      reality: "Lost 72,000+ manufacturing jobs since Liberation Day. Manufacturing declined 7 straight months. 73% of manufacturers cite tariffs as top challenge.",
      sources: ["Washington Post", "CBC", "CAP", "NAM"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "April 2, 2025"
    },
    {
      id: "energy-50",
      title: "Energy Prices 50% Cut",
      quote: "I will cut your energy and electricity prices in half, 50%",
      status: "BROKEN",
      promise: "Cut energy bills in HALF within 12 months",
      reality: "Gasoline down ~20% (not 50%). Electricity UP 9%. Families paid $124 MORE for utilities.",
      sources: ["NPR", "CNN", "BLS", "EIA"],
      category: "Economy",
      progress: 20,
      statusColor: "#ff3333",
      date: "August 14, 2024"
    },
    {
      id: "ukraine-24h",
      title: "End Ukraine War 24h",
      quote: "I will get that done within 24 hours",
      status: "BROKEN",
      promise: "End Ukraine war within 24 HOURS",
      reality: "War continues 370+ days later. Trump now says it was 'in jest'.",
      sources: ["CNN", "Time Magazine", "PolitiFact"],
      category: "Foreign Policy",
      progress: 0,
      statusColor: "#ff3333",
      date: "July 2023 - November 2024"
    },
    {
      id: "day-one-inflation",
      title: "End Inflation Day One",
      quote: "Starting on day one, we will end inflation",
      status: "BROKEN",
      promise: "End inflation on DAY ONE",
      reality: "CPI accelerated to 3.0%. Eggs spiked 15.2%. Groceries up 2.7%.",
      sources: ["BLS", "Newsweek", "CNN"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "August 9, 2024"
    },
    {
      id: "epstein-files",
      title: "Release Epstein Files",
      quote: "I guess I would release the Epstein files",
      status: "MOSTLY BROKEN",
      promise: "Release the Epstein files",
      reality: "Resisted for months. Congress forced 427-1 vote. DOJ missed deadline. 5.2M pages unreviewed.",
      sources: ["NPR", "Axios", "CNBC"],
      category: "Transparency",
      progress: 30,
      statusColor: "#ff6600",
      date: "June 2024"
    },
    {
      id: "drill-baby-drill",
      title: "Drill Baby Drill",
      quote: "We are going to drill, baby, drill",
      status: "BROKEN",
      promise: "Unleash energy production",
      reality: "Active rigs DOWN 6%+. Low prices prevent drilling.",
      sources: ["NPR", "American Petroleum Institute"],
      category: "Energy",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024 campaign"
    },
    {
      id: "medicare-medicaid",
      title: "Protect Medicare/Medicaid",
      quote: "I will never do anything that will jeopardize Social Security or Medicare",
      status: "BROKEN",
      promise: "Protect Medicare and Medicaid - NO CUTS",
      reality: "Signed largest healthcare cut in history. 17 million losing coverage.",
      sources: ["CBS News", "Reuters"],
      category: "Healthcare",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024"
    }
  ];
}

// ==================== MAIN HANDLER ====================

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting update...');
    
    // Fetch news
    const news = await fetchAllNews();
    console.log(`Fetched ${news.length} news items`);
    
    // Get current data
    const currentData = await getCurrentData();
    console.log('Got current data from Supabase');

    // If no news, still update broken promises
    if (news.length === 0) {
      const updatedData = {
        ...currentData,
        brokenPromises: getBrokenPromises(),
        lastUpdated: new Date().toISOString(),
      };
      await updateSupabase(updatedData);
      return res.status(200).json({ success: true, message: 'Updated broken promises, no news found', updated: true });
    }

    // Build prompt for Gemini - EXTENDED to include polls
    const headlines = news.map(n => `- ${n.title} (${n.pubDate})`).join('\n');
    const existingIce = (currentData.iceVictims || []).map(v => 
      `${v.name} (${v.date}, ${v.location})`
    ).join('; ');
    const existingLawsuits = (currentData.lawsuits || []).map(l => l.title || l.id).join('; ');
    
    const prompt = `Analyze these news headlines for the Trump Accountability Tracker.

NEWS HEADLINES:
${headlines}

EXISTING ICE VICTIMS IN DATABASE: ${existingIce || 'None'}
EXISTING LAWSUITS IN DATABASE: ${existingLawsuits || 'None'}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "iceIncidents": [
    {
      "id": "firstname-lastname or date-location-unnamed",
      "name": "Full Name or 'Unnamed victim' if not yet identified",
      "age": 0,
      "citizenship": "US Citizen / Legal Resident / Undocumented / Unknown",
      "date": "Month Day, Year",
      "location": "City, State",
      "agency": "ICE / Border Patrol / CBP",
      "details": "What happened - be specific",
      "officialResponse": "Government's statement if any",
      "witnessAccount": "Witness statements if any",
      "sources": ["Source1", "Source2"]
    }
  ],
  "lawsuits": [
    {
      "id": "short-id",
      "title": "Case name or description",
      "plaintiff": "Who is suing",
      "defendant": "Who is being sued",
      "court": "Which court",
      "filed": "Date filed",
      "status": "Pending / Ruling / Dismissed / Appealed",
      "summary": "What the case is about",
      "ruling": "Court ruling if any",
      "amount": "Dollar amount if specified",
      "category": "against-admin / by-trump / against-trump-personal",
      "sources": ["Source1"]
    }
  ],
  "polls": {
    "overall": {
      "approve": 39,
      "disapprove": 56,
      "source": "Pollster name",
      "date": "Month Year"
    },
    "immigration": {
      "approve": 39,
      "disapprove": 53,
      "source": "Pollster name"
    },
    "economy": {
      "approve": null,
      "disapprove": null,
      "source": null
    },
    "netApproval": -12.9
  },
  "epsteinUpdates": {
    "newRevelations": [
      {
        "id": "short-id",
        "headline": "Brief headline",
        "details": "What was revealed",
        "involvedPerson": "Trump / Musk / Bannon / Maxwell / etc",
        "date": "Month Day, Year",
        "sources": ["Source1"]
      }
    ],
    "pagesReleased": null,
    "pagesWithheld": null,
    "newFlightInfo": null,
    "dojActions": null
  },
  "iceStatsUpdate": {
    "totalShootings": null,
    "shootingDeaths": null,
    "usCitizensKilled": null,
    "usCitizensShot": null
  },
  "updateReason": "Brief description of what was found"
}

CRITICAL RULES:
1. For ICE incidents: Include shootings/deaths by ICE, Border Patrol, or CBP agents
2. If a victim's name is unknown, use "Unnamed victim" but STILL include the incident with date/location
3. If you find a NAME for someone who was previously "Unnamed", include them so we can update the record
4. For lawsuits: Include cases against Trump personally, the Trump administration, federal agencies under Trump, AND cases filed BY Trump
5. For polls: Extract any approval rating numbers mentioned. Use null if not mentioned.
6. For Epstein: Track any NEW revelations about Trump, Musk, Bannon, or other Trump circle members. Track DOJ release actions.
7. Do NOT duplicate incidents/lawsuits already in the database
8. Set stats/polls to null if no specific numbers found
9. Return empty arrays [] if nothing new found - this is fine!`;

    // Call Gemini
    const geminiResponse = await callGemini(prompt);
    console.log('Gemini response received');
    
    // Parse response
    let parsed;
    try {
      const cleaned = geminiResponse.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Gemini response:', geminiResponse.substring(0, 500));
      const updatedData = {
        ...currentData,
        brokenPromises: getBrokenPromises(),
        lastUpdated: new Date().toISOString(),
        lastUpdateReason: 'Could not parse AI response, updated broken promises only',
      };
      await updateSupabase(updatedData);
      return res.status(200).json({ success: true, message: 'Parse error, updated broken promises', updated: true });
    }

    // Merge ICE incidents with VALIDATION
    const mergedIce = mergeIceIncidents(
      currentData.iceVictims || [],
      parsed.iceIncidents || []
    );

    // Merge lawsuits with VALIDATION
    const mergedLawsuits = mergeLawsuits(
      currentData.lawsuits || [],
      parsed.lawsuits || []
    );

    // Update stats if provided - VALIDATED
    const currentStats = currentData.iceStats || {};
    const newStats = validateIceStats(parsed.iceStatsUpdate) || {};
    const updatedStats = {
      ...currentStats,
      ...(newStats.totalShootings !== null ? { totalShootings: newStats.totalShootings } : {}),
      ...(newStats.shootingDeaths !== null ? { shootingDeaths: newStats.shootingDeaths } : {}),
      ...(newStats.usCitizensKilled !== null ? { usCitizensKilled: newStats.usCitizensKilled } : {}),
      ...(newStats.usCitizensShot !== null ? { usCitizensShot: newStats.usCitizensShot } : {}),
    };

    // Update polls if provided - VALIDATED
    const currentPolls = currentData.polls || {};
    const newPolls = validatePollData(parsed.polls);
    const updatedPolls = newPolls ? {
      ...currentPolls,
      ...(newPolls.overall?.approve !== null ? { overall: newPolls.overall } : {}),
      ...(newPolls.immigration?.approve !== null ? { immigration: newPolls.immigration } : {}),
      ...(newPolls.economy?.approve !== null ? { economy: newPolls.economy } : {}),
      ...(newPolls.netApproval !== null ? { netApproval: newPolls.netApproval } : {}),
      lastUpdated: new Date().toISOString(),
    } : currentPolls;

    // Update Epstein data if provided - VALIDATED
    const currentEpstein = currentData.epsteinFiles || { revelations: [] };
    const newEpstein = validateEpsteinUpdates(parsed.epsteinUpdates);
    let updatedEpstein = currentEpstein;
    
    if (newEpstein) {
      // Merge revelations (dedupe by headline)
      const existingHeadlines = new Set((currentEpstein.revelations || []).map(r => r.headline?.toLowerCase()));
      const trulyNewRevelations = (newEpstein.newRevelations || []).filter(r => 
        !existingHeadlines.has(r.headline?.toLowerCase())
      );
      
      updatedEpstein = {
        ...currentEpstein,
        revelations: [...(currentEpstein.revelations || []), ...trulyNewRevelations].slice(0, 100),
        ...(newEpstein.pagesReleased !== null ? { pagesReleased: newEpstein.pagesReleased } : {}),
        ...(newEpstein.pagesWithheld !== null ? { pagesWithheld: newEpstein.pagesWithheld } : {}),
        ...(newEpstein.newFlightInfo ? { latestFlightInfo: newEpstein.newFlightInfo } : {}),
        ...(newEpstein.dojActions ? { latestDojAction: newEpstein.dojActions } : {}),
        lastUpdated: new Date().toISOString(),
      };
    }

    // Build updated data
    const updatedData = {
      ...currentData,
      iceVictims: mergedIce,
      iceStats: updatedStats,
      lawsuits: mergedLawsuits,
      polls: updatedPolls,
      epsteinFiles: updatedEpstein,
      brokenPromises: getBrokenPromises(),
      lastUpdated: new Date().toISOString(),
      lastUpdateReason: sanitizeString(parsed.updateReason, 500) || 'Automated update',
    };

    // Save to Supabase
    const saved = await updateSupabase(updatedData);
    
    if (!saved) {
      throw new Error('Failed to save to Supabase');
    }

    // Log the update
    const newLawsuitsCount = mergedLawsuits.length - (currentData.lawsuits || []).length;
    const newEpsteinCount = (updatedEpstein.revelations || []).length - (currentEpstein.revelations || []).length;
    await logUpdate({
      success: true,
      news_count: news.length,
      new_incidents: mergedIce.length - (currentData.iceVictims || []).length,
      new_lawsuits: newLawsuitsCount,
      new_epstein_revelations: newEpsteinCount,
      polls_updated: !!newPolls,
      reason: sanitizeString(parsed.updateReason, 500) || 'Automated update',
    });

    console.log('Update complete!');
    return res.status(200).json({
      success: true,
      updated: true,
      newIncidents: mergedIce.length - (currentData.iceVictims || []).length,
      newLawsuits: newLawsuitsCount,
      newEpsteinRevelations: newEpsteinCount,
      pollsUpdated: !!newPolls,
      reason: parsed.updateReason,
    });

  } catch (error) {
    console.error('Update error:', error);
    
    await logUpdate({
      success: false,
      error: sanitizeString(error.message, 500),
    });
    
    return res.status(500).json({ success: false, error: error.message });
  }
}
