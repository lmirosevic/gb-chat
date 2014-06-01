//
//  app.js
//  gb-chat
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

//lm might need to add a different message type like "status" to enable things like "luka change the room topic to 'blabla'"
//lm add heartbeat oneway message

var nconf = require('nconf'),
    api = require('gb-api'),
    GBChatService = require('./thrift/gen-nodejs/GoonbeeChatService'),
    ttypes = require('./thrift/gen-nodejs/GoonbeeChatService_types'),
    ttypesShared = require('./thrift/gen-nodejs/GoonbeeShared_types');

// Config
nconf.argv()
     .env()
     .file({file: './config/defaults.json'});

api.errors.setShouldLogOutput(nconf.get('LOG_OUTPUT'));
api.errors.setShouldLogCalls(nconf.get('LOG_CALLS'));
api.errors.setShouldLogErrors(nconf.get('LOG_ERRORS'));

// Error mapping from application -> thrift
api.errors.setErrorMapping(
  {
    GenericError: ttypesShared.ResponseStatus.GENERIC,
    MalformedRequestError: ttypesShared.ResponseStatus.MALFORMED_REQUEST,
    AuthenticationError: ttypesShared.ResponseStatus.AUTHENTICATION,
    AuthorizationError: ttypesShared.ResponseStatus.AUTHORIZATION,
    PhasedOutError: ttypesShared.ResponseStatus.PHASED_OUT,
  },
  function(status, message) {
    return new ttypesShared.RequestError({status: status, message: message});// passes through original error message to client, this is desired in the case of the mapped errors above
  },
  new ttypesShared.RequestError({status: ttypesShared.ResponseStatus.GENERIC, message: 'A generic error occured.'})
);

// Persistence layer
var persistence = require('./lib/persistence/' + nconf.get('PERSISTENCE').type);

// Server implementation
var ChatServiceImplementation = function() {
  /** 
   * GoonbeeShared BaseService 
   */

  this.alive = function(result) {
    result('777');
  };

  /** 
   * Goonbee Chat Service 
   */

  this.isUsernameAvailable = function(username, result) {
    persistence.isUsernameAvailable(username, result);
  };

  this.registerUsername = function(userId, username, result) {
    persistence.setUser(userId, username, result);
  };

  this.setChatOptions = this.newChat = function(userId, chatId, chatOptions, result) {
    persistence.setChatOptions(userId, chatId, chatOptions, result);
  };

  this.chats = function(sorting, range, result) {
    persistence.getChats(sorting, range, result);
  };

  this.chat = function(userId, chatId, result) {
    persistence.getChat(userId, chatId, result);
  };

  this.newMessage = function(userId, chatId, content, result) {
    persistence.newMessage(userId, chatId, content, result);
  };

  this.messages = function(userId, chatId, range, result) {
    persistence.getMessages(userId, chatId, range, result);
  };

  this.globalUserCount = function(result) {
    persistence.getUserCount(result);
  };
};

// Start server
api.createThriftServer(GBChatService, new ChatServiceImplementation()).listen(nconf.get('PORT'));
console.log("Chat server started on port " + nconf.get('PORT'));
