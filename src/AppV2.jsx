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
  const cameraRef = useRef(null);
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
          cameraRef.current?.stop();
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
        // Mirror X để khớp với webcam đã mirror
        const rx = (1 - x1) * w;
        const rw = (x1 - x0) * w;
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(rx - 10, y0 * h - 10, rw + 20, (y1 - y0) * h + 20, 12);
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
        width: 640,
        height: 480
      });
      camera.start().then(() => {
        cameraRef.current = camera;
        setCamReady(true);
      });
    };
    init();
    return () => {
      camera?.stop();
      cameraRef.current = null;
    };
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
            <button
              className='gs-replay-btn secondary'
              onClick={() => onBack('back')}
            >
              🏠 Đổi câu hỏi
            </button>
            <button className='gs-replay-btn' onClick={() => onBack('replay')}>
              🔄 Chơi lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className='gs-page' style={{ position: 'relative' }}>
      <button className='gs-back-btn' onClick={() => onBack('back')}>
        ← Đổi câu hỏi
      </button>

      {/* Title */}
      <div className='gs-title-row'>
        <h1 className='gs-title'>🎮 Nghiêng Đầu Trả Lời</h1>
      </div>

      {/* Score */}
      <div className='gs-score'>⭐ Điểm: {score}</div>

      {/* Camera */}
      <div className='gs-cam-wrap'>
        <Webcam
          ref={webcamRef}
          className='gs-webcam'
          mirrored
          videoConstraints={{ width: 640, height: 480 }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className='gs-overlay'
        />
      </div>

      {/* Face status */}
      <div className='gs-face-status'>
        {!camReady ? (
          '⏳ Đang khởi động camera...'
        ) : faceDetected ? (
          <span className='gs-face-ok'>🟢 Đã nhận diện khuôn mặt</span>
        ) : (
          <span className='gs-face-no'>🔴 Hãy nhìn vào camera nhé!</span>
        )}
      </div>

      {/* Question */}
      <div className='gs-q-card'>{q.question}</div>

      {/* Answers */}
      <div className='gs-answers'>
        <div
          className={`gs-answer gs-ans-l ${
            result && q.correct === 'a' ? 'gs-correct-hl' : ''
          } ${result === 'wrong' && tiltDir === 'left' ? 'gs-wrong-hl' : ''}`}
        >
          ⬅️ {q.a}
        </div>
        <div
          className={`gs-answer gs-ans-r ${
            result && q.correct === 'b' ? 'gs-correct-hl' : ''
          } ${result === 'wrong' && tiltDir === 'right' ? 'gs-wrong-hl' : ''}`}
        >
          {q.b} ➡️
        </div>
      </div>

      {/* Result */}
      <div className='gs-result-area'>
        {result === 'correct' && (
          <div className='gs-result-popup gs-correct-pop bounce-in'>
            🎉 Đúng rồi!
          </div>
        )}
        {result === 'wrong' && (
          <div className='gs-result-popup gs-wrong-pop shake'>❌ Sai rồi!</div>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AppV2() {
  const [questions, setQuestions] = useState(null);
  const [gameKey, setGameKey] = useState(0);

  function handleBack(action) {
    if (action === 'replay') setGameKey(k => k + 1);
    else setQuestions(null);
  }

  return questions ? (
    <GameScreen key={gameKey} questions={questions} onBack={handleBack} />
  ) : (
    <SetupScreen
      onStart={q => {
        setGameKey(0);
        setQuestions(q);
      }}
    />
  );
}
