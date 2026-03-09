import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import Papa from 'papaparse';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import './AppV2.css';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function toCsvUrl(input) {
  if (input.includes('output=csv')) return input;
  const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m
    ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`
    : null;
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLoad() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Bạn chưa nhập link Google Sheet!');
      return;
    }
    const csvUrl = toCsvUrl(trimmed);
    if (!csvUrl) {
      setError('Link không hợp lệ. Hãy copy đúng link Google Sheet nhé!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error();
      const text = await res.text();
      const clean = Papa.parse(text.trim(), {
        header: true,
        skipEmptyLines: true
      }).data.filter(r => r.question && r.a && r.b && r.correct);
      if (!clean.length) throw new Error('empty');
      onStart(clean);
    } catch {
      setError(
        'Không tải được câu hỏi. Kiểm tra lại:\n• Sheet đã được chia sẻ công khai chưa?\n• File có đủ 4 cột: question, a, b, correct chưa?'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='ss-page'>
      <div className='ss-card'>
        <div className='ss-icon'>🎯</div>
        <h1 className='ss-title'>Nghiêng Đầu Trả Lời</h1>
        <p className='ss-sub'>
          Nhập link Google Sheet chứa câu hỏi để bắt đầu!
        </p>

        <label className='ss-label'>🔗 Link Google Sheet</label>
        <input
          className='ss-input'
          type='text'
          placeholder='https://docs.google.com/spreadsheets/d/...'
          value={url}
          onChange={e => {
            setUrl(e.target.value);
            setError('');
          }}
          onKeyDown={e => e.key === 'Enter' && handleLoad()}
        />

        {error && (
          <div className='ss-error'>
            {error.split('\n').map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}

        <button className='ss-btn' onClick={handleLoad} disabled={loading}>
          {loading ? '⏳ Đang tải câu hỏi...' : '🚀 Bắt đầu chơi!'}
        </button>

        <div className='ss-guide'>
          <div className='ss-guide-title'>📋 Cách chuẩn bị Google Sheet</div>
          <div className='ss-steps'>
            <div className='ss-step'>
              <span className='ss-step-num'>1</span> Tạo Google Sheet với 4 cột:
            </div>
            <pre className='ss-code'>{`question        | a    | b    | correct\n2 + 3 = ?      | 4    | 5    | b\nMàu trời là?   | Xanh | Đỏ   | a`}</pre>
            <div className='ss-step'>
              <span className='ss-step-num'>2</span> Nhấn{' '}
              <b>File → Share → Publish to web</b> → chọn <b>CSV</b> →{' '}
              <b>Publish</b>
            </div>
            <div className='ss-step'>
              <span className='ss-step-num'>3</span> Copy link vừa tạo, dán vào
              ô trên
            </div>
          </div>
          <div className='ss-note'>
            💡 Cột <b>correct</b> điền <b>a</b> hoặc <b>b</b> tương ứng đáp án
            đúng
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ questions: raw, onBack }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lockedRef = useRef(false);
  const indexRef = useRef(0);

  const [questions] = useState(() => shuffle(raw));
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [tiltDir, setTiltDir] = useState(null);
  const TOTAL = questions.length;

  const answer = useCallback(
    choice => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      const correct = choice === questions[indexRef.current].correct;
      setResult(correct ? 'correct' : 'wrong');
      if (correct) setScore(s => s + 1);
      setTimeout(() => {
        setResult(null);
        setTiltDir(null);
        const next = indexRef.current + 1;
        if (next >= TOTAL) {
          setGameOver(true);
        } else {
          indexRef.current = next;
          setIndex(next);
        }
        lockedRef.current = false;
      }, 2000);
    },
    [questions, TOTAL]
  );

  useEffect(() => {
    let camera;
    const init = () => {
      if (!webcamRef.current?.video) {
        setTimeout(init, 500);
        return;
      }
      const fm = new FaceMesh({
        locateFile: f =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      fm.onResults(res => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!res.multiFaceLandmarks?.length) {
          setFaceDetected(false);
          return;
        }
        setFaceDetected(true);
        const lm = res.multiFaceLandmarks[0];
        let x0 = 1,
          y0 = 1,
          x1 = 0,
          y1 = 0;
        lm.forEach(p => {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        });
        const [w, h] = [canvas.width, canvas.height];
        ctx.strokeStyle = 'rgba(0,220,150,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(
          x0 * w - 10,
          y0 * h - 10,
          (x1 - x0) * w + 20,
          (y1 - y0) * h + 20,
          12
        );
        ctx.stroke();
        if (lockedRef.current) return;
        const tilt = lm[263].y - lm[33].y;
        if (tilt > 0.04) {
          setTiltDir('left');
          answer('a');
        } else if (tilt < -0.04) {
          setTiltDir('right');
          answer('b');
        } else setTiltDir(null);
      });
      camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current?.video)
            await fm.send({ image: webcamRef.current.video });
        },
        width: 440,
        height: 330
      });
      camera.start().then(() => setCamReady(true));
    };
    init();
    return () => camera?.stop();
  }, []);

  if (gameOver) {
    const pct = Math.round((score / TOTAL) * 100);
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '😊' : '💪';
    const msg =
      pct >= 80
        ? 'Xuất sắc lắm! Bạn thật thông minh! 🌟'
        : pct >= 50
        ? 'Tốt lắm! Cố gắng thêm nhé! 😄'
        : 'Đừng nản! Luyện tập thêm nhé! 🌈';
    return (
      <div className='gs-gameover-wrap'>
        <div className='gs-gameover-card'>
          <div className='gs-gameover-emoji'>{emoji}</div>
          <h1 className='gs-gameover-title'>Kết quả</h1>
          <div className='gs-gameover-score'>
            {score} / {TOTAL}
          </div>
          <div className='gs-gameover-pct'>{pct}% đúng</div>
          <p className='gs-gameover-msg'>{msg}</p>
          <div className='gs-gameover-btns'>
            <button className='gs-replay-btn secondary' onClick={onBack}>
              🏠 Đổi câu hỏi
            </button>
            <button
              className='gs-replay-btn'
              onClick={() => {
                indexRef.current = 0;
                setIndex(0);
                setScore(0);
                setGameOver(false);
                lockedRef.current = false;
              }}
            >
              🔄 Chơi lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const aCorrect = result && q.correct === 'a',
    bCorrect = result && q.correct === 'b';
  const aWrong = result === 'wrong' && tiltDir === 'left',
    bWrong = result === 'wrong' && tiltDir === 'right';

  return (
    <div className='gs-page'>
      <div className='gs-header'>
        <button className='gs-back-btn' onClick={onBack}>
          ← Đổi câu hỏi
        </button>
        <h1 className='gs-title'>🎯 Nghiêng Đầu Trả Lời</h1>
        <div className='gs-score-badge'>⭐ {score} điểm</div>
      </div>

      <div className='gs-progress-row'>
        <div className='gs-progress-bar'>
          <div
            className='gs-progress-fill'
            style={{ width: `${(index / TOTAL) * 100}%` }}
          />
        </div>
        <span className='gs-progress-txt'>
          {index + 1} / {TOTAL}
        </span>
      </div>

      <div className='gs-layout'>
        <div className='gs-cam-section'>
          <div className='gs-cam-wrap'>
            <Webcam
              ref={webcamRef}
              className='gs-webcam'
              mirrored
              videoConstraints={{ width: 440, height: 330 }}
            />
            <canvas
              ref={canvasRef}
              width={440}
              height={330}
              className='gs-overlay'
            />
            <div
              className='gs-arrow gs-arrow-l'
              style={{ opacity: tiltDir === 'left' ? 1 : 0.22 }}
            >
              ⬅️
            </div>
            <div
              className='gs-arrow gs-arrow-r'
              style={{ opacity: tiltDir === 'right' ? 1 : 0.22 }}
            >
              ➡️
            </div>
          </div>
          <div className='gs-face-status'>
            {!camReady ? (
              '⏳ Đang khởi động camera...'
            ) : faceDetected ? (
              <span style={{ color: '#0be881' }}>
                🟢 Đã nhận diện khuôn mặt
              </span>
            ) : (
              <span style={{ color: '#ff7675' }}>
                🔴 Hãy nhìn vào camera nhé!
              </span>
            )}
          </div>
        </div>

        <div className='gs-q-section'>
          <div className='gs-q-card'>
            <div className='gs-q-num'>
              Câu {index + 1} / {TOTAL}
            </div>
            <div className='gs-q-text'>{q.question}</div>
          </div>
          <div className='gs-hint'>Nghiêng đầu để chọn!</div>
          <div className='gs-answers'>
            <div
              className={`gs-answer gs-ans-l ${
                aCorrect ? 'gs-correct-hl' : ''
              } ${aWrong ? 'gs-wrong-hl' : ''}`}
            >
              <div className='gs-ans-arrow'>⬅️</div>
              <div className='gs-ans-label'>Nghiêng TRÁI</div>
              <div className='gs-ans-text'>{q.a}</div>
            </div>
            <div
              className={`gs-answer gs-ans-r ${
                bCorrect ? 'gs-correct-hl' : ''
              } ${bWrong ? 'gs-wrong-hl' : ''}`}
            >
              <div className='gs-ans-arrow'>➡️</div>
              <div className='gs-ans-label'>Nghiêng PHẢI</div>
              <div className='gs-ans-text'>{q.b}</div>
            </div>
          </div>
          <div className='gs-result-area'>
            {result === 'correct' && (
              <div className='gs-result-popup gs-correct-pop bounce-in'>
                🎉 Đúng rồi! Giỏi quá!
              </div>
            )}
            {result === 'wrong' && (
              <div className='gs-result-popup gs-wrong-pop shake'>
                ❌ Sai rồi! Cố lên!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AppV2() {
  const [questions, setQuestions] = useState(null);
  return questions ? (
    <GameScreen questions={questions} onBack={() => setQuestions(null)} />
  ) : (
    <SetupScreen onStart={setQuestions} />
  );
}
