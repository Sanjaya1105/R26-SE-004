import axios from 'axios';
import { getGatewayBaseUrl } from '../config/gateway';

function buildGenerateUrls() {
  const base = getGatewayBaseUrl();
  return [
    `${base}/api/gpt/images/generate`,
    `http://localhost:4000/api/gpt/images/generate`,
    `http://127.0.0.1:4000/api/gpt/images/generate`,
    `http://localhost:5002/api/gpt/images/generate`,
  ].filter((url, i, arr) => arr.indexOf(url) === i);
}

/**
 * @param {object} payload
 * @param {string} payload.lessonText
 * @param {string} [payload.studentAge]
 * @param {string} [payload.imageStyle]
 * @param {string} [payload.language]
 * @param {string} token JWT
 */
export async function generateEducationalVisual(payload, token) {
  const urls = buildGenerateUrls();
  let lastErr;
  for (const url of urls) {
    try {
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 600000,
      });
      return res.data?.data ?? res.data;
    } catch (e) {
      lastErr = e;
      if (e.response?.status === 404) continue;
      const st = e.response?.status;
      if (st === 504 || st === 502 || st === 503) continue;
      if (!e.response && e.code === 'ERR_NETWORK') continue;
      throw e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('No reachable API for educational visuals.');
}
