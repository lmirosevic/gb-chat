//
//  app.js
//  gb-chat
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

//lm might need to add a different message type like "status" to enable things like "luka change the room topic to 'blabla'"

var nconf = require('nconf'),
    api = require('gb-api'),
    GBChatService = require('./gen-nodejs/GoonbeeChatService'),
    ttypes = require('./gen-nodejs/GoonbeeChatService_types');

// Config
nconf.argv()
     .env()
     .file({file: './config/defaults.json'});

api.errors.setShouldLogOutput(nconf.get('LOG_OUTPUT'));
api.errors.setShouldLogCalls(nconf.get('LOG_CALLS'));
api.errors.setShouldLogErrors(nconf.get('LOG_ERRORS'));

// Error mapping from application -> thrift
api.errors.setErrorMapper(function(e) {
  if (e instanceof api.errors.errorTypes.GenericError) {
    return new ttypes.RequestError({status: ttypes.ResponseStatus.GENERIC, message: e.message});
  }
  else if (e instanceof api.errors.errorTypes.AuthenticationError) {
    return new ttypes.RequestError({status: ttypes.ResponseStatus.AUTHENTICATION, message: e.message});
  }
  else {
    return new ttypes.RequestError({status: ttypes.ResponseStatus.GENERIC, message: 'Unknown error occurred'}); 
  }
});

// Persistence layer
var persistence = require('./persistence/' + nconf.get('PERSISTENCE').type);

// Server implementation
var Service = function() {
  /** 
   * Goonbee Shared Thrift Service 
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

  this.setChatOptions = function(userId, chatId, chatOptions, result) {
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

  this.newChat = this.setChatOptions;// the implementation is identical to setChatOptions so it's implemented as an alias
};

// Start server
api.createThriftServer(GBChatService, new Service()).listen(nconf.get('PORT'));
console.log("Server started on port " + nconf.get('PORT'));
