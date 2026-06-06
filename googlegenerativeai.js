const { GoogleGenerativeAI } = require("@google/generative-ai");

// Rate limiting and queue management
let isProcessingSummary = false;
const requestQueue = [];
const summaryCache = new Map(); // Cache for results

// Helper: Retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 2000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Only retry on 429 or 5xx errors
      if (error.status !== 429 && (error.status < 500 || error.status >= 600)) {
        throw error;
      }
      
      // Calculate delay (exponential with jitter)
      const delay = initialDelay * Math.pow(2, i) + Math.random() * 1000;
      // console.log(`⚠️ Rate limited. Retry ${i + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Process queue sequentially
const processQueue = async (model) => {
  if (isProcessingSummary || requestQueue.length === 0) return;
  
  isProcessingSummary = true;
  const { res, prompt, cacheKey, startTime } = requestQueue.shift();
  
  // Log queue status
  // console.log(`📊 Queue size: ${requestQueue.length + 1}, Processing: ${cacheKey}`);
  
  try {
    // Check cache first
    if (summaryCache.has(cacheKey)) {
      const cached = summaryCache.get(cacheKey);
      const age = (Date.now() - cached.timestamp) / 1000;
      
      // Cache valid for 1 hour
      if (age < 3600) {
        // console.log(`✅ Cache hit for: ${cacheKey} (${Math.round(age)}s old)`);
        return res.json(cached.data);
      } else {
        summaryCache.delete(cacheKey);
      }
    }
    
    // Make API call with retry
    const result = await retryWithBackoff(async () => {
      return await model.generateContent(prompt);
    });
    
    const raw = result?.response?.text?.();
    
    if (!raw) {
      throw new Error("Empty response from Gemini");
    }
    
    let clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    
    // Cache the result
    summaryCache.set(cacheKey, {
      data: parsed,
      timestamp: Date.now()
    });
    
    // console.log(`✅ Summary generated in ${Date.now() - startTime}ms`);
    res.json(parsed);
    
  } catch (error) {
    console.error("❌ Gemini Error:", error.message);
    
    // Send user-friendly error
    res.status(error.status === 429 ? 429 : 500).json({
      error: error.status === 429 
        ? "AI service is busy. Please try again in 1-2 minutes."
        : "Unable to analyze comments. Please try again.",
      details: error.message
    });
  } finally {
    isProcessingSummary = false;
    
    // Wait 3 seconds between requests to respect rate limits
    if (requestQueue.length > 0) {
      setTimeout(() => processQueue(model), 3000);
    }
  }
};

// Clean cache every hour
const startCacheCleaner = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of summaryCache.entries()) {
      if (now - value.timestamp > 3600000) { // 1 hour
        summaryCache.delete(key);
      }
    }
    // console.log(`🧹 Cache cleaned. Size: ${summaryCache.size}`);
  }, 3600000);
};

// Main function to setup the route
const setupCommentSummaryRoute = (app, model, verifyFBToken) => {
  // Start cache cleaner
  startCacheCleaner();
  
  // Comment summary route with verifyFBToken middleware
  app.post("/comment-summary", verifyFBToken, async (req, res) => {
    const { issueTitle, comments } = req.body;
    const userEmail = req.decoded_email; // Get user email from middleware
    // console.log(userEmail)

    // Validation
    if (!comments || comments.length < 2) {
      return res.status(400).json({ error: "At least 2 comments are required" });
    }

    // Create cache key based on content (not just length)
    const commentsHash = comments.map(c => `${c.name}:${c.text.substring(0, 50)}`).join('|');
    const cacheKey = `${issueTitle}_${comments.length}_${userEmail}_${Buffer.from(commentsHash).toString('base64').substring(0, 50)}`;
    
    // Check if already processing same request
    const existingInQueue = requestQueue.some(item => item.cacheKey === cacheKey);
    if (existingInQueue) {
      return res.status(202).json({ 
        message: "Request already queued. Please wait.",
        queued: true 
      });
    }

    const prompt = `You are an AI analyst for CommunityFix, a civic issue reporting platform in Bangladesh.
Analyze these ${comments.length} citizen comments about the issue: "${issueTitle || "Community Issue"}"

Comments:
${comments.map((c, i) => `${i + 1}. [${c.name || "User"}]: ${c.text}`).join("\n")}

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation — pure JSON only:
{
  "overall_sentiment": "positive" or "negative" or "mixed",
  "sentiment_breakdown": { "positive": number, "negative": number, "neutral": number },
  "summary": "2-3 sentence overall summary in English",
  "key_points": [
    { "type": "complaint", "text": "English text" },
    { "type": "complaint", "text": "English text" },
    { "type": "request", "text": "English text" },
    { "type": "impact", "text": "English text" }
  ],
  "urgency_level": "Low" or "Medium" or "High" or "Critical",
  "top_concern": "The single most mentioned concern in English (1 sentence)",
  "authority_recommendation": "What authority should do, in English (1 sentence)"
}`;

    // Add to queue
    requestQueue.push({ 
      res, 
      prompt, 
      cacheKey,
      startTime: Date.now()
    });
    
    // console.log(`📝 Request queued by user: ${userEmail}. Queue size: ${requestQueue.length}`);
    
    // Start processing if not already
    if (!isProcessingSummary) {
      processQueue(model);
    }
  });
};

module.exports = { setupCommentSummaryRoute };