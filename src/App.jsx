import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh } from '@mediapipe/face_mesh';
import Papa from 'papaparse';
import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import './App.css';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function toCsvUrl(input) {
  // Thêm timestamp để bypass cache Google Sheet
  const base = input.includes('output=csv')
    ? input
    : (() => {
        const m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
        return m
          ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`
          : null;
      })();
  return base ? `${base}&t=${Date.now()}` : null;
}

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  vi: {
    appTitle: 'Nghiêng Đầu Trả Lời',
    appSub: 'Nhập link Google Sheet chứa câu hỏi để bắt đầu!',
    linkLabel: '🔗 Link Google Sheet',
    startBtn: '🚀 Bắt đầu chơi!',
    loadingBtn: '⏳ Đang tải câu hỏi...',
    errEmpty: 'Bạn chưa nhập link Google Sheet!',
    errInvalid: 'Link không hợp lệ. Hãy copy đúng link Google Sheet nhé!',
    errFetch:
      'Không tải được câu hỏi. Kiểm tra lại:\n• Sheet đã được chia sẻ công khai chưa?\n• File có đủ 4 cột: question, a, b, correct chưa?',
    guideTitle: '📋 Cách chuẩn bị Google Sheet',
    step1: 'Tạo Google Sheet với 4 cột:',
    step2: (
      <>
        Nhấn <b>File → Share → Publish to web</b> → chọn <b>CSV</b> →{' '}
        <b>Publish</b>
      </>
    ),
    step3: 'Copy link vừa tạo, dán vào ô trên',
    guideNote: (
      <>
        💡 Cột <b>correct</b> điền <b>a</b> hoặc <b>b</b> tương ứng đáp án đúng
      </>
    ),
    score: s => `⭐ Điểm: ${s}`,
    questionOf: (i, t) => `Câu ${i} / ${t}`,
    camLoading: '⏳ Đang khởi động camera...',
    faceOk: '🟢 Đã nhận diện khuôn mặt',
    faceNo: '🔴 Hãy nhìn vào camera nhé!',
    tiltLeft: 'Nghiêng TRÁI',
    tiltRight: 'Nghiêng PHẢI',
    correct: '🎉 Đúng rồi!',
    wrong: '❌ Sai rồi!',
    backBtn: '← Đổi câu hỏi',
    resultTitle: 'Kết quả',
    pct: p => `${p}% đúng`,
    msgGreat: 'Xuất sắc lắm! Bạn thật thông minh! 🌟',
    msgGood: 'Tốt lắm! Cố gắng thêm nhé! 😄',
    msgTry: 'Đừng nản! Luyện tập thêm nhé! 🌈',
    changeSheet: '🏠 Đổi câu hỏi',
    replay: '🔄 Chơi lại',
    switchLang: '🇬🇧 English',
    getReady: 'Chuẩn bị nào!'
  },
  en: {
    appTitle: 'Head Tilt Quiz',
    appSub: 'Enter your Google Sheet link to start!',
    linkLabel: '🔗 Google Sheet Link',
    startBtn: '🚀 Start Playing!',
    loadingBtn: '⏳ Loading questions...',
    errEmpty: 'Please enter a Google Sheet link!',
    errInvalid: 'Invalid link. Please copy the correct Google Sheet URL!',
    errFetch:
      'Could not load questions. Please check:\n• Is the sheet published publicly?\n• Does it have 4 columns: question, a, b, correct?',
    guideTitle: '📋 How to prepare your Google Sheet',
    step1: 'Create a Google Sheet with 4 columns:',
    step2: (
      <>
        Click <b>File → Share → Publish to web</b> → choose <b>CSV</b> →{' '}
        <b>Publish</b>
      </>
    ),
    step3: 'Copy the link and paste it above',
    guideNote: (
      <>
        💡 The <b>correct</b> column should be <b>a</b> or <b>b</b>
      </>
    ),
    score: s => `⭐ Score: ${s}`,
    questionOf: (i, t) => `Question ${i} / ${t}`,
    camLoading: '⏳ Starting camera...',
    faceOk: '🟢 Face detected',
    faceNo: '🔴 Please look at the camera!',
    tiltLeft: 'Tilt LEFT',
    tiltRight: 'Tilt RIGHT',
    correct: '🎉 Correct!',
    wrong: '❌ Wrong!',
    backBtn: '← Change questions',
    resultTitle: 'Results',
    pct: p => `${p}% correct`,
    msgGreat: "Outstanding! You're so smart! 🌟",
    msgGood: 'Good job! Keep it up! 😄',
    msgTry: "Don't give up! Keep practicing! 🌈",
    changeSheet: '🏠 Change questions',
    replay: '🔄 Play again',
    switchLang: '🇻🇳 Tiếng Việt',
    getReady: 'Get ready!'
  }
};

// ── Countdown Overlay ─────────────────────────────────────────────────────────
function Countdown({ onDone, lang }) {
  const [count, setCount] = useState(3);
  const t = T[lang];
  useEffect(() => {
    if (count === 0) {
      onDone();
      return;
    }
    const id = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, onDone]);
  return (
    <div className='countdown-overlay'>
      <div className='countdown-box'>
        <div className='countdown-label'>{t.getReady}</div>
        <div className='countdown-num'>{count === 0 ? '🎮' : count}</div>
      </div>
    </div>
  );
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onStart, lang, setLang }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const t = T[lang];

  async function handleLoad() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t.errEmpty);
      return;
    }
    const csvUrl = toCsvUrl(trimmed);
    if (!csvUrl) {
      setError(t.errInvalid);
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
      setError(t.errFetch);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='ss-page'>
      <div className='ss-card'>
        <button
          className='lang-btn'
          onClick={() => setLang(l => (l === 'vi' ? 'en' : 'vi'))}
        >
          {t.switchLang}
        </button>
        <div className='ss-icon'>🎯</div>
        <h1 className='ss-title'>{t.appTitle}</h1>
        <p className='ss-sub'>{t.appSub}</p>
        <label className='ss-label'>{t.linkLabel}</label>
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
          {loading ? t.loadingBtn : t.startBtn}
        </button>
        <div className='ss-guide'>
          <div className='ss-guide-title'>{t.guideTitle}</div>
          <div className='ss-steps'>
            <div className='ss-step'>
              <span className='ss-step-num'>1</span> {t.step1}
            </div>
            <pre className='ss-code'>{`question      | a    | b   | correct\n2 + 3 = ?    | 4    | 5   | b\nSky color?   | Blue | Red | a`}</pre>
            <div className='ss-step'>
              <span className='ss-step-num'>2</span> {t.step2}
            </div>
            <div className='ss-step'>
              <span className='ss-step-num'>3</span> {t.step3}
            </div>
          </div>
          <div className='ss-note'>{t.guideNote}</div>
        </div>
      </div>
    </div>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ questions: raw, onBack, lang, setLang }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lockedRef = useRef(false);
  const indexRef = useRef(0);
  const cameraRef = useRef(null);

  const [questions] = useState(() => shuffle(raw));
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [tiltDir, setTiltDir] = useState(null);
  const [counting, setCounting] = useState(true);
  const countingRef = useRef(true); // ref để tránh stale closure trong FaceMesh callback
  const TOTAL = questions.length;
  const t = T[lang];

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
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

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
        const rx = (1 - x1) * w,
          rw = (x1 - x0) * w;
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(rx - 10, y0 * h - 10, rw + 20, (y1 - y0) * h + 20, 12);
        ctx.stroke();
        if (lockedRef.current || countingRef.current) return;
        const tilt = lm[263].y - lm[33].y;
        if (tilt > 0.04) {
          setTiltDir('left');
          answerRef.current('a');
        } else if (tilt < -0.04) {
          setTiltDir('right');
          answerRef.current('b');
        } else setTiltDir(null);
      });
      camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current?.video)
            await fm.send({ image: webcamRef.current.video });
        },
        width: 700,
        height: 525
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
    const msg = pct >= 80 ? t.msgGreat : pct >= 50 ? t.msgGood : t.msgTry;
    return (
      <div className='gs-gameover-wrap'>
        <div className='gs-gameover-card'>
          <button
            className='lang-btn lang-btn-gameover'
            onClick={() => setLang(l => (l === 'vi' ? 'en' : 'vi'))}
          >
            {t.switchLang}
          </button>
          <div className='gs-gameover-emoji'>{emoji}</div>
          <h1 className='gs-gameover-title'>{t.resultTitle}</h1>
          <div className='gs-gameover-score'>
            {score} / {TOTAL}
          </div>
          <div className='gs-gameover-pct'>{t.pct(pct)}</div>
          <p className='gs-gameover-msg'>{msg}</p>
          <div className='gs-gameover-btns'>
            <button
              className='gs-replay-btn secondary'
              onClick={() => onBack('back')}
            >
              {t.changeSheet}
            </button>
            <button className='gs-replay-btn' onClick={() => onBack('replay')}>
              {t.replay}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className='gs-page' style={{ position: 'relative' }}>
      {/* Countdown overlay */}
      {counting && (
        <Countdown
          lang={lang}
          onDone={() => {
            countingRef.current = false;
            setCounting(false);
          }}
        />
      )}

      <button className='gs-back-btn' onClick={() => onBack('back')}>
        {t.backBtn}
      </button>
      <button
        className='lang-btn lang-btn-game'
        onClick={() => setLang(l => (l === 'vi' ? 'en' : 'vi'))}
      >
        {t.switchLang}
      </button>

      <div className='gs-title-row'>
        <h1 className='gs-title'>🎮 {t.appTitle}</h1>
      </div>

      {/* Score + question counter */}
      <div className='gs-topbar'>
        <div className='gs-score'>{t.score(score)}</div>
        <div className='gs-q-counter'>{t.questionOf(index + 1, TOTAL)}</div>
      </div>

      <div className='gs-cam-wrap'>
        <Webcam
          ref={webcamRef}
          className='gs-webcam'
          mirrored
          videoConstraints={{ width: 700, height: 525 }}
        />
        <canvas
          ref={canvasRef}
          width={700}
          height={525}
          className='gs-overlay'
        />
      </div>

      <div className='gs-face-status'>
        {!camReady ? (
          t.camLoading
        ) : faceDetected ? (
          <span className='gs-face-ok'>{t.faceOk}</span>
        ) : (
          <span className='gs-face-no'>{t.faceNo}</span>
        )}
      </div>

      <div className='gs-q-card'>{q.question}</div>

      <div className='gs-answers'>
        <div
          className={`gs-answer gs-ans-l ${
            result && q.correct === 'a' ? 'gs-correct-hl' : ''
          } ${result === 'wrong' && tiltDir === 'left' ? 'gs-wrong-hl' : ''}`}
        >
          <div className='gs-ans-dir'>⬅️ {t.tiltLeft}</div>
          <div className='gs-ans-text'>{q.a}</div>
        </div>
        <div
          className={`gs-answer gs-ans-r ${
            result && q.correct === 'b' ? 'gs-correct-hl' : ''
          } ${result === 'wrong' && tiltDir === 'right' ? 'gs-wrong-hl' : ''}`}
        >
          <div className='gs-ans-dir'>{t.tiltRight} ➡️</div>
          <div className='gs-ans-text'>{q.b}</div>
        </div>
      </div>

      <div className='gs-result-area'>
        {result === 'correct' && (
          <div className='gs-result-popup gs-correct-pop bounce-in'>
            {t.correct}
          </div>
        )}
        {result === 'wrong' && (
          <div className='gs-result-popup gs-wrong-pop shake'>{t.wrong}</div>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [questions, setQuestions] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const [lang, setLang] = useState('vi');

  function handleBack(action) {
    if (action === 'replay') setGameKey(k => k + 1);
    else setQuestions(null);
  }

  return (
    <div>
      {questions ? (
        <GameScreen
          key={gameKey}
          questions={questions}
          onBack={handleBack}
          lang={lang}
          setLang={setLang}
        />
      ) : (
        <SetupScreen
          onStart={q => {
            setGameKey(0);
            setQuestions(q);
          }}
          lang={lang}
          setLang={setLang}
        />
      )}
    </div>
  );
}
