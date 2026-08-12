const net = require('net');
const socket = new net.Socket();
socket.setTimeout(2000);
socket.on('connect', () => {
  console.log('Port 554 is OPEN! This is the camera.');
  socket.destroy();
  process.exit(0);
});
socket.on('timeout', () => {
  console.log('Timeout');
  socket.destroy();
  process.exit(1);
});
socket.on('error', (err) => {
  console.log('Error:', err.message);
  process.exit(1);
});
socket.connect(554, '192.168.0.167');
