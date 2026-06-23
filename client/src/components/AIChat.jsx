import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

const SUGGESTIONS = [
  'Help me with math homework',
  'How do I study better?',
  'Tell me a joke',
  'Career advice for students',
  'Explain how AI works',
  'Tips for making friends'
];

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    try {
      const res = await api.get('/ai/history');
      setMessages(res.data.messages || []);
    } catch {}
    setHistoryLoaded(true);
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        message: msg,
        history: messages.slice(-10)
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Try again!' }]);
    }
    setLoading(false);
  };

  const renderContent = (content) => {
    // Simple markdown-like rendering
    return content
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <strong key={i}>{line.replace(/\*\*/g, '')}</strong>;
        }
        if (line.startsWith('•') || line.startsWith('-')) {
          return <div key={i} style={{ paddingLeft: 12 }}>• {line.replace(/^[•\-]\s*/, '')}</div>;
        }
        if (/^\d+\./.test(line)) {
          return <div key={i} style={{ paddingLeft: 12 }}>{line}</div>;
        }
        return <span key={i}>{line}<br /></span>;
      });
  };

  return (
    <div className="ai-chat-layout">
      <div className="ai-chat-header glass-panel" style={{ borderRadius: 'var(--radius) var(--radius) 0 0' }}>
        <div className="ai-avatar">🤖</div>
        <div>
          <h2>EduConnect AI</h2>
          <div className="subtitle">Your intelligent study & life assistant</div>
        </div>
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && historyLoaded && (
          <div className="ai-welcome">
            <div className="ai-icon">🤖</div>
            <h2>Hey there! 👋</h2>
            <p>I'm your AI assistant. Ask me about homework, study tips, coding, career advice, or anything on your mind!</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="ai-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            <div className="ai-avatar-sm">{msg.role === 'user' ? '👤' : '🤖'}</div>
            <div className="ai-bubble">{renderContent(msg.content)}</div>
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant">
            <div className="ai-avatar-sm">🤖</div>
            <div className="ai-bubble" style={{ padding: '10px 18px' }}>
              <span className="ai-typing-dot" />
              <span className="ai-typing-dot" />
              <span className="ai-typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-input glass-panel" style={{ borderRadius: '0 0 var(--radius) var(--radius)' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything — homework, life advice, jokes..."
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
