/**
 * Vercel Serverless Function: News Monitor
 * 
 * Uses Gemini API to parse news and extract tracker updates.
 * Call via: POST /api/monitor
 * 
 * Set GEMINI_API_KEY in Vercel environment variables.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Extraction prompts
const PROMPTS = {
  brokenPromise: (article) => `
Analyze this article for information about a Trump campaign promise that was broken or not fulfilled.

Article:
${article}

If found, return JSON:
{
  "found": true,
  "promise": {
    "description": "What was promised",
    "quote": "Exact quote if available",
    "status": "Current status",
    "evidence": ["Facts showing it's broken"],
    "confidence": 0.0-1.0
  }
}

If not found: {"found": false}
Return ONLY valid JSON.`,

  iceIncident: (article) => `
Analyze this article for someone killed or seriously harmed by ICE, CBP, or Border Patrol.

Article:
${article}

If found, return JSON:
{
  "found": true,
  "incident": {
    "name": "Victim name",
    "age": number,
    "citizenship": "us_citizen|legal_resident|undocumented|unknown",
    "date": "YYYY-MM-DD",
    "location": "City, State",
    "agency": "ICE|CBP|Border Patrol",
    "description": "What happened",
    "confidence": 0.0-1.0
  }
}

If not found: {"found": false}
Return ONLY valid JSON.`,

  selfDealing: (article) => `
Analyze this article for Trump profiting from the presidency or conflicts of interest.

Article:
${article}

If found, return JSON:
{
  "found": true,
  "incident": {
    "type": "taxpayer_spending|foreign_government|policy_benefit",
    "description": "What happened",
    "amount": number or null,
    "source": "Who documented this",
    "confidence": 0.0-1.0
  }
}

If not found: {"found": false}
Return ONLY valid JSON.`,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }
  
  try {
    const { type, article } = req.body;
    
    if (!type || !article) {
      return res.status(400).json({ error: 'Missing type or article' });
    }
    
    const prompt = PROMPTS[type];
    if (!prompt) {
      return res.status(400).json({ error: `Invalid type: ${type}` });
    }
    
    const result = await callGemini(prompt(article));
    
    // Parse JSON from response
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Monitor error:', error);
    return res.status(500).json({ error: error.message });
  }
}
