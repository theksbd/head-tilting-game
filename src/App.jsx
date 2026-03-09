import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import './App.css';

const questions = [
  {
    question: "Con vật nào kêu 'meo meo'?",
    a: '🐱 Con mèo',
    b: '🐔 Con gà'
  },
  {
    question: '2 + 3 bằng bao nhiêu?',
    a: '5',
    b: '6'
  },
  {
    question: 'Trái cây nào có màu vàng?',
    a: '🍌 Chuối',
    b: '🍉 Dưa hấu'
  }
];

export default function App() {
  const webcamRef = useRef(null);
  const [index] = useState(0);
  const q = questions[index];

  return (
    <div className='game-container'>
      <h1 className='title'>🎮 Head Tilt Quiz</h1>

      <div className='camera-box'>
        <Webcam ref={webcamRef} className='webcam' />
      </div>

      <div className='question-card'>
        <h2>{q.question}</h2>
      </div>

      <div className='answers'>
        <div className='answer left'>
          ⬅️ Nghiêng trái
          <p>{q.a}</p>
        </div>

        <div className='answer right'>
          Nghiêng phải ➡️
          <p>{q.b}</p>
        </div>
      </div>
    </div>
  );
}
