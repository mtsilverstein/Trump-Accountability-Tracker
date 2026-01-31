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
  
  // Constitutional violations & court defiance
  'Trump defies court order 2026',
  'Trump administration contempt court',
  'Trump unconstitutional ruling',
  'Trump executive order blocked',
  'federal judge rules Trump unconstitutional',
  'DOGE illegal firings ruling',
  'Trump emoluments violation',
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

/**
 * Validate a single constitutional violation
 */
function validateConstitutionalViolation(violation) {
  if (!violation || typeof violation !== 'object') return null;
  
  const title = sanitizeString(violation.title, 300);
  if (!title) return null;
  
  const validStatuses = ['RULED UNCONSTITUTIONAL', 'ONGOING', 'IN COURTS', 'CONTEMPT', 'DEFIED', 'BLOCKED', 'PENDING'];
  const status = validStatuses.includes(violation.status?.toUpperCase()) 
    ? violation.status.toUpperCase() 
    : 'ONGOING';
  
  return {
    id: sanitizeString(violation.id, 100) || `const-${Date.now()}`,
    amendment: sanitizeString(violation.amendment, 100),
    title,
    description: sanitizeString(violation.description, 2000),
    courtRuling: sanitizeString(violation.courtRuling, 500),
    status,
    statusColor: status === 'RULED UNCONSTITUTIONAL' ? '#ef4444' : 
                 status === 'CONTEMPT' ? '#ef4444' :
                 status === 'DEFIED' ? '#f59e0b' :
                 status === 'IN COURTS' ? '#3b82f6' : '#6b6b7b',
    date: sanitizeString(violation.date, 50),
    sources: Array.isArray(violation.sources)
      ? violation.sources.slice(0, 10).map(s => sanitizeString(s, 200)).filter(Boolean)
      : [],
  };
}

/**
 * Validate constitutional updates object
 */
function validateConstitutionalUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  
  const validViolations = Array.isArray(updates.newViolations)
    ? updates.newViolations.map(validateConstitutionalViolation).filter(Boolean)
    : [];
  
  return {
    newViolations: validViolations,
    courtDefianceCount: sanitizeNumber(updates.courtDefianceCount, 0, 10000),
    contemptProceedings: sanitizeString(updates.contemptProceedings, 1000),
    lastUpdated: new Date().toISOString(),
  };
}

// ==================== BREAKING NEWS VALIDATION ====================

const VALID_BREAKING_CATEGORIES = ['epstein', 'ice', 'lawsuit', 'constitutional', 'poll', 'promise'];

/**
 * Validate a single breaking news item
 */
function validateBreakingNewsItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (!item.headline || !item.category || !item.date) return null;
  
  // Validate category
  const category = item.category?.toLowerCase();
  if (!VALID_BREAKING_CATEGORIES.includes(category)) return null;
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(item.date)) return null;
  
  // Validate sources array
  const validSources = Array.isArray(item.sources) 
    ? item.sources.slice(0, 5).map(s => {
        if (typeof s === 'string') return { name: sanitizeString(s, 100), url: '' };
        if (typeof s === 'object' && s.name) {
          return {
            name: sanitizeString(s.name, 100),
            url: sanitizeString(s.url, 500),
          };
        }
        return null;
      }).filter(Boolean)
    : [];
  
  return {
    id: sanitizeString(item.id || `${category}-${Date.now()}`, 100),
    category: category,
    date: item.date,
    headline: sanitizeString(item.headline, 100),
    summary: sanitizeString(item.summary, 500),
    sources: validSources,
    isBreaking: Boolean(item.isBreaking),
    addedAt: new Date().toISOString(),
  };
}

/**
 * Merge breaking news - keeps most recent, dedupes by headline
 */
function mergeBreakingNews(existing, newItems) {
  const validExisting = (existing || []).map(validateBreakingNewsItem).filter(Boolean);
  const validNew = (newItems || []).map(validateBreakingNewsItem).filter(Boolean);
  
  // Dedupe by normalized headline
  const existingHeadlines = new Set(validExisting.map(n => normalizeForComparison(n.headline)));
  
  const trulyNew = validNew.filter(n => 
    !existingHeadlines.has(normalizeForComparison(n.headline))
  );
  
  if (trulyNew.length > 0) {
    console.log(`Adding ${trulyNew.length} new breaking news item(s)`);
  }
  
  // Combine and sort by date (newest first)
  const combined = [...validExisting, ...trulyNew]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Keep only most recent 20 items
  return combined.slice(0, 20);
}

