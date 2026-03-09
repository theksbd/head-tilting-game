import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

export default function useFaceTilt(videoRef) {
  const [tilt, setTilt] = useState(null);

  const lastTiltRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const faceMesh = new FaceMesh({
      locateFile: file =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(results => {
      if (!results.multiFaceLandmarks?.length) return;

      const lm = results.multiFaceLandmarks[0];

      const leftEye = lm[33];
      const rightEye = lm[263];

      const diff = leftEye.y - rightEye.y;

      let direction = null;

      if (diff > 0.02) direction = 'right';
      if (diff < -0.02) direction = 'left';

      if (direction && direction !== lastTiltRef.current) {
        lastTiltRef.current = direction;
        setTilt(direction);
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await faceMesh.send({ image: videoRef.current });
      },
      width: 640,
      height: 480
    });

    camera.start();
  }, [videoRef]);

  return tilt;
}
