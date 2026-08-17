import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';
import AssistantMarkdown from '../components/AssistantMarkdown';

const DeepseekChat = () => {
  const navigate = useNavigate();
  const listRef = useRef(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    setError('');
    const text = input.trim();
    if (!text || loading) return;

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const history = messages.map((item) => ({
      role: item.role,
      content: item.content,
    }));

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(
        `${getGatewayBaseUrl()}/api/deepseek/chat`,
        { message: text, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const answer = String(res.data?.data?.answer || '').trim();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer || 'No response returned.' },
      ]);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      const detail = [
        err.response?.data?.message,
        err.response?.data?.detail,
        err.message,
      ]
        .filter(Boolean)
        .join('\n\n');
      setError(detail || 'Failed to get response from DeepSeek.');
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '75vh',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 className="gradient-text" style={{ margin: 0 }}>
                DeepSeek Chat
              </h1>
              <p
                style={{
                  marginTop: '0.35rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                Content conversion and learning help powered by DeepSeek.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => navigate('/dashboard')}
            >
              Back
            </button>
          </div>

          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(15, 23, 42, 0.03)',
              minHeight: '360px',
            }}
          >
            {messages.length === 0 && !loading && (
              <p
                style={{
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  margin: 'auto',
                }}
              >
                Ask anything, or paste content to convert into clearer learning
                material.
              </p>
            )}

            {messages.map((item, index) => {
              const isUser = item.role === 'user';
              return (
                <div
                  key={`${item.role}-${index}`}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '0.85rem 1rem',
                    borderRadius: isUser
                      ? '14px 14px 4px 14px'
                      : '14px 14px 14px 4px',
                    background: isUser
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                      : 'rgba(255,255,255,0.75)',
                    color: isUser ? '#fff' : 'var(--text)',
                    border: isUser
                      ? 'none'
                      : '1px solid rgba(37, 99, 235, 0.12)',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      opacity: 0.8,
                      marginBottom: '0.35rem',
                      fontWeight: 650,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isUser ? 'You' : 'DeepSeek'}
                  </div>
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {item.content}
                    </div>
                  ) : (
                    <AssistantMarkdown>{item.content}</AssistantMarkdown>
                  )}
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                DeepSeek is thinking…
              </div>
            )}
          </div>

          {error && (
            <p
              style={{
                color: 'var(--danger)',
                marginBottom: '0.75rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <textarea
              className="form-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={4}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              style={{ resize: 'vertical' }}
              disabled={loading}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setMessages([]);
                  setError('');
                }}
                disabled={loading || messages.length === 0}
              >
                Clear chat
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={send}
                disabled={loading || !input.trim()}
              >
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeepseekChat;
