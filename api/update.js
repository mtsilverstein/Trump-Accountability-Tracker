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

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
];

// Fetch news using Google News RSS (free, no API key needed)
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

async function analyzeAndUpdate() {
  console.log('Fetching news...');
  const news = await fetchAllNews();
  console.log(`Found ${news.length} news items`);
  
  if (news.length === 0) {
    return { updated: false, reason: 'No news found' };
  }
  
  const currentData = await getCurrentData();
  const newsText = news.map(n => `- ${n.title} (${n.pubDate})`).join('\n');
  
  const prompt = `You are analyzing recent news headlines to update a Trump accountability tracker.

RECENT NEWS HEADLINES:
${newsText}

CURRENT TRACKER DATA:
- Broken promises tracked: ${currentData.brokenPromises?.length || 0}
- ICE victims: ${currentData.iceVictims?.map(v => v.name).join(', ') || 'None'}
- Golf trips: ${(currentData.golf?.marALagoTrips || 0) + (currentData.golf?.bedminsterTrips || 0) + (currentData.golf?.scotlandTrips || 0)} total

Based on ONLY the news headlines above, identify ANY new information:

1. NEW ICE/CBP incidents involving deaths or shootings (especially US citizens)
2. NEW evidence of broken promises (specific data contradicting Trump claims)
3. NEW self-dealing incidents (taxpayer money to Trump properties)
4. UPDATED statistics (new golf trips, costs, wealth estimates from Forbes)

IMPORTANT: Only report information clearly stated in headlines. Do not invent data.

Return JSON:
{
  "hasUpdates": true/false,
  "updates": {
    "newIceIncident": { "name": "", "date": "", "location": "", "details": "", "agency": "" } or null,
    "brokenPromiseEvidence": { "promiseId": "groceries-down|manufacturing-jobs|energy-50|ukraine-24h|day-one-inflation|epstein-files|drill-baby-drill|medicare-medicaid", "newFact": "specific new fact" } or null,
    "newGolfTrips": number or null,
    "wealthUpdate": { "amount": number, "source": "Forbes/Bloomberg" } or null
  },
  "reasoning": "What was found and why it matters",
  "headlineSource": "The specific headline this came from"
}

If nothing new: { "hasUpdates": false, "reasoning": "No new trackable data in headlines" }

Return ONLY valid JSON, no markdown.`;

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
  
  if (result.hasUpdates && result.updates) {
    let madeChanges = false;
    
    // New ICE incident
    if (result.updates.newIceIncident?.name) {
      const ni = result.updates.newIceIncident;
      const exists = currentData.iceVictims?.some(v => 
        v.name.toLowerCase() === ni.name.toLowerCase()
      );
      
      if (!exists) {
        currentData.iceVictims = [...(currentData.iceVictims || []), {
          id: ni.name.toLowerCase().replace(/\s+/g, '-'),
          name: ni.name,
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
    
    // Broken promise evidence
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
      if (result.updates.newGolfTrips > current) {
        currentData.golf = currentData.golf || {};
        currentData.golf.marALagoTrips = result.updates.newGolfTrips;
        madeChanges = true;
      }
    }
    
    // Wealth update
    if (result.updates.wealthUpdate?.amount) {
      currentData.wealth = currentData.wealth || {};
      currentData.wealth.current = result.updates.wealthUpdate.amount;
      currentData.wealth.source = result.updates.wealthUpdate.source || 'Forbes';
      madeChanges = true;
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
