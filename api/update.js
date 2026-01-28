/**
 * Vercel API: Auto-update tracker with real news fetching
 * 
 * 1. Fetches recent news from Google News RSS (free)
 * 2. Sends headlines to Gemini for analysis
 * 3. Updates Supabase if new data found
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0:generateContent?key=${GEMINI_API_KEY}`;

// News search queries
const SEARCH_QUERIES = [
  'Trump broken promise fact check',
  'Trump tariff manufacturing jobs',
  'Trump grocery prices',
  'ICE shooting death',
  'Border Patrol shooting',
  'Trump golf cost taxpayer',
  'Trump net worth',
  'Trump self dealing',
  'Trump corruption',
  'Trump court order defied',
  'Trump deportation due process',
  'Trump constitutional violation',
];

// ----------------------
// NEWS FETCHING
// ----------------------
async function fetchNewsRSS(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url);
    const text = await response.text();
    
    const items = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    for (const item of itemMatches.slice(0, 3)) {
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') || '';
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      
      if (title && link) {
        items.push({ title, link, pubDate, query });
      }
    }
    
    return items;
  } catch (err) {
    console.error(`Error fetching news for "${query}":`, err);
    return [];
  }
}

async function fetchAllNews() {
  const allNews = [];
  for (const query of SEARCH_QUERIES) {
    const news = await fetchNewsRSS(query);
    allNews.push(...news);
  }
  
  const seen = new Set();
  return allNews.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

// ----------------------
// GEMINI CALL
// ----------------------
async function callGemini(prompt, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      console.warn(`Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
}

// ----------------------
// SUPABASE INTERACTION
// ----------------------
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
  if (!response.ok) throw new Error('Failed to fetch current data');
  const result = await response.json();
  return result[0]?.data || {};
}

async function updateData(newData) {
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
      body: JSON.stringify({
        data: newData,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  if (!response.ok) throw new Error(`Failed to update: ${await response.text()}`);
  return true;
}

// ----------------------
// ANALYZE & UPDATE
// ----------------------
async function analyzeAndUpdate() {
  // ----------------------
  // Helper functions
  // ----------------------
  const normalizeStr = str => (str || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const parseDate = dateStr => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    const parts = dateStr.match(/(\d{4})/);
    return parts ? `${parts[1]}-01-01` : null;
  };
  const incidentExists = (newInc, existing) => {
    const newName = normalizeStr(newInc.name);
    const newLoc = normalizeStr(newInc.location);
    const newDate = parseDate(newInc.date);

    return existing.some(v => {
      const existingName = normalizeStr(v.name);
      const existingLoc = normalizeStr(v.location);
      const existingDate = parseDate(v.date);
      if (newName && existingName && newName === existingName) return true;
      if (newDate && existingDate && newDate === existingDate && newLoc && existingLoc === newLoc) return true;
      return false;
    });
  };
  const isOrdinalDuplicate = (headline, existingIncidents) => {
    if (!headline) return false;
    const ordinals = ['second', 'third', 'fourth', 'another', 'additional', 'new'];
    const lower = headline.toLowerCase();
    const mentionsOrdinal = ordinals.some(o => lower.includes(o));
    if (!mentionsOrdinal) return false;
    return existingIncidents.some(v => {
      const loc = normalizeStr(v.location);
      return loc && lower.includes(loc.split(' ')[0]);
    });
  };

  // ----------------------
  // Fetch news
  // ----------------------
  console.log('Fetching news...');
  const news = await fetchAllNews();
  console.log(`Found ${news.length} news items`);
  if (news.length === 0) return { updated: false, reason: 'No news found' };

  const currentData = await getCurrentData();
  const newsText = news.map(n => `- ${n.title} (${n.pubDate})`).join('\n');

  // ----------------------
  // Gemini prompt
  // ----------------------
  const prompt = `You are analyzing recent news headlines to update a Trump accountability tracker.
RECENT NEWS HEADLINES:
${newsText}
CURRENT TRACKER DATA:
- Broken promises tracked: ${currentData.brokenPromises?.length || 0}
- ICE victims: ${currentData.iceVictims?.map(v => v.name).join(', ') || 'None'}
- Golf trips: ${(currentData.golf?.marALagoTrips || 0) + (currentData.golf?.bedminsterTrips || 0) + (currentData.golf?.scotlandTrips || 0)} total
TASK:
1. For each potential new ICE/CBP incident:
   - Extract full name if available.
   - Extract date of incident.
   - Extract location (city, state).
   - Extract agency involved.
   - Determine if this is a **new incident** or a reference to a previously reported incident (cross-check using current tracker data). 
     - If name is not available, consider it new **only if the date and location do not match existing entries**.
     - If headline uses ordinal words like "second", "third", or "another" but refers to a known person or same date/location, treat it as existing.
2. Extract any new evidence of broken promises, self-dealing, golf trips, or wealth updates as before.
3. Return ONLY valid JSON with this structure:
{
  "hasUpdates": true/false,
  "updates": {
    "newIceIncident": { "name": "", "date": "", "location": "", "details": "", "agency": "", "isNew": true/false } or null,
    "brokenPromiseEvidence": { "promiseId": "...", "newFact": "..." } or null,
    "newGolfTrips": number or null,
    "wealthUpdate": { "amount": number, "source": "Forbes/Bloomberg" } or null
  },
  "reasoning": "Explain what was found and why it matters",
  "headlineSource": "The specific headline this came from"
}
IMPORTANT: Only report incidents that are clearly **new**. Do not invent data. Return JSON only, no markdown.`;

  console.log('Calling Gemini...');
  const response = await callGemini(prompt);

  let result;
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    result = JSON.parse(cleaned);
  } catch (e) {
    console.error('Parse error:', response);
    return { updated: false, error: 'Parse error', raw: response.substring(0, 500) };
  }

  // ----------------------
  // Process updates
  // ----------------------
  if (result.hasUpdates && result.updates) {
    let madeChanges = false;

    // ICE incident
    if (result.updates.newIceIncident) {
      const ni = result.updates.newIceIncident;
      const exists = incidentExists(ni, currentData.iceVictims || []);
      if (!exists && !isOrdinalDuplicate(ni.details || ni.name, currentData.iceVictims || [])) {
        currentData.iceVictims = [...(currentData.iceVictims || []), {
          id: ni.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `incident-${Date.now()}`,
          name: ni.name || 'Unknown',
          date: ni.date || 'Unknown',
          location: ni.location || 'Unknown',
          details: ni.details || '',
          agency: ni.agency || 'ICE/CBP',
          citizenship: 'Unknown - needs verification',
          sources: ['News reports - needs verification'],
          officialResponse: 'Pending',
          witnessAccount: 'Pending',
        }];
        madeChanges = true;
      }
    }

    // brokenPromiseEvidence
    if (result.updates.brokenPromiseEvidence?.promiseId) {
      const bp = result.updates.brokenPromiseEvidence;
      const promise = currentData.brokenPromises?.find(p => p.id === bp.promiseId);
      if (promise && bp.newFact && !promise.reality.includes(bp.newFact)) {
        promise.reality.push(bp.newFact);
        madeChanges = true;
      }
    }

    // Golf trips
    if (result.updates.newGolfTrips && typeof result.updates.newGolfTrips === 'number') {
      const current = (currentData.golf?.marALagoTrips || 0);
      const newTrips = parseInt(result.updates.newGolfTrips);
      if (newTrips > current && newTrips <= 200) {
        currentData.golf = currentData.golf || {};
        currentData.golf.marALagoTrips = newTrips;
        madeChanges = true;
      }
    }

    // Wealth update
    if (result.updates.wealthUpdate?.amount) {
      const amount = parseFloat(result.updates.wealthUpdate.amount);
      if (amount >= 0.5 && amount <= 500) {
        currentData.wealth = currentData.wealth || {};
        currentData.wealth.current = amount;
        currentData.wealth.source = result.updates.wealthUpdate.source || 'Forbes';
        madeChanges = true;
      }
    }

    if (madeChanges) {
      currentData.lastUpdated = new Date().toISOString();
      currentData.lastUpdateReason = result.reasoning;
      currentData.lastUpdateSource = result.headlineSource;
      await updateData(currentData);

      return {
        updated: true,
        changes: result.updates,
        reasoning: result.reasoning,
        newsChecked: news.length,
      };
    }
  }

  return {
    updated: false,
    reasoning: result.reasoning || 'No actionable updates',
    newsChecked: news.length,
  };
}

// ----------------------
// API HANDLER
// ----------------------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'];
  if (CRON_SECRET && apiKey !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    const result = await analyzeAndUpdate();
    return res.status(200).json({ success: true, timestamp: new Date().toISOString(), ...result });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
