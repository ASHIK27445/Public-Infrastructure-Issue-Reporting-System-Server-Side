// toxicity-classifier.js - ENHANCED VERSION
const toxicity = require('@tensorflow-models/toxicity');

class EnhancedToxicityClassifier {
  constructor() {
    this.model = null;
    this.threshold = 0.55; // LOWERED threshold for better detection
    this.isInitialized = false;
    this.initializationPromise = null;
    
    // Enhanced pattern database
    this.customPatterns = {
      // SEVERE THREATS - Highest priority
      threats: [
        'hurt you', 'kill you', 'destroy you', 'beat you',
        'attack you', 'harm you', 'make you pay', 'revenge',
        'going to hurt', 'going to kill', 'will hurt', 'will kill',
        'make you suffer', 'teach you a lesson', 'break your',
        'ruin you', 'destroy your', 'end you',
        'তোমাকে মেরে', 'হত্যা করব', 'নষ্ট করব', 'ক্ষতি করব', 'শাস্তি দেব',
        'ভেঙে দেব', 'ধ্বংস করব'
      ],
      
      // HATE SPEECH & EXCLUSION
      hateSpeech: [
        'people like you', 'shouldn\'t exist', 'don\'t deserve',
        'worthless people', 'useless people', 'good for nothing',
        'don\'t belong', 'not welcome', 'go back to',
        'disgusting people', 'vermin', 'scum',
        'তোমাদের মতো লোক', 'থাকা উচিত নয়', 'অধিকার নেই', 'যোগ্য নয়',
        'ঘৃণ্য মানুষ', 'অপদার্থ মানুষ'
      ],
      
      // SEVERE INSULTS
      severeInsults: [
        'idiot', 'stupid', 'moron', 'retard', 'bastard', 'bitch',
        'asshole', 'motherfucker', 'worthless', 'useless', 'trash',
        'garbage', 'pathetic', 'incompetent', 'disgusting', 'scumbag',
        'piece of shit', 'son of a bitch', 'fucking',
        'গাধা', 'বোকা', 'পাগল', 'অপদার্থ', 'নষ্ট', 'জঘন্য', 'অসভ্য',
        'নির্লজ্জ', 'ঘৃণ্য', 'অপমানজনক'
      ],
      
      // MODERATE CRITICISM & FRUSTRATION
      moderateCriticism: [
        'ridiculous', 'disappointed', 'terrible', 'awful', 'horrible',
        'bad quality', 'poor work', 'incompetent', 'unacceptable',
        'very poor', 'worst', 'pathetic', 'disgraceful', 'shameful',
        'not acceptable', 'cannot believe', 'how can you',
        'absolutely terrible', 'completely useless', 'totally incompetent',
        'খারাপ', 'ভয়ানক', 'অগ্রহণযোগ্য', 'অদক্ষ', 'নিরাশ', 'লজ্জাজনক',
        'ঘৃণ্য', 'অপমানজনক', 'অস্বীকাৰ্য', 'অবিশ্বাস্য'
      ],
      
      // FRUSTRATION & TIME-RELATED
      frustration: [
        'why is this', 'still pending', 'after weeks', 'no response',
        'taking too long', 'very slow', 'inefficient', 'bad service',
        'poor quality', 'not working', 'doesn\'t work', 'wasting time',
        'too much time', 'delayed again', 'no update', 'ignoring',
        'কেন এটা', 'এখনো ঠিক হয়নি', 'সাড়া নেই', 'অনেক সময় লাগছে',
        'সময় নষ্ট', 'দেরি করছেন', 'উত্তর নেই', 'উপেক্ষা করছেন'
      ],
      
      // RHETORICAL QUESTIONS (often toxic)
      rhetorical: [
        'what kind of', 'how can you', 'are you serious', 'do you even',
        'is this a joke', 'what the hell', 'what the fuck',
        'are you kidding', 'you must be joking', 'you have to be kidding',
        'কী ধরনের', 'কেমন করে', 'আপনি সিরিয়াস', 'আপনার কি',
        'এটা কি রসিকতা', 'কি সর্বনাশ', 'আপনি মজা করছেন'
      ],
      
      // COLLECTIVE HATE
      collectiveHate: [
        'i hate all', 'hate you all', 'hate everyone', 'all of you',
        'you people', 'your department', 'your team', 'your office',
        'আমি ঘৃণা করি সবাইকে', 'ঘৃণা করি তোমাদের', 'সবাইকে ঘৃণা করি',
        'তোমাদের সবাইকে', 'তোমাদের দপ্তর', 'তোমাদের টিম'
      ]
    };
  }

  async initialize(threshold = 0.55, labels = null) {
    // Prevent multiple initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        console.log('🚀 Initializing ENHANCED Toxicity Model...');
        console.log('📊 Using LOWERED threshold: 0.55 (was 0.70)');
        
        this.threshold = threshold;
        
        // Use ALL labels for comprehensive detection
        const defaultLabels = [
          'toxicity',
          'severe_toxicity', 
          'identity_attack',
          'insult',
          'obscene',
          'threat',
          'sexual_explicit'
        ];
        
        const modelLabels = labels || defaultLabels;
        
        console.log('⏳ Loading model (may take 30-60 seconds)...');
        
        // Load with timeout
        const loadPromise = toxicity.load(this.threshold, modelLabels);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Model loading timeout after 120 seconds')), 120000);
        });
        
        this.model = await Promise.race([loadPromise, timeoutPromise]);
        
        this.isInitialized = true;
        console.log('✅ ENHANCED toxicity model loaded successfully!');
        console.log(`🔍 Monitoring ${modelLabels.length} categories: ${modelLabels.join(', ')}`);
        console.log('⚡ System features:');
        console.log('   - AI Model + Enhanced Keyword Detection');
        console.log('   - Emergency pattern matching');
        console.log('   - Lower threshold (0.55) for better sensitivity');
        console.log('   - Bangla/English bilingual support');
        
        return this;
      } catch (error) {
        console.error('❌ Model initialization failed:', error.message);
        this.isInitialized = false;
        this.initializationPromise = null;
        console.log('⚠️ System will use enhanced keyword-only detection');
        return this;
      }
    })();
    
    return this.initializationPromise;
  }

  async classify(text) {
    // Step 1: Quick emergency pattern check (fastest)
    const emergencyResult = this.emergencyPatternCheck(text);
    if (emergencyResult.detected) {
      console.log(`🚨 EMERGENCY PATTERN: ${emergencyResult.label} (Score: ${emergencyResult.score})`);
      return {
        score: emergencyResult.score,
        isToxic: true,
        details: [{ 
          label: emergencyResult.label, 
          score: emergencyResult.score, 
          source: 'emergency-pattern' 
        }],
        method: 'emergency-pattern',
        confidence: parseFloat((emergencyResult.score * 100).toFixed(1)) + '%',
        note: 'Direct emergency pattern match'
      };
    }

    // Step 2: Enhanced keyword check
    const keywordResult = this.enhancedKeywordCheck(text);
    
    // If keyword finds severe toxicity, return immediately
    if (keywordResult.severeThreat || keywordResult.hasHateSpeech) {
      console.log(`🚨 KEYWORD DETECTION: ${keywordResult.severeThreat ? 'SEVERE THREAT' : 'HATE SPEECH'}`);
      return {
        score: keywordResult.score,
        isToxic: true,
        details: keywordResult.details,
        method: 'keyword-critical',
        confidence: keywordResult.confidence,
        warning: keywordResult.severeThreat ? 'Critical threat detected' : 'Hate speech detected'
      };
    }

    // Step 3: AI Model check (if available)
    let aiResult = { score: 0, isToxic: false, details: [], method: 'ai-unavailable' };
    
    if (this.isInitialized && this.model) {
      try {
        aiResult = await this.aiClassification(text);
      } catch (error) {
        console.error('AI classification failed:', error.message);
        // Continue with keyword result
      }
    }

    // Step 4: Combine results intelligently
    return this.intelligentCombineResults(aiResult, keywordResult);
  }

  async aiClassification(text) {
    const predictions = await this.model.classify([text]);
    
    let maxScore = 0;
    let isToxic = false;
    const toxicLabels = [];

    predictions.forEach(prediction => {
      const result = prediction.results[0];
      if (result && result.match) {
        isToxic = true;
        const score = result.probabilities[1];
        maxScore = Math.max(maxScore, score);
        
        toxicLabels.push({
          label: prediction.label,
          score: parseFloat(score.toFixed(3)),
          probability: result.probabilities[1],
          source: 'ai-model'
        });
      }
    });

    return {
      score: parseFloat(maxScore.toFixed(3)),
      isToxic: isToxic,
      details: toxicLabels,
      method: 'tensorflow-ai'
    };
  }

  emergencyPatternCheck(text) {
    const lowerText = text.toLowerCase();
    
    // Critical patterns that MUST be caught
    const emergencyPatterns = [
      {
        patterns: [
          /people like you shouldn'?t exist/i,
          /people like you don'?t deserve/i,
          /people of your kind/i
        ],
        score: 0.88,
        label: 'exclusionary-hate',
        type: 'hate_speech'
      },
      {
        patterns: [
          /what kind of (service|work|system|shit) is this/i,
          /what type of .* is this/i
        ],
        score: 0.65,
        label: 'rhetorical-criticism',
        type: 'insult'
      },
      {
        patterns: [
          /i hate (all of you|you all|everyone|your .*)/i,
          /hate all of you/i
        ],
        score: 0.85,
        label: 'collective-hate',
        type: 'toxicity'
      },
      {
        patterns: [
          /why is this (still|yet) (pending|not fixed|waiting|unresolved)/i,
          /still (pending|waiting) after .* (weeks|months)/i
        ],
        score: 0.48,
        label: 'frustration-time',
        type: 'toxicity'
      },
      {
        patterns: [
          /(very|so|extremely|absolutely) (poor|bad|terrible|awful) (quality|work|service)/i,
          /worst (service|quality|work) ever/i
        ],
        score: 0.62,
        label: 'quality-criticism',
        type: 'insult'
      },
      {
        patterns: [
          /go to hell/i,
          /burn in hell/i,
          /rot in hell/i
        ],
        score: 0.78,
        label: 'curse-wish',
        type: 'obscene'
      },
      // Bangla patterns
      {
        patterns: [
          /তোমাদের মতো লোকের/i,
          /থাকা উচিত নয়/i,
          /যোগ্য নয়/i
        ],
        score: 0.82,
        label: 'exclusionary-hate-bangla',
        type: 'hate_speech'
      },
      {
        patterns: [
          /কী ধরনের সেবা/i,
          /কেমন কাজ/i
        ],
        score: 0.58,
        label: 'rhetorical-bangla',
        type: 'insult'
      }
    ];

    for (const ep of emergencyPatterns) {
      for (const pattern of ep.patterns) {
        if (pattern.test(text) || pattern.test(lowerText)) {
          return {
            detected: true,
            score: ep.score,
            label: ep.label,
            type: ep.type
          };
        }
      }
    }

    return { detected: false, score: 0, label: '', type: '' };
  }

  enhancedKeywordCheck(text) {
    const lowerText = text.toLowerCase();
    let score = 0;
    const detectedPatterns = [];
    const threatLevels = {
      severeThreat: false,
      hateSpeech: false,
      severeInsult: false,
      moderateCriticism: false,
      frustration: false,
      rhetorical: false,
      collectiveHate: false
    };

    // Function to check patterns with word boundaries
    const checkPatterns = (patternList, points, category, label) => {
      patternList.forEach(pattern => {
        // Check with word boundary for exact matches
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        if (regex.test(text) || lowerText.includes(pattern.toLowerCase())) {
          score += points;
          threatLevels[category] = true;
          detectedPatterns.push({
            pattern: pattern,
            points: points,
            category: category,
            label: label || category
          });
        }
      });
    };

    // Check all pattern categories
    checkPatterns(this.customPatterns.threats, 0.85, 'severeThreat', 'threat');
    checkPatterns(this.customPatterns.hateSpeech, 0.80, 'hateSpeech', 'hate_speech');
    checkPatterns(this.customPatterns.severeInsults, 0.75, 'severeInsult', 'severe_insult');
    checkPatterns(this.customPatterns.moderateCriticism, 0.45, 'moderateCriticism', 'moderate_criticism');
    checkPatterns(this.customPatterns.frustration, 0.35, 'frustration', 'frustration');
    checkPatterns(this.customPatterns.rhetorical, 0.40, 'rhetorical', 'rhetorical_question');
    checkPatterns(this.customPatterns.collectiveHate, 0.82, 'collectiveHate', 'collective_hate');

    // Additional context-based scoring
    if (this.isRhetoricalQuestion(text)) {
      score += 0.38;
      threatLevels.rhetorical = true;
      detectedPatterns.push({
        pattern: 'rhetorical_question_structure',
        points: 0.38,
        category: 'rhetorical',
        label: 'rhetorical_structure'
      });
    }

    if (this.isTimeFrustration(text)) {
      score += 0.32;
      threatLevels.frustration = true;
      detectedPatterns.push({
        pattern: 'time_frustration',
        points: 0.32,
        category: 'frustration',
        label: 'time_based_frustration'
      });
    }

    // Quality criticism patterns
    if (lowerText.includes('poor quality') || lowerText.includes('bad service')) {
      score = Math.max(score, 0.55);
      threatLevels.moderateCriticism = true;
      detectedPatterns.push({
        pattern: 'quality_criticism',
        points: 0.55,
        category: 'moderateCriticism',
        label: 'quality_complaint'
      });
    }

    // "What kind of" pattern (common missed case)
    if (lowerText.includes('what kind of')) {
      score = Math.max(score, 0.60);
      threatLevels.rhetorical = true;
      detectedPatterns.push({
        pattern: 'what_kind_of',
        points: 0.60,
        category: 'rhetorical',
        label: 'what_kind_question'
      });
    }

    // Cap score at 1.0
    score = Math.min(score, 1.0);
    
    // Determine toxicity - LOWER threshold
    const isToxic = score >= 0.35; // Lowered from 0.4
    
    // Calculate confidence
    let confidenceLevel = 'low';
    if (score >= 0.7) confidenceLevel = 'high';
    else if (score >= 0.5) confidenceLevel = 'medium';

    return {
      score: parseFloat(score.toFixed(3)),
      isToxic: isToxic,
      details: detectedPatterns.map(p => ({
        label: `${p.label}`,
        score: p.points,
        category: p.category,
        source: 'enhanced-keyword'
      })),
      detectedPatterns: detectedPatterns,
      threatLevels: threatLevels,
      severeThreat: threatLevels.severeThreat,
      hasHateSpeech: threatLevels.hateSpeech,
      method: 'enhanced-keyword-detection',
      confidence: parseFloat((score * 100).toFixed(1)) + '%',
      confidenceLevel: confidenceLevel
    };
  }

  intelligentCombineResults(aiResult, keywordResult) {
    console.log(`🤖 Combining results: AI=${aiResult.score}, Keyword=${keywordResult.score}`);
    
    // Case 1: Both agree on toxicity
    if (aiResult.isToxic && keywordResult.isToxic) {
      const finalScore = Math.max(aiResult.score, keywordResult.score);
      console.log(`✅ Both agree: TOXIC. Final score: ${finalScore}`);
      
      return {
        score: finalScore,
        isToxic: true,
        details: [
          ...aiResult.details.map(d => ({ ...d, source: 'ai' })),
          ...keywordResult.details.map(d => ({ ...d, source: 'keyword' }))
        ],
        combined: true,
        aiScore: aiResult.score,
        keywordScore: keywordResult.score,
        method: 'combined-ai-keyword-agree',
        confidence: parseFloat((finalScore * 100).toFixed(1)) + '%'
      };
    }
    
    // Case 2: Keyword detects but AI misses (COMMON ISSUE)
    if (keywordResult.isToxic && !aiResult.isToxic) {
      console.log(`⚠️ AI missed what keyword detected`);
      console.log(`   AI Score: ${aiResult.score}, Keyword Score: ${keywordResult.score}`);
      
      // Trust keyword more for specific cases
      if (keywordResult.score >= 0.45) { // Moderate or higher
        const boostedScore = Math.max(keywordResult.score, aiResult.score + 0.25);
        console.log(`🔄 Overriding AI. Boosted score: ${boostedScore}`);
        
        return {
          score: boostedScore,
          isToxic: true,
          details: keywordResult.details.map(d => ({ ...d, source: 'keyword-override' })),
          aiMissed: true,
          keywordDetected: true,
          method: 'keyword-override-ai',
          confidence: parseFloat((boostedScore * 100).toFixed(1)) + '%',
          note: 'AI missed moderate/high keyword detection'
        };
      }
    }
    
    // Case 3: AI detects but keyword misses (less common)
    if (aiResult.isToxic && !keywordResult.isToxic) {
      console.log(`ℹ️ AI detected subtle toxicity missed by keywords`);
      return aiResult;
    }
    
    // Case 4: Neither detects toxicity
    const finalScore = Math.max(aiResult.score, keywordResult.score);
    const isToxic = finalScore >= 0.4; // Final threshold check
    
    if (isToxic) {
      console.log(`🔄 Final threshold triggered toxicity: ${finalScore} >= 0.4`);
    }
    
    return {
      score: finalScore,
      isToxic: isToxic,
      details: finalScore === aiResult.score ? aiResult.details : keywordResult.details,
      combined: false,
      aiScore: aiResult.score,
      keywordScore: keywordResult.score,
      method: finalScore === aiResult.score ? aiResult.method : keywordResult.method,
      confidence: parseFloat((finalScore * 100).toFixed(1)) + '%'
    };
  }

  // Helper functions
  isRhetoricalQuestion(text) {
    const patterns = [
      /^what (kind|type) of/i,
      /^how can you/i,
      /^are you (serious|kidding|joking)/i,
      /^do you even/i,
      /^is this (a joke|serious)/i,
      /^you must be/i,
      /^কী ধরনের/i,
      /^কেমন করে/i,
      /^আপনি সিরিয়াস/i
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  isTimeFrustration(text) {
    const patterns = [
      /after \d+ (days|weeks|months)/i,
      /still (pending|waiting|not fixed)/i,
      /taking too long/i,
      /no response.*\d+/i,
      /এখনো.*ঠিক হয়নি/i,
      /অনেক.*সময়/i
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      threshold: this.threshold,
      status: this.isInitialized ? 'ready' : 'not-ready',
      method: 'enhanced-combined-detection',
      features: [
        'AI Model Detection',
        'Enhanced Keyword Database',
        'Emergency Pattern Matching',
        'Bilingual Support (EN/BN)',
        'Lower Threshold (0.55)'
      ],
      timestamp: new Date().toISOString()
    };
  }

  getMetrics() {
    return {
      patternCategories: Object.keys(this.customPatterns).length,
      totalPatterns: Object.values(this.customPatterns).reduce((sum, arr) => sum + arr.length, 0),
      detectionMethods: ['ai', 'keyword', 'emergency-pattern', 'combined'],
      supportedLanguages: ['English', 'Bangla'],
      threshold: this.threshold,
      timestamp: new Date().toISOString()
    };
  }
}

// Create and export singleton instance
const toxicityClassifier = new EnhancedToxicityClassifier();

module.exports = toxicityClassifier;