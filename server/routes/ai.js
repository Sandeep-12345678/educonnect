const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Chat with AI
router.post('/chat', authMiddleware, async (req, res) => {
  const { message, history } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!message) return res.status(400).json({ error: 'Message required' });

  // Save user message
  db.prepare('INSERT INTO ai_chats (user_id, role, content) VALUES (?, ?, ?)')
    .run(req.user.id, 'user', message);

  // If no API key, use simulated responses
  if (!apiKey) {
    const reply = simulateAI(message);
    db.prepare('INSERT INTO ai_chats (user_id, role, content) VALUES (?, ?, ?)')
      .run(req.user.id, 'assistant', reply);
    return res.json({ reply });
  }

  try {
    // Build conversation from history
    const messages = [
      {
        role: 'system',
        content: 'You are EduConnect AI, a helpful and friendly assistant for a student social media platform. You help students with homework, study tips, social skills, tech questions, and general advice. Keep responses helpful, positive, and age-appropriate. Use emojis to be friendly. Keep responses under 500 words.'
      }
    ];

    if (history && history.length > 0) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://educonnect.onrender.com',
        'X-Title': 'EduConnect'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'OpenRouter error');
    }

    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not process that.';
    
    db.prepare('INSERT INTO ai_chats (user_id, role, content) VALUES (?, ?, ?)')
      .run(req.user.id, 'assistant', reply);

    res.json({ reply });
  } catch (err) {
    console.error('AI Chat error:', err.message);
    // Fall back to simulation on error
    const reply = simulateAI(message);
    db.prepare('INSERT INTO ai_chats (user_id, role, content) VALUES (?, ?, ?)')
      .run(req.user.id, 'assistant', reply);
    res.json({ reply });
  }
});

// Get chat history
router.get('/history', authMiddleware, (req, res) => {
  const messages = db.prepare(`
    SELECT role, content, created_at FROM ai_chats 
    WHERE user_id = ? 
    ORDER BY created_at ASC 
    LIMIT 100
  `).all(req.user.id);
  res.json({ messages });
});

// Simulated AI responses (when no API key)
function simulateAI(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return "Hey there! 👋 I'm your EduConnect AI assistant. I can help you with homework, study tips, tech questions, or just chat. What's on your mind?";
  }
  if (msg.includes('homework') || msg.includes('study') || msg.includes('help')) {
    return "📚 I'd love to help you study! Here's what I recommend:\n\n1. **Break it down** — tackle one topic at a time\n2. **Active recall** — test yourself instead of re-reading\n3. **Pomodoro** — study 25 min, break 5 min\n4. **Teach someone** — explaining solidifies learning\n\nWhat subject are you working on?";
  }
  if (msg.includes('math') || msg.includes('equation') || msg.includes('solve')) {
    return "🔢 Math time! I can help with algebra, calculus, geometry, and more. Try sharing a specific problem and I'll walk you through the solution step by step.";
  }
  if (msg.includes('code') || msg.includes('programming') || msg.includes('python') || msg.includes('javascript')) {
    return "💻 Coding help is my specialty! I can explain concepts, debug code, suggest improvements, and help you learn programming. What language or problem are you working on?";
  }
  if (msg.includes('social') || msg.includes('friend') || msg.includes('anxiety')) {
    return "💙 It's totally normal to feel that way. Here are some tips:\n\n• **Be yourself** — authentic connections matter most\n• **Listen actively** — people appreciate being heard\n• **Start small** — join a club or study group\n• **Reach out** — if you're struggling, talk to a trusted adult\n\nRemember, quality > quantity in friendships. 🌟";
  }
  if (msg.includes('college') || msg.includes('university') || msg.includes('career')) {
    return "🎓 Planning for the future is exciting! Consider:\n\n• What subjects do you genuinely enjoy?\n• What kind of work environment suits you?\n• Research different career paths online\n• Talk to professionals in fields you're curious about\n\nThere's no single 'right' path — your journey is unique!";
  }
  if (msg.includes('joke') || msg.includes('funny')) {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛💡",
      "What's a student's favorite type of math? Snack-ulus! 🍕",
      "Why did the AI break up with the calculator? It couldn't count on it anymore! 🤖",
      "What do you call a student who only studies at night? A night learner! 🌙"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  if (msg.includes('who are you') || msg.includes('what are you')) {
    return "I'm EduConnect AI 🤖 — your friendly student assistant! I'm here to help with homework, study tips, coding, career advice, and just being a supportive friend. I run on AI and love helping students learn and grow! 🌱\n\nFor even smarter answers, the admin can connect me to OpenRouter with an API key!";
  }
  
  return `Thanks for asking! 🌟 I'm here to help with homework, study tips, coding, social advice, career guidance, and more. Try asking me something specific!\n\n💡 **Tip:** For more powerful AI responses, add an OpenRouter API key in your server .env file.`;
}

module.exports = router;
