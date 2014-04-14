var net = require('net'),
	http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('777');
}).listen(80);

net.createServer(function (socket) {
  socket.write('Welcome to echo server 443\r\n');
  socket.pipe(socket);
}).listen(443);

net.createServer(function (socket) {
  socket.write('Welcome to echo server 56475\r\n');
  socket.pipe(socket);
}).listen(56475);
