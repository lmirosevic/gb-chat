//
//  app.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var thrift = require('thrift');
    ChatService = require('./gen-nodejs/ChatService');
    ttypes = require('./gen-nodejs/ChatService_types');
    nconf = require('nconf');

//just some testing
// var myErr = new ttypes.RequestError({type: ttypes.ErrorType.GENERIC, description: "magic"});
// console.log(myErr);

// Config
nconf.argv()
     .env()
     .file({file: './config/defaults.json'});

// Server implementation
var persistence = require('./persistence/' + nconf.get('PERSISTENCE').type);
var server = thrift.createServer(ChatService, {  
  alive: function(result) {
    result(null, '777');
  },
  isUsernameAvailable: function(username, result) {
    var isUsernameAvailable = persistence.userExists(username);

    result(null, isUsernameAvailable);
  },
  registerUsername: function(userId, username, result) {
    var registeredUserId;

    result(null, registeredUserId);
  },
  newChat: function(userId, chatMeta, result) {
    result(null);
  },
  chats: function(sorting, range, result) {
    var chats;

    result(null, chats);
  },
  chat: function(chatId, result) {
    var chat;

    result(null, chat);
  },
  newMessage: function(userId, chatId, message, result) {
    result(null);
  },
  messages: function(chatId, range, result) {
    var messages;

    result(null, messages);
  },
  setChatMeta: function(chatId, chatMeta, result) {
    result(null);
  },
  globalUserCount: function(result) {
    var globalUserCount;

    result(null, globalUserCount);
  },
});

// Start server
server.listen(nconf.get('PORT'));
console.log("Server started on port " + nconf.get('PORT'));

/*
gonna need:

database:
list of usernames
list of chats
list of messages

function:
way to generate unique userid

pluggable back end:
in-memory
redis

*/
