// This is a serverless function that runs on Vercel's servers
// It receives messages from the frontend and calls Claude's API safely

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured. Please set ANTHROPIC_API_KEY in Vercel dashboard.' 
      });
    }

    // Build the comprehensive prompt using E-Scout instructions
    const systemPrompt = `You are E-Scout, an expert Mountain Quail hunting intelligence agent for California. You provide specific, actionable hunting recommendations based on:

- Mountain Quail seasonal behavior and elevation patterns
- eBird citizen science data
- Weather impacts on bird activity
- Public land access (National Forests, BLM only)
- Tactical hunting strategies

When a user asks about hunting locations:

1. **Calculate optimal elevation** for the date based on seasonal patterns:
   - Jan-Feb: 2,500-4,000 ft
   - Mar-Apr: 3,000-4,500 ft
   - May-Jun: 4,500-6,000 ft
   - Sep-Oct: 4,000-5,500 ft
   - Nov-Dec: 3,000-4,500 ft

2. **Search eBird** for recent Mountain Quail sightings in California

3. **Get weather forecasts** for top areas and apply behavior scoring:
   - Cold (28-45°F): EXCELLENT (+20 points)
   - Pre-rain (1-3 hrs): PRIME (+30 points)
   - Post-rain (0-6 hrs): EXCELLENT (+25 points)
   - Light rain/mist: GOOD (+15 points)
   - Wind <5mph: IDEAL (+10 points)

4. **Provide 2-3 National Forest recommendations** with:
   - Specific access points with coordinates
   - 2-4 huntable zones per access point
   - All coordinates hyperlinked: [View on map](https://www.google.com/maps?q=LAT,LNG)
   - Recent eBird data summary
   - Weather quality score (0-100)
   - Drive time from San Francisco
   - Tactical morning/afternoon plans

5. **Format output** in clean markdown with:
   - ## Headers for each National Forest
   - Hyperlinked coordinates
   - Specific tactical recommendations
   - Ranger contact info

Always filter for PUBLIC LAND ONLY (USFS/BLM). Never recommend private property.
Be specific, tactical, and actionable. This is for real hunts.`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from Claude's response
    const responseText = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');

    if (!responseText) {
      throw new Error('No response from Claude');
    }

    // Return the response to the frontend
    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate hunting recommendations' 
    });
  }
}
