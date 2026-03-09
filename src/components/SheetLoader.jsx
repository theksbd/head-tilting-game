import { useState } from 'react';

export default function SheetLoader({ onLoad }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function extractSheetId(link) {
    const match = link.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

    return match ? match[1] : null;
  }

  async function handleLoad() {
    setError('');

    const id = extractSheetId(url);

    if (!id) {
      setError('Invalid Google Sheet URL');
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`https://opensheet.elk.sh/${id}/Sheet1`);

      const data = await res.json();

      const formatted = data.map(row => ({
        question: row.question,
        left: row.a,
        right: row.b,
        correct: row.correct === 'a' ? 'left' : 'right'
      }));

      onLoad(formatted);
    } catch (e) {
      setError('Failed to load sheet');
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 500, margin: '20px auto' }}>
      <h3>Load Questions from Google Sheet</h3>

      <p>Sheet must contain columns:</p>

      <pre>question | a | b | correct</pre>

      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder='Paste Google Sheet URL here'
        style={{ width: '100%', padding: 8 }}
      />

      <button onClick={handleLoad} style={{ marginTop: 10 }}>
        {loading ? 'Loading...' : 'Load Questions'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
