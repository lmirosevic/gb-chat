//
//  server.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

//fix this importing stuff so npm can find the thrift module

var thrift = require('thrift'),
    ChatService = require('./gen-nodejs/ChatService');
    ttypes = require('./gen-nodejs/ChatService_types');
    // SharedStruct = require("./gen-nodejs/shared_types").SharedStruct;

var server = thrift.createServer(ChatService, {  
  isUsernameAvailable: function(username) {
    return true;
  },
});

server.listen(443);//lm make this configurable










// var net = require('net'),
//   http = require('http');

// http.createServer(function (req, res) {
//   res.writeHead(200, {'Content-Type': 'text/plain'});
//   res.end('777');
// }).listen(80);

// net.createServer(function (socket) {
//   socket.write('Welcome to echo server 443\r\n');
//   socket.pipe(socket);
// }).listen(443);