const checkToxicity = (text) =>{
      try {
        // Toxic keywords list (English + Bangla)
        const toxicKeywords = [
          'idiot', 'stupid', 'moron', 'retard', 'dumb', 'fool',
          'bastard', 'bitch', 'asshole', 'motherfucker',
          'fuck', 'shit', 'damn', 'hell', 'crap',
          'kill', 'die', 'hate', 'ugly', 'fat',
          'বোকা', 'গাধা', 'হাবা', 'পাগল', 'মূর্খ',
          'নষ্ট', 'খারাপ', 'অপদার্থ'
        ];

        const lowerText = text.toLowerCase();
        let score = 0;
        let foundKeywords = 0;

        // প্রতিটা toxic keyword check করা
        toxicKeywords.forEach(keyword => {
          if (lowerText.includes(keyword.toLowerCase())) {
            foundKeywords++;
            score += 0.15; // প্রতিটা keyword 15% score বাড়ায়
          }
        });

        // Maximum score 1 (100%)
        score = Math.min(score, 1);

        // বিশেষ ক্ষেত্রে score বাড়ানো
        if (text.includes('kill you') || text.includes('die')) {
          score = Math.max(score, 0.9);
        }

        return {
          score: parseFloat(score.toFixed(2)),
          isToxic: score >= 0.85, // 85% বা বেশি হলে toxic
          foundKeywords
        };

      } 
      catch (error) {
        console.error('Error in toxicity check:', error);
        return {
          score: 0,
          isToxic: false,
          error: error.message
        }
      }
}

module.exports = {checkToxicity}