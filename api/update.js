/**
 * Vercel Cron Job: Auto-update tracker data
 * 
 * Runs daily (or on-demand) to:
 * 1. Search for news about Trump administration
 * 2. Use Gemini to extract relevant data
 * 3. Update Supabase with new findings
 * 
 * Environment variables needed:
 * - GEMINI_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY (service role key for writes)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Search queries to monitor
const SEARCH_TOPICS = [
  'Trump broken promise 2026',
  'ICE shooting US citizen',
  'Trump golf trip cost taxpayer',
  'Trump property Secret Service spending',
  'national debt increase 2026',
  'Trump net worth Forbes 2026',
];

async function callGemini(prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
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
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update: ${err}`);
  }
  
  return true;
}

async function analyzeAndUpdate() {
  const currentData = await getCurrentData();
  
  const prompt = `You are a fact-checker analyzing current events related to the Trump administration.

Current tracker data:
${JSON.stringify(currentData, null, 2)}

Based on your knowledge up to your training cutoff, analyze if any of the following should be updated:

1. ICE/CBP incidents - any new US citizens killed or major incidents?
2. Broken promises - any promises newly broken or partially fulfilled?
3. Golf trips / property visits - any new reported numbers?
4. Wealth estimates - any new Forbes or Bloomberg updates?
5. Self-dealing incidents - any new taxpayer spending at Trump properties?
6. National debt figures - any significant updates?

Return a JSON object with ONLY the fields that need updating. If a field doesn't need updating, don't include it.

Format:
{
  "updates": {
    "fieldName": newValue,
    ...
  },
  "reasoning": "Brief explanation of what changed and sources",
  "confidence": 0.0-1.0
}

If nothing needs updating, return:
{
  "updates": {},
  "reasoning": "No updates needed",
  "confidence": 1.0
}

IMPORTANT: Only suggest updates you are highly confident about (>0.8). Return valid JSON only.`;

  const response = await callGemini(prompt);
  
  // Parse JSON from response
  let result;
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    result = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Gemini response:', response);
    return { updated: false, error: 'Parse error' };
  }
  
  if (result.confidence >= 0.8 && Object.keys(result.updates || {}).length > 0) {
    // Merge updates with current data
    const mergedData = { ...currentData };
    
    for (const [key, value] of Object.entries(result.updates)) {
      if (typeof value === 'object' && !Array.isArray(value) && mergedData[key]) {
        // Deep merge for objects
        mergedData[key] = { ...mergedData[key], ...value };
      } else {
        mergedData[key] = value;
      }
    }
    
    mergedData.lastUpdated = new Date().toISOString();
    mergedData.lastUpdateReason = result.reasoning;
    
    await updateData(mergedData);
    
    return {
      updated: true,
      changes: result.updates,
      reasoning: result.reasoning,
    };
  }
  
  return {
    updated: false,
    reasoning: result.reasoning || 'No high-confidence updates',
  };
}

export default async function handler(req, res) {
  // Verify this is a cron job or authorized request
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow cron jobs or requests with correct secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // For manual triggers, also check for a simple API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ 
      error: 'Missing environment variables',
      required: ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'],
    });
  }
  
  try {
    const result = await analyzeAndUpdate();
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// Vercel cron config - runs daily at 6am UTC
export const config = {
  runtime: 'edge',
};
