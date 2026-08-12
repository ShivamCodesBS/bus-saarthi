const dgram = require('dgram');

function listenPort(port) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', (msg, rinfo) => {
    console.log([Port ] Received packet from: :);
    console.log(msg.toString().substring(0, 200));
  });
  socket.bind(port, '0.0.0.0', () => {
    console.log(Listening for broadcasts on port ...);
    try {
      if (port === 3702) socket.addMembership('239.255.255.250');
      if (port === 1900) socket.addMembership('239.255.255.250');
    } catch(e) {}
  });
}

listenPort(3702); // WS-Discovery (ONVIF)
listenPort(1900); // SSDP / UPnP
listenPort(37810); // Dahua / CP Plus Discovery

setTimeout(() => {
  console.log("Discovery listening timeout after 15 seconds.");
  process.exit(0);
}, 15000);
