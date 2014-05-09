//
//  app.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

//lm think about potentially versioning the API calls explicitly
//lm might need to add a different message type like "status" to enable things like "luka change the room topic to 'blabla'"

// npm modules
var thrift = require('thrift');
    nconf = require('nconf');
    _ = require('underscore');

// standard library
var crypto = require('crypto');

// vendored libs
var GB = require('./lib/Goonbee/toolbox');
    errors = require('./lib/Chat/errors');

// app specific
var GBChatService = require('./gen-nodejs/GoonbeeChatService');
    ttypes = require('./gen-nodejs/GoonbeeChatService_types');


// Config
nconf.argv()
     .env()
     .file({file: './config/defaults.json'});

errors.setShouldLogOutput(nconf.get('LOG_OUTPUT'));

// Persistence layer
var persistence = require('./persistence/' + nconf.get('PERSISTENCE').type);
persistence.setHashingFunction(function(input) {
  var hashInput = input.toString() + nconf.get('HASHING_SALT');
  return hashInput;//lm testing, kill
  return crypto.createHash('sha1').update(hashInput).digest('hex');
});

// Server implementation
var api = {
  /** 
   * Goonbee Shared Thrift Service 
   */

  alive: function(result) {
    result('777');
  },

  /** 
   * Goonbee Chat Service 
   */

  isUsernameAvailable: function(username, result) {
    var isUsernameAvailable = !persistence.userExists(username);

    result(isUsernameAvailable);
  },
  registerUsername: function(userId, username, result) {
    var registeredUserId = persistence.setUser(userId, username);

    result(registeredUserId);
  },
  setChatOptions: function(userId, chatId, chatOptions, result) {
    // some overrides
    chatOptions.name = chatOptions.name || nconf.get('DEFAULT_CHAT_NAME');

    var chat = persistence.setChatOptions(userId, chatId, chatOptions);

    result(chat);
  },
  chats: function(sorting, range, result) {
    var chats = persistence.getChats(sorting, range);

    result(chats);
  },
  chat: function(userId, chatId, result) {
    var chat = persistence.getChat(userId, chatId);

    result(chat);
  },
  newMessage: function(userId, chatId, content, result) {
    persistence.newMessage(userId, chatId, content);

    result();
  },
  messages: function(userId, chatId, range, result) {
    var messages = persistence.getMessages(userId, chatId, range);

    result(messages);
  },
  globalUserCount: function(result) {
    var globalUserCount = persistence.getUserCount();

    result(globalUserCount);
  },
};
api.newChat = api.setChatOptions;//the implementation is identical to setChatOptions so it's implemented as an alias

// Start server
thrift.createServer(GBChatService, errors.errorHandledAPI(api)).listen(nconf.get('PORT'));
console.log("Server started on port " + nconf.get('PORT'));

//need to clean up the requires, right now it breaks LoD

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
