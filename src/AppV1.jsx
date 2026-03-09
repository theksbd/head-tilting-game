import { useState, useRef, useEffect } from 'react';
import CameraFeed from './components/CameraFeed';
import useFaceTilt from './hooks/useFaceTilt';
import SheetLoader from './components/SheetLoader';

export default function AppV1() {
  const videoRef = useRef(null);

  const tilt = useFaceTilt(videoRef);

  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);

  function answer(direction) {
    if (locked || !questions.length) return;

    setLocked(true);

    const q = questions[index];

    if (direction === q.correct) {
      setScore(s => s + 1);
    }

    setTimeout(() => {
      setIndex(i => (i + 1) % questions.length);
      setLocked(false);
    }, 2000);
  }

  useEffect(() => {
    if (!tilt) return;

    answer(tilt);
  }, [tilt]);

  if (!questions.length) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h1>Head Tilt Quiz</h1>

        <SheetLoader onLoad={setQuestions} />
      </div>
    );
  }

  const q = questions[index];

  return (
    <div style={{ textAlign: 'center' }}>
      <h2>{q.question}</h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
        <div>⬅ {q.left}</div>
        <div>{q.right} ➡</div>
      </div>

      <p>Score: {score}</p>

      <CameraFeed videoRef={videoRef} />
    </div>
  );
}