/**
 * Get the most recent breaking news item for a category
 */
function getLatestBreakingNews(breakingNews, category = null) {
  if (!Array.isArray(breakingNews) || breakingNews.length === 0) return null;
  
  const sorted = [...breakingNews].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (category) {
    return sorted.find(n => n.category === category) || null;
  }
  
  return sorted[0];
}

// ==================== NEWS FETCHING ====================

/**
 * Normalize a string for comparison (removes punctuation, extra spaces, lowercase)
 * This helps dedupe items that are the same but phrased slightly differently
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

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
      const sameLocation = normalizeForComparison(ex.location) === normalizeForComparison(newInc.location);
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
      // Check for ID match or normalized name match (handles "John Doe" vs "John  Doe" etc)
      const exactMatch = result.findIndex(ex => 
        ex.id === newInc.id || 
        (ex.name && newInc.name && normalizeForComparison(ex.name) === normalizeForComparison(newInc.name))
      );
      
      if (exactMatch >= 0) {
        // Update existing with longer/newer info
        const ex = result[exactMatch];
        for (const field in newInc) {
          if (newInc[field] && (!ex[field] || String(newInc[field]).length > String(ex[field]).length)) {
            ex[field] = newInc[field];
          }
        }
        console.log(`Updated existing ICE incident: ${newInc.name}`);
      } else {
        // Truly new incident
        console.log(`Adding new ICE incident: ${newInc.name}`);
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
  // Use normalized titles for better dedupe across sources
  const existingTitles = new Set(validExisting.map(l => normalizeForComparison(l.title)));
  
  const trulyNew = validNew.filter(l => 
    !existingIds.has(l.id) && !existingTitles.has(normalizeForComparison(l.title))
  );
  
  if (trulyNew.length > 0) {
    console.log(`Adding ${trulyNew.length} new lawsuit(s)`);
  }
  
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
      reality: "Grocery prices UP 3% year-over-year, reaching record highs in 2025. Coffee up 20%, ground beef up 15.5%. Trump falsely claims prices are 'WAY DOWN'.",
      sources: ["CNN", "BLS", "ABC News", "FactCheck.org"],
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
      quote: "I will cut your energy and electricity prices in half, 50% — 5-0 — within 12 months",
      status: "BROKEN",
      promise: "Cut energy bills in HALF within 12 months",
      reality: "Gasoline down ~20% (not 50%) due to global oil prices, not policy. Electricity UP 9%. Average family paid $124 MORE for utilities.",
      sources: ["NPR", "CNN", "BLS", "EIA"],
      category: "Economy",
      progress: 20,
      statusColor: "#ff3333",
      date: "August 14, 2024"
    },
    {
      id: "ukraine-24h",
      title: "End Ukraine War 24h",
      quote: "I'll get that done within 24 hours. Everyone says, 'Oh, no, you can't.' Absolutely I can.",
      status: "BROKEN",
      promise: "End Ukraine war within 24 HOURS",
      reality: "War continues 370+ days later. Trump now says it was 'in jest' and 'an exaggeration.' Extended deadline to 100 days, then 6 months, now indefinite.",
      sources: ["CNN (53 instances documented)", "Time Magazine", "PolitiFact"],
      category: "Foreign Policy",
      progress: 0,
      statusColor: "#ff3333",
      date: "July 2023 - November 2024"
    },
    {
      id: "gaza-peace",
      title: "End Gaza War",
      quote: "I will get it ended. That has to be ended.",
      status: "BROKEN",
      promise: "End the war in Gaza and bring peace to Middle East",
      reality: "War continues. No ceasefire achieved. U.S. continues military aid to Israel totaling $21.7B+ since Oct 2023.",
      sources: ["Time Magazine", "Brown University", "Quincy Institute"],
      category: "Foreign Policy",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024 campaign"
    },
    {
      id: "day-one-inflation",
      title: "End Inflation Day One",
      quote: "Starting on day one, we will end inflation and make America affordable again",
      status: "BROKEN",
      promise: "End inflation on DAY ONE",
      reality: "CPI accelerated to 3.0% after taking office (up from 2.9%). Inflation surged largely due to tariffs. Goldman Sachs: consumers bearing 50%+ of tariff costs.",
      sources: ["BLS", "Newsweek", "CNN", "Goldman Sachs"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "August 9, 2024"
    },
    {
      id: "doge-2-trillion",
      title: "DOGE $2 Trillion Cuts",
      quote: "We're going to cut federal spending by at least $2 trillion.",
      status: "BROKEN",
      promise: "Cut $2 trillion in federal spending via DOGE",
      reality: "Government spending INCREASED 6% in 2025. Promise reduced to $1T, then $150B. CATO Institute: 'DOGE did not reduce spending.' National debt grew $2.2T.",
      sources: ["CATO Institute", "Brookings", "NY Times", "CBO"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "October 2024"
    },
    {
      id: "ivf-free",
      title: "Free IVF",
      quote: "We are going to be paying for that treatment. We're going to be mandating that the insurance company pay.",
      status: "BROKEN",
      promise: "Make IVF free for all Americans",
      reality: "Administration abandoned mandate. Only offered voluntary employer guidance and one drug discount. Sen. Warren: 'Trump lied.' White House admitted can't legally mandate coverage.",
      sources: ["Washington Post", "CNN", "The Hill", "Slate"],
      category: "Healthcare",
      progress: 10,
      statusColor: "#ff3333",
      date: "August 2024"
    },
    {
      id: "epstein-files",
      title: "Release Epstein Files",
      quote: "I guess I would release the Epstein files",
      status: "MOSTLY BROKEN",
      promise: "Release the Epstein files",
      reality: "Resisted for months. Congress forced 427-1 vote. DOJ missed Dec 19 deadline. 2.5M pages still withheld. Trump's lawyer Todd Blanche overseeing release - conflict of interest.",
      sources: ["NPR", "Axios", "CNBC", "ABC News"],
      category: "Transparency",
      progress: 40,
      statusColor: "#ff6600",
      date: "June 2024"
    },
    {
      id: "drill-baby-drill",
      title: "Drill Baby Drill",
      quote: "We're going to drill, baby, drill",
      status: "BROKEN",
      promise: "Unleash energy production",
      reality: "Active drilling rigs DOWN 6%+ year-over-year. Oil prices too low (~$50s) to justify new drilling. His own pressure for low prices is preventing drilling.",
      sources: ["NPR", "American Petroleum Institute"],
      category: "Energy",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024 campaign"
    },
    {
      id: "medicare-medicaid",
      title: "Protect Medicare/Medicaid",
      quote: "I will never do anything that will jeopardize or hurt Social Security or Medicare",
      status: "BROKEN",
      promise: "Protect Medicare and Medicaid - NO CUTS",
      reality: "Signed largest healthcare cut in history. 17 million Americans projected to lose healthcare. Let ACA credits expire - premiums spiked 50%+. Treasury Sec admitted bill is 'backdoor for privatizing Social Security'.",
      sources: ["CBS News", "Reuters", "CBO"],
      category: "Healthcare",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024"
    },
    {
      id: "reduce-debt",
      title: "Reduce National Debt",
      quote: "I'm going to reduce the debt. I'm going to get rid of it.",
      status: "BROKEN",
      promise: "Reduce or eliminate the national debt",
      reality: "Debt increased $2.2T since inauguration. One Big Beautiful Bill adds $3.4T over decade according to CBO. FY2025 deficit was $1.8T - fourth highest ever.",
      sources: ["CBO", "Treasury Dept", "FactCheck.org"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024 campaign"
    },
    {
      id: "deport-criminals",
      title: "Deport 'Worst of Worst'",
      quote: "We're going to focus on the worst of the worst. Criminals and gang members.",
      status: "BROKEN",
      promise: "Focus deportations on criminals and gang members",
      reality: "Majority of ICE detainees have no criminal convictions per CATO Institute data. U.S. citizens detained and deported. Two citizens shot by federal agents during immigration protests.",
      sources: ["CATO Institute", "NPR", "ACLU"],
      category: "Immigration",
      progress: 30,
      statusColor: "#ff3333",
      date: "2024 campaign"
    },
    {
      id: "project-2025",
      title: "No Project 2025",
      quote: "I know nothing about Project 2025. I have nothing to do with them.",
      status: "BROKEN",
      promise: "Has nothing to do with Project 2025",
      reality: "By one count, has implemented about half of Project 2025's proposals. Paul Dans (P2025 director): 'Every day Trump rolls out another Project 2025 item, it's an endorsement of our work.'",
      sources: ["NPR", "Heritage Foundation", "AG Rob Bonta"],
      category: "Transparency",
      progress: 0,
      statusColor: "#ff3333",
      date: "July 2024"
    },
    {
      id: "drain-swamp",
      title: "Drain the Swamp",
      quote: "We're going to drain the swamp and take on corruption.",
      status: "BROKEN",
      promise: "End corruption in Washington",
      reality: "Making billions from crypto schemes ($427M+ in fees), foreign government deals, and 'money talks' approach to pardons. Family and companies profiting while in office.",
      sources: ["CREW", "Financial Times", "The Hill"],
      category: "Ethics",
      progress: 0,
      statusColor: "#ff3333",
      date: "2024 campaign"
    },
    {
      id: "tariff-revenue",
      title: "Tariffs Replace Income Tax",
      quote: "The tariffs will be enough to cut all of the income tax.",
      status: "BROKEN",
      promise: "Tariff revenue will eliminate income taxes",
      reality: "Collected ~$289B in tariff revenue in 2025 - far short of $2.5T income tax revenue. Most tariff costs passed to American consumers. Claimed 'TRILLIONS' collected - actual amount is less than $300B.",
      sources: ["Treasury Dept", "Washington Post", "Tax Foundation"],
      category: "Economy",
      progress: 0,
      statusColor: "#ff3333",
      date: "April 2025"
    },
    {
      id: "refugee-genocide",
      title: "White Genocide Claim",
      quote: "There's a genocide that's taking place against white farmers in South Africa.",
      status: "FALSE CLAIM",
      promise: "Afrikaners facing genocide",
      reality: "Distorts facts. Only admitted 1,059 South African refugees while cutting total refugees 98% (70,033 to 1,226). Used false claim to justify discriminatory refugee policy.",
      sources: ["FactCheck.org", "State Dept data"],
      category: "Immigration",
      progress: 0,
      statusColor: "#ff3333",
      date: "February 2025"
    }
  ];
}

function getConstitutionalConcerns() {
  return [
    {
      id: "defying-courts",
      title: "Defying 1 in 3 Federal Court Orders",
      amendment: "Article III - Separation of Powers",
      status: "ONGOING",
      description: "Washington Post analysis found administration defied, delayed, or manipulated rulings in 57 of 165 lawsuits (1/3)—unprecedented for any presidency.",
      examples: [
        "Continued deportation flights after TRO issued",
        "Chief Judge Boasberg: 'willful disregard' of court order",
        "57 of 165 lawsuits show defiance, delay, or manipulation",
        "Kilmar Abrego García: Defied Supreme Court return order",
        "Judge Xinis: 'no tolerance for gamesmanship'"
      ],
      quote: "The Constitution does not tolerate willful disobedience of judicial orders—especially by officials of a coordinate branch who have sworn an oath to uphold it.",
      quoteSource: "Chief Judge James Boasberg",
      sources: ["Washington Post", "AP News", "Just Security", "Brennan Center"],
      statusColor: "#ef4444",
      dateAdded: "2025-07-01"
    },
    {
      id: "due-process",
      title: "Deportations Without Due Process",
      amendment: "5th & 14th Amendments",
      status: "ONGOING - 700+ RULINGS",
      description: "225+ judges have ruled in 700+ cases that mandatory detention policy likely violates law and due process. U.S. citizens detained without hearings.",
      examples: [
        "225+ judges ruled mandatory detention violates due process",
        "700+ cases found policy likely violates law",
        "Kilmar Abrego García: deported to foreign prison without hearing despite legal status",
        "F-1 visa students: 100+ lawsuits over revocations",
        "Citizens detained without ability to prove citizenship"
      ],
      quote: "No person shall be deprived of life, liberty, or property, without due process of law.",
      quoteSource: "Fifth Amendment",
      sources: ["ACLU", "Politico", "Just Security", "Federal Court Records"],
      statusColor: "#f59e0b",
      dateAdded: "2025-03-01"
    },
    {
      id: "birthright-citizenship",
      title: "Birthright Citizenship Executive Order",
      amendment: "14th Amendment - Citizenship Clause",
      status: "IN COURTS - SCOTUS 2026",
      description: "EO 14160 attempts to deny citizenship to U.S.-born children—contradicting 14th Amendment text and 127 years of Supreme Court precedent.",
      examples: [
        "Blocked by multiple federal courts",
        "Supreme Court hearing expected Feb-Apr 2026",
        "Contradicts U.S. v. Wong Kim Ark (1898) precedent",
        "6-3 Supreme Court limited injunctions to plaintiffs only",
        "ACLU, LULAC, states filed immediate lawsuits"
      ],
      quote: "All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States.",
      quoteSource: "14th Amendment",
      sources: ["Ballotpedia", "SCOTUSblog", "Rutgers Law School"],
      statusColor: "#3b82f6",
      dateAdded: "2025-01-20"
    },
    {
      id: "emoluments",
      title: "Foreign Emoluments Without Congressional Consent",
      amendment: "Article I, Section 9 - Emoluments Clause",
      status: "NO CONGRESSIONAL CONSENT",
      description: "Trump Organization revised ethics policy in 2025 to explicitly allow foreign transactions. Foreign governments spending millions without congressional consent.",
      examples: [
        "$7.8M from 20+ foreign governments documented (first term)",
        "Qatar plane deal: Senate resolution calls it 'illegal emolument'",
        "Vietnam: $1.5B golf complex fast-tracked during tariff negotiations",
        "Serbia: Half-billion-dollar Trump Hotel cleared after election",
        "Secret Service pays Trump's own resorts"
      ],
      quote: "No Person holding any Office shall, without the Consent of the Congress, accept of any present, Emolument, Office, or Title, of any kind whatever, from any King, Prince, or foreign State.",
      quoteSource: "Foreign Emoluments Clause",
      sources: ["CREW", "House Oversight", "AEI", "Brennan Center"],
      statusColor: "#22c55e",
      dateAdded: "2025-02-01"
    },
    {
      id: "first-amendment",
      title: "Attacks on Press & Protesters",
      amendment: "1st Amendment",
      status: "MULTIPLE LAWSUITS",
      description: "Two U.S. citizens shot by federal agents at immigration protests. Multiple lawsuits from AP, NPR, PBS over press access bans. Calls to revoke licenses.",
      examples: [
        "Two U.S. citizens killed by federal agents at Minneapolis protests",
        "AP sued over Oval Office/Air Force One bans for using 'Gulf of Mexico'",
        "NPR, PBS sued over funding threats",
        "Threats to revoke broadcast licenses of critical networks",
        "Journalists face access revocation for critical coverage"
      ],
      quote: "Congress shall make no law abridging the freedom of speech, or of the press, or the right of the people peaceably to assemble.",
      quoteSource: "First Amendment",
      sources: ["Committee to Protect Journalists", "PEN America", "NPR", "AP News"],
      statusColor: "#8b5cf6",
      dateAdded: "2025-01-26"
    },
    {
      id: "doge-unconstitutional",
      title: "DOGE Mass Firings Without Authorization",
      amendment: "Article I - Separation of Powers",
      status: "RULED ILLEGAL - SCOTUS ALLOWED",
      description: "Judge ruled OPM illegally directed mass firings of 25,000+ probationary employees. 317,000 federal jobs lost in 2025. Agencies closed without congressional authorization.",
      examples: [
        "317,000 federal workforce reduction in 2025 (Bloomberg)",
        "Judge Alsup: OPM firings were unlawful",
        "USAID, Education Dept, HHS gutted without congressional approval",
        "Supreme Court stayed reinstatement orders, allowing cuts",
        "Judge: 'OPM has no authority to fire employees within another agency'"
      ],
      quote: "OPM does not have any authority whatsoever under any statute in the history of the universe to hire and fire employees within another agency.",
      quoteSource: "Federal Judge William Alsup",
      sources: ["NPR", "Government Executive", "Bloomberg", "Protect Democracy"],
      statusColor: "#ef4444",
      dateAdded: "2025-09-15"
    },
    {
      id: "jan6-pardons",
      title: "January 6th Mass Pardons",
      amendment: "Rule of Law",
      status: "COMPLETED - DAY ONE",
      description: "Pardoned 1,500+ individuals convicted of Capitol attack crimes on first day, including seditious conspiracy convicts and those who assaulted 140+ police officers.",
      examples: [
        "Day 1 pardons for violent offenders",
        "Oath Keepers & Proud Boys leaders: sentences commuted",
        "Pardoned those who brutally assaulted police",
        "140+ officers injured in attack",
        "DC Police Union condemned pardons"
      ],
      quote: "Using pardon power for those who attacked Congress during certification raises unprecedented rule-of-law concerns.",
      quoteSource: "Legal scholars",
      sources: ["DOJ Records", "NPR", "AP News", "Federal Court Records"],
      statusColor: "#ef4444",
      dateAdded: "2025-01-20"
    },
    {
      id: "equal-protection",
      title: "Political Discrimination in Federal Grants",
      amendment: "14th Amendment - Equal Protection",
      status: "RULED UNCONSTITUTIONAL",
      description: "Court ruled DOE cancelled clean energy grants based on whether recipients lived in states that voted for Trump—'purposeful segregation based on electoral support.'",
      examples: [
        "Jan 12, 2026: DC District Court rules unconstitutional",
        "'No explanation for how segregation advances government interest'",
        "Grants cancelled in non-Trump states; approved in Trump states",
        "Millions in clean energy projects cancelled",
        "Environmental Defense Fund lawsuit successful"
      ],
      quote: "Defendants freely admit that they made grant-termination decisions primarily — if not exclusively — based on whether the awardee resided in a state whose citizens voted for President Trump in 2024.",
      quoteSource: "U.S. District Court, D.C. (Jan 12, 2026)",
      sources: ["EDF", "Federal Court Decision", "D.C. District Court"],
      statusColor: "#ef4444",
      dateAdded: "2026-01-12"
    },
    {
      id: "inspector-general",
      title: "Illegal Firing of Inspectors General",
      amendment: "Congressional Oversight",
      status: "RULED UNLAWFUL",
      description: "Fired 17 Inspectors General without required 30-day congressional notice. Judge ruled firings unlawful but refused reinstatement.",
      examples: [
        "Sept 24, 2025: Judge Reyes ruled firings unlawful",
        "Required 30-day notice to Congress was not provided",
        "IGs provide independent oversight of executive agencies",
        "Court noted Trump would 'simply re-fire them' after notice"
      ],
      quote: "The administration's approach has created a dangerous precedent that legal scholars warn could push the nation into constitutional crisis.",
      quoteSource: "NationofChange analysis",
      sources: ["Federal Court Records", "Government Executive", "NPR"],
      statusColor: "#f59e0b",
      dateAdded: "2025-09-24"
    },
    {
      id: "congressional-spending",
      title: "Usurping Congressional Spending Powers",
      amendment: "Article I - Power of the Purse",
      status: "ONGOING",
      description: "Impounding congressionally appropriated funds, shuttering agencies established by Congress, cancelling programs without authorization.",
      examples: [
        "USAID effectively dismantled without Congress",
        "Froze federal grants and loans",
        "Cancelled contracts Congress approved",
        "Attempted to close CFPB, Education Dept",
        "Senate HSGAC report details seizure of congressional powers"
      ],
      quote: "A President may not initiate large-scale executive branch reorganization without partnering with Congress.",
      quoteSource: "Federal Judge Susan Illston",
      sources: ["Senate HSGAC Report", "GAO", "CBO", "Protect Democracy"],
      statusColor: "#f97316",
      dateAdded: "2025-02-15"
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

    // If no news, still update broken promises and constitutional concerns
    if (news.length === 0) {
      const updatedData = {
        ...currentData,
        brokenPromises: getBrokenPromises(),
        constitutionalConcerns: getConstitutionalConcerns(),
        lastUpdated: new Date().toISOString(),
      };
      await updateSupabase(updatedData);
      return res.status(200).json({ success: true, message: 'Updated promises and constitution, no news found', updated: true });
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
  "constitutionalUpdates": {
    "newViolations": [
      {
        "id": "short-id",
        "amendment": "e.g. '5TH AMENDMENT' or 'ARTICLE I' or 'SEPARATION OF POWERS'",
        "title": "Brief title of violation",
        "description": "What happened",
        "courtRuling": "Judge name and ruling if any",
        "status": "RULED UNCONSTITUTIONAL / ONGOING / IN COURTS / CONTEMPT",
        "date": "Month Day, Year",
        "sources": ["Source1"]
      }
    ],
    "courtDefianceCount": null,
    "contemptProceedings": null
  },
  "breakingNews": [
    {
      "id": "category-brief-desc-date",
      "category": "epstein / ice / lawsuit / constitutional / poll",
      "date": "YYYY-MM-DD",
      "headline": "Short headline (max 80 chars)",
      "summary": "2-3 sentence summary of what happened",
      "sources": [
        { "name": "Source Name", "url": "https://..." }
      ],
      "isBreaking": true
    }
  ],
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
7. For Constitutional: Track court rulings that find executive actions unconstitutional, contempt proceedings, and administration defiance of court orders
8. For Breaking News: Flag major developments from today or yesterday as breaking. Categories: epstein (file releases, revelations), ice (shootings, deaths, raids), lawsuit (major rulings, new filings), constitutional (court orders defied, rulings), poll (significant shifts)
8. Do NOT duplicate incidents/lawsuits already in the database
9. Set stats/polls to null if no specific numbers found
10. Return empty arrays [] if nothing new found - this is fine!`;

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
        constitutionalConcerns: getConstitutionalConcerns(),
        lastUpdated: new Date().toISOString(),
        lastUpdateReason: 'Could not parse AI response, updated promises and constitution only',
      };
      await updateSupabase(updatedData);
      return res.status(200).json({ success: true, message: 'Parse error, updated promises', updated: true });
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
      // Merge revelations (robust dedupe by normalized headline)
      const existingHeadlines = new Set((currentEpstein.revelations || []).map(r => normalizeForComparison(r.headline)));
      const trulyNewRevelations = (newEpstein.newRevelations || []).filter(r => 
        !existingHeadlines.has(normalizeForComparison(r.headline))
      );
      
      if (trulyNewRevelations.length > 0) {
        console.log(`Adding ${trulyNewRevelations.length} new Epstein revelation(s)`);
      }
      
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

    // Update Constitutional data if provided - VALIDATED
    const baseConstitutional = getConstitutionalConcerns();
    const newConstitutional = validateConstitutionalUpdates(parsed.constitutionalUpdates);
    let mergedConstitutional = baseConstitutional;
    
    if (newConstitutional && newConstitutional.newViolations?.length > 0) {
      // Merge new violations with baseline (robust dedupe by normalized title)
      const existingTitles = new Set(baseConstitutional.map(c => normalizeForComparison(c.title)));
      const trulyNewViolations = newConstitutional.newViolations.filter(v => 
        !existingTitles.has(normalizeForComparison(v.title))
      );
      
      // Add new violations to the constitutional concerns array
      if (trulyNewViolations.length > 0) {
        mergedConstitutional = [...baseConstitutional, ...trulyNewViolations].slice(0, 50);
        console.log(`Added ${trulyNewViolations.length} new constitutional concerns`);
      }
    }

    // Update Breaking News - VALIDATED
    const currentBreakingNews = currentData.breakingNews || [];
    const newBreakingNews = Array.isArray(parsed.breakingNews) ? parsed.breakingNews : [];
    const mergedBreakingNews = mergeBreakingNews(currentBreakingNews, newBreakingNews);

    // Build updated data
    const updatedData = {
      ...currentData,
      iceVictims: mergedIce,
      iceStats: updatedStats,
      lawsuits: mergedLawsuits,
      polls: updatedPolls,
      epsteinFiles: updatedEpstein,
      brokenPromises: getBrokenPromises(),
      constitutionalConcerns: mergedConstitutional,
      breakingNews: mergedBreakingNews,
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
    const newConstitutionalCount = mergedConstitutional.length - baseConstitutional.length;
    const newBreakingCount = mergedBreakingNews.length - currentBreakingNews.length;
    await logUpdate({
      success: true,
      news_count: news.length,
      new_incidents: mergedIce.length - (currentData.iceVictims || []).length,
      new_lawsuits: newLawsuitsCount,
      new_epstein_revelations: newEpsteinCount,
      new_constitutional: newConstitutionalCount,
      new_breaking_news: newBreakingCount,
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
      newBreakingNews: newBreakingCount,
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
