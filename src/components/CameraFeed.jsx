export default function CameraFeed({ videoRef }) {
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{
        width: '400px',
        borderRadius: '10px'
      }}
    />
  );
}
