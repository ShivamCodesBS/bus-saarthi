const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

const msg = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?>\r\n' +
  '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">\r\n' +
  '<e:Header>\r\n' +
  '<w:MessageID>uuid:84ede3de-7dec-11d0-c360-F01234567890</w:MessageID>\r\n' +
  '<w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>\r\n' +
  '<w:Action a:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>\r\n' +
  '</e:Header>\r\n' +
  '<e:Body>\r\n' +
  '<d:Probe>\r\n' +
  '<d:Types>dn:NetworkVideoTransmitter</d:Types>\r\n' +
  '</d:Probe>\r\n' +
  '</e:Body>\r\n' +
  '</e:Envelope>'
);

socket.on('message', (msg, rinfo) => {
  console.log('Found camera at IP:', rinfo.address);
  process.exit(0);
});

// Bind explicitly to the Ethernet IP so the multicast packet goes out the Ethernet port
socket.bind(0, '10.20.10.150', () => {
  socket.setBroadcast(true);
  socket.setMulticastInterface('10.20.10.150');
  socket.send(msg, 0, msg.length, 3702, '239.255.255.250');
  console.log('Sent ONVIF discovery probe on Ethernet (10.20.10.150), waiting 5 seconds...');
  setTimeout(() => {
    console.log('No cameras found via ONVIF.');
    process.exit(1);
  }, 5000);
});
