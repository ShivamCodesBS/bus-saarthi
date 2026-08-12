const { spawn } = require('child_process');
require('dotenv').config();

const BUS_ID = process.env.BUS_ID || 'bus-123';
const RTSP_URL = process.env.RTSP_URL || 'https://www.w3schools.com/html/mov_bbb.mp4';
const CLOUD_RTMP_URL = process.env.CLOUD_RTMP_URL || `rtmp://localhost:1935/live/${BUS_ID}`;

let ffmpegProcess = null;

function startStream() {
  console.log(`Starting stream push for ${BUS_ID}...`);
  console.log(`Pulling from: ${RTSP_URL}`);
  console.log(`Pushing to: ${CLOUD_RTMP_URL}`);

  ffmpegProcess = spawn('ffmpeg', [
    '-stream_loop', '-1', // Loop the short video indefinitely
    '-re', // Read input at native frame rate (important for streaming a file)
    '-i', RTSP_URL,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    CLOUD_RTMP_URL
  ]);

  ffmpegProcess.stdout.on('data', (data) => {
    // console.log(`FFmpeg stdout: ${data}`);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`FFmpeg stderr: ${data}`);
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}. Reconnecting in 5 seconds...`);
    setTimeout(startStream, 5000);
  });
}

process.on('SIGINT', () => {
  console.log('Stopping stream push...');
  if (ffmpegProcess) ffmpegProcess.kill();
  process.exit();
});

startStream();
