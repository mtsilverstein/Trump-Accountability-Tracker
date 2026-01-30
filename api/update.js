/**
 * Vercel API: Trump Accountability Tracker Auto-Update
 * 
 * Features:
 * - Gemini 2.5 Pro (stable) for news analysis
 * - Smart ICE incident handling (unnamed → named updates)
 * - Lawsuit tracking
 * - Broken promises (static for now)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Stable Gemini 2.5 Pro model
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

const SEARCH_QUERIES = [
  'ICE shooting victim',
  'Border Patrol shooting',
  'ICE agent kills',
  'Trump lawsuit federal court',
  'Trump administration sued',
  'lawsuit against Trump 2025 2026',
];

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
      if (title) items.push({ title, pubDate, query });
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
  });
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

// ==================== SMART ICE INCIDENT MERGE ====================
// Handles: unnamed incidents that later get names identified

function mergeIceIncidents(existing, newIncidents) {
  const result = [...existing];
  
  for (const newInc of newIncidents) {
    // Check if this matches an existing unnamed incident by date/location
    const matchIndex = result.findIndex(ex => {
      // Same date and location = likely same incident
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
      result[matchIndex] = {
        ...result[matchIndex],
        ...newInc,
        id: newInc.id || `${newInc.name?.toLowerCase().replace(/\s+/g, '-')}`,
      };
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
        result.push({
          ...newInc,
          id: newInc.id || `${newInc.date}-${newInc.location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        });
      }
    }
  }
  
  return result;
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
      title: "Energy Bills Cut 50%",
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
      title: "End Ukraine War in 24 Hours",
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

    // Build prompt for Gemini
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
      "sources": ["Source1"]
    }
  ],
  "iceStatsUpdate": {
    "totalShootings": null,
    "shootingDeaths": null
  },
  "updateReason": "Brief description of what was found"
}

CRITICAL RULES:
1. For ICE incidents: Include shootings/deaths by ICE, Border Patrol, or CBP agents
2. If a victim's name is unknown, use "Unnamed victim" but STILL include the incident with date/location
3. If you find a NAME for someone who was previously "Unnamed", include them so we can update the record
4. For lawsuits: Include cases against Trump personally, the Trump administration, or federal agencies under Trump
5. Do NOT duplicate incidents/lawsuits already in the database
6. Set stats to null if no specific numbers found
7. Return empty arrays [] if nothing new found - this is fine!`;

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
      // Still update broken promises even if parsing fails
      const updatedData = {
        ...currentData,
        brokenPromises: getBrokenPromises(),
        lastUpdated: new Date().toISOString(),
        lastUpdateReason: 'Could not parse AI response, updated broken promises only',
      };
      await updateSupabase(updatedData);
      return res.status(200).json({ success: true, message: 'Parse error, updated broken promises', updated: true });
    }

    // Merge ICE incidents (handles unnamed → named updates)
    const mergedIce = mergeIceIncidents(
      currentData.iceVictims || [],
      parsed.iceIncidents || []
    );

    // Merge lawsuits
    const existingLawsuitIds = new Set((currentData.lawsuits || []).map(l => l.id));
    const newLawsuits = (parsed.lawsuits || []).filter(l => !existingLawsuitIds.has(l.id));
    const mergedLawsuits = [...(currentData.lawsuits || []), ...newLawsuits];

    // Update stats if provided
    const updatedStats = { ...(currentData.iceStats || {}) };
    if (parsed.iceStatsUpdate?.totalShootings) {
      updatedStats.totalShootings = parsed.iceStatsUpdate.totalShootings;
    }
    if (parsed.iceStatsUpdate?.shootingDeaths) {
      updatedStats.shootingDeaths = parsed.iceStatsUpdate.shootingDeaths;
    }

    // Build updated data
    const updatedData = {
      ...currentData,
      iceVictims: mergedIce,
      iceStats: updatedStats,
      lawsuits: mergedLawsuits,
      brokenPromises: getBrokenPromises(),
      lastUpdated: new Date().toISOString(),
      lastUpdateReason: parsed.updateReason || 'Automated update',
    };

    // Save to Supabase
    const saved = await updateSupabase(updatedData);
    
    if (!saved) {
      throw new Error('Failed to save to Supabase');
    }

    console.log('Update complete!');
    return res.status(200).json({
      success: true,
      updated: true,
      newIncidents: (parsed.iceIncidents || []).length,
      newLawsuits: newLawsuits.length,
      reason: parsed.updateReason,
    });

  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
