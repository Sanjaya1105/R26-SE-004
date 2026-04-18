import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';

function buildGptAskUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/gpt/ask`,
    'http://localhost:4000/api/gpt/ask',
    'http://127.0.0.1:4000/api/gpt/ask',
    'http://localhost:5001/api/gpt/ask',
  ].filter((url, i, arr) => arr.indexOf(url) === i);
}

const Gpt = () => {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async () => {
    setError('');
    setAnswer('');
    const q = question.trim();
    if (!q) {
      setError('Please enter a question.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const urls = buildGptAskUrls();
      let lastErr;
      let res;
      for (const url of urls) {
        try {
          res = await axios.post(
            url,
            { question: q },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (e.response?.status === 404) continue;
          if (!e.response && e.code === 'ERR_NETWORK') continue;
          throw e;
        }
      }
      if (!res && lastErr) throw lastErr;
      setAnswer(String(res.data?.data?.answer || '').trim());
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setError(
        [
          err.response?.data?.message,
          err.response?.data?.detail,
          err.message,
        ]
          .filter(Boolean)
          .join('\n\n') || 'Failed to get response from assistant.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h1 className="gradient-text" style={{ margin: 0 }}>
              Chat Assistant
            </h1>
            <button type="button" className="btn" onClick={() => navigate('/dashboard')}>
              Back
            </button>
          </div>

          <label className="form-label" htmlFor="assistant-question">
            Ask a question
          </label>
          <textarea
            id="assistant-question"
            className="form-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={5}
            placeholder="Type your question here..."
            style={{ resize: 'vertical' }}
          />

          <button
            type="button"
            className="btn btn-primary"
            onClick={ask}
            disabled={loading}
            style={{ marginTop: '0.75rem' }}
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>

          {error ? (
            <p style={{ marginTop: '1rem', color: 'var(--danger)' }}>{error}</p>
          ) : null}

          {answer ? (
            <div
              style={{
                marginTop: '1rem',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '1rem',
                background: 'rgba(15, 23, 42, 0.35)',
              }}
            >
              <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                Assistant response
              </p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {answer}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Gpt;
