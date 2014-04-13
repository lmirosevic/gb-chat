var net = require('net'),
	http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('777');
}).listen(80);

net.createServer(function (socket) {
  socket.write('Welcome to echo server\r\n');
  socket.pipe(socket);
}).listen(1337);
