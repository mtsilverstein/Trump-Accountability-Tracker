/**
 * Vercel API: Auto-update tracker with real news fetching
 * Hardened against Gemini formatting issues
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

// ----------------------
// Utilities
// ----------------------
function extractJson(text) {
  if (!text) throw new Error('Empty Gemini response');

  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found');

  return JSON.parse(match[0]);
}

// ----------------------
// Deduplication helpers
// ----------------------
function dedupeIceVictims(iceVictims) {
  const map = new Map();
  for (const victim of iceVictims) {
    const key = [victim.date, victim.location, victim.agency].join('|');
    if (!map.has(key)) {
      map.set(key, victim);
    } else {
      const existing = map.get(key);
      if (JSON.stringify(victim).length > JSON.stringify(existing).length) {
        map.set(key, victim);
      }
    }
  }
  return Array.from(map.values());
}

function dedupeLawsuits(lawsuits) {
  const map = new Map();
  for (const suit of lawsuits) {
    const key = [suit.plaintiff, suit.defendant, suit.caseNumber || suit.title].join('|');
    if (!map.has(key)) map.set(key, suit);
  }
  return Array.from(map.values());
}

// ----------------------
// NEWS FETCHING
// ----------------------
const SEARCH_QUERIES = [
  'Trump broken promise fact check',
  'Trump tariff manufacturing jobs',
  'Trump grocery prices',
  'ICE shooting death',
  'Border Patrol shooting',
  'Trump golf cost taxpayer',
  'Trump net worth',
  'Trump self dealing',
  'Trump court order defied',
  'Trump deportation due process',
  'Trump constitutional violation',
];

async function fetchNewsRSS(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url);
    const text = await response.text();

    const items = [];
    const matches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const item of matches.slice(0, 3)) {
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];

      if (title && link) items.push({ title, link, pubDate, query });
    }

    return items;
  } catch {
    return [];
  }
}

async function fetchAllNews() {
  const all = [];
  for (const q of SEARCH_QUERIES) all.push(...await fetchNewsRSS(q));

  const seen = new Set();
  return all.filter(n => {
    if (seen.has(n.title)) return false;
    seen.add(n.title);
    return true;
  });
}

// ----------------------
// GEMINI CALL
// ----------------------
async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ----------------------
// SUPABASE
// ----------------------
async function getCurrentData() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tracker_data?id=eq.main&select=data`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const json = await res.json();
  return json[0]?.data || {};
}

async function updateData(data) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tracker_data?id=eq.main`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!res.ok) throw new Error(await res.text());
}

// ----------------------
// ANALYZE & UPDATE
// ----------------------
async function analyzeAndUpdate() {
  const news = await fetchAllNews();
  if (!news.length) return { updated: false, reason: 'No news' };

  const currentData = await getCurrentData();
  const headlines = news.map(n => `- ${n.title}`).join('\n');

  const prompt = `
Analyze the following news headlines and determine whether they introduce NEW, VERIFIED updates.

HEADLINES:
${headlines}

Return ONLY valid JSON.
No markdown. No commentary. No code fences.
Start with { and end with }.

Schema:
{
  "hasUpdates": true/false,
  "updates": {
    "newIceIncident": {...} | null,
    "brokenPromises": [{...}] | null,
    "lawsuits": [{...}] | null,
    "newGolfTrips": number | null,
    "wealthUpdate": {...} | null
  },
  "reasoning": "string",
  "headlineSource": "string"
}
`;

  const raw = await callGemini(prompt);

  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (err) {
    console.error('Gemini parse failure:', raw);
    return { updated: false, error: 'Parse error', raw: raw.slice(0, 2000) };
  }

  if (!parsed.hasUpdates) return { updated: false, reasoning: parsed.reasoning };

  let changed = false;

  // ----------------------
  // ICE incidents
  // ----------------------
  if (parsed.updates?.newIceIncident) {
    currentData.iceVictims = dedupeIceVictims([...(currentData.iceVictims || []), { id: `incident-${Date.now()}`, ...parsed.updates.newIceIncident }]);
    changed = true;
  }

  // ----------------------
  // Broken promises
  // ----------------------
  if (parsed.updates?.brokenPromises) {
    currentData.brokenPromises = parsed.updates.brokenPromises;
    changed = true;
  }

  // ----------------------
  // Lawsuits
  // ----------------------
  if (parsed.updates?.lawsuits) {
    currentData.lawsuits = dedupeLawsuits([...(currentData.lawsuits || []), ...parsed.updates.lawsuits]);
    changed = true;
  }

  // ----------------------
  // Other updates
  // ----------------------
  if (parsed.updates?.newGolfTrips !== null) {
    currentData.golf.marALagoTrips = parsed.updates.newGolfTrips;
    changed = true;
  }
  if (parsed.updates?.wealthUpdate) {
    currentData.wealth = { ...currentData.wealth, ...parsed.updates.wealthUpdate };
    changed = true;
  }

  if (changed) {
    currentData.lastUpdated = new Date().toISOString();
    currentData.lastUpdateReason = parsed.reasoning;
    currentData.lastUpdateSource = parsed.headlineSource;
    await updateData(currentData);
  }

  return { updated: changed, reasoning: parsed.reasoning };
}

// ----------------------
// API HANDLER
// ----------------------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (CRON_SECRET && req.headers['x-api-key'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await analyzeAndUpdate();
    res.json({ success: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
}
