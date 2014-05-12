//
//  app.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

//lm think about potentially versioning the API calls explicitly
//lm might need to add a different message type like "status" to enable things like "luka change the room topic to 'blabla'"
//lm clean up the requires, right now it breaks LoD

var _ = require('underscore'),
    nconf = require('nconf'),
    thrift = require('thrift'),
    GB = require('./lib/Goonbee/toolbox'),
    errors = require('./lib/Chat/errors'),
    GBChatService = require('./gen-nodejs/GoonbeeChatService'),
    ttypes = require('./gen-nodejs/GoonbeeChatService_types');


// Config
nconf.argv()
     .env()
     .file({file: './config/defaults.json'});

errors.setShouldLogOutput(nconf.get('LOG_OUTPUT'));
errors.setShouldLogCalls(nconf.get('LOG_CALLS'));
errors.setShouldLogErrors(nconf.get('LOG_ERRORS'));

// Persistence layer
var persistence = require('./persistence/' + nconf.get('PERSISTENCE').type);

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
    persistence.isUsernameAvailable(username, result);
  },
  registerUsername: function(userId, username, result) {
    persistence.setUser(userId, username, result);
  },
  setChatOptions: function(userId, chatId, chatOptions, result) {
    chatOptions = GB.optional(chatOptions, {});
    chatOptions.name = GB.optional(chatOptions.name, nconf.get('DEFAULT_CHAT_NAME'));

    persistence.setChatOptions(userId, chatId, chatOptions, result);
  },
  chats: function(sorting, range, result) {
    persistence.getChats(sorting, range, result);
  },
  chat: function(userId, chatId, result) {
    persistence.getChat(userId, chatId, result);
  },
  newMessage: function(userId, chatId, content, result) {
    persistence.newMessage(userId, chatId, content, result);
  },
  messages: function(userId, chatId, range, result) {
    persistence.getMessages(userId, chatId, range, result);
  },
  globalUserCount: function(result) {
    persistence.getUserCount(result);
  },
};
api.newChat = api.setChatOptions;// the implementation is identical to setChatOptions so it's implemented as an alias

// Start server
thrift.createServer(GBChatService, errors.errorHandledAPI(api)).listen(nconf.get('PORT'));
console.log("Server started on port " + nconf.get('PORT'));
