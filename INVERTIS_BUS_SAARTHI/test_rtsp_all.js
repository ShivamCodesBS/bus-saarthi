const net = require('net');

function checkPort(ip, port) {
  const socket = new net.Socket();
  socket.setTimeout(2000);
  socket.on('connect', () => {
    console.log(Port  is OPEN on !);
    socket.destroy();
  });
  socket.on('timeout', () => {
    socket.destroy();
  });
  socket.on('error', (err) => {
    socket.destroy();
  });
  socket.connect(port, ip);
}

checkPort('192.168.0.167', 554);
checkPort('192.168.0.185', 554);
checkPort('192.168.0.217', 554);
checkPort('192.168.0.1', 554);

setTimeout(() => { process.exit(0); }, 3000);
