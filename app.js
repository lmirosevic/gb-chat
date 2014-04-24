//
//  app.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

// npm modules
var thrift = require('thrift');
    nconf = require('nconf');

// standard library
var crypto = require('crypto');

// vendored libs
var GB = require('./lib/Goonbee/toolbox');
    errors = require('./lib/Chat/errors');

// app specific
var GBChatService = require('./gen-nodejs/GoonbeeChatService');
    ttypes = require('./gen-nodejs/GoonbeeChatService_types');
    
//just some testing
// var myErr = new ttypes.RequestError({type: ttypes.ErrorType.GENERIC, description: "magic"});
// console.log(myErr);

// Config
nconf.argv()
     .env()
     .file({file: './config/defaults.json'});

// Persistence layer
var persistence = require('./persistence/' + nconf.get('PERSISTENCE').type);
persistence.api.setHashingFunction(function(input) {
  var hashInput = nconf.get('HASHING_SALT') + input.toString();
  return hashInput;//lm testing, kill
  return crypto.createHash('sha1').update(hashInput).digest('hex');
});

// Server implementation
var server = thrift.createServer(GBChatService, errors.errorHandledAPI({
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
    // try {
    //   var isUsernameAvailable = !persistence.api.userExists(username);
    //   result(null, isUsernameAvailable);
    // }
    // catch (e) {
    //   result(errors.convertError(e));
    // }

    var isUsernameAvailable = !persistence.api.userExists(username);

    result(isUsernameAvailable);
  },
  registerUsername: function(userId, username, result) {
    var registeredUserId = persistence.api.setUser(userId, username);

    result(registeredUserId);
  },
  newChat: function(userId, chatId, chatMeta, result) {
    var chat = persistence.commons.converters.persistenceToApi.chat(persistence.api.newChat(userId, chatId, {owner: userId, dateCreated: GB.getCurrentISODate(), name: chatMeta.name || nconf.get('DEFAULT_CHAT_NAME'), topic: chatMeta.topic}));

    result(chat);
  },
  chats: function(sorting, range, result) {
    var chatsP = persistence.api.getChats(persistence.commons.converters.apiToPersistence.api.sorting(sorting), persistence.commons.converters.apiToPersistence.api.range(range));

    var chats = _.map(chatsP, function(input) {
      return persistence.commons.converters.persistenceToApi.chat(input);
    });

    result(chats);
  },
  chat: function(userId, chatId, result) {
    var chat = persistence.commons.converters.persistenceToApi.chat(persistence.api.getChat(userId, chatId));

    result(chat);
  },
  newMessage: function(userId, chatId, message, result) {
    persistence.api.newMessage(userId, chatId, message.message);

    result();
  },
  messages: function(userId, chatId, range, result) {
    var messagesP = persistence.api.getMessages(userId, chatId, persistence.commons.converters.apiToPersistence.api.range(range));

    var messages = _.map(messagesP, function(input) {
      return persistence.commons.converters.persistenceToApi.message(input);
    });

    result(messages);
  },
  setChatMeta: this.newChat,
  globalUserCount: function(result) {
    var globalUserCount = persistence.api.getUserCount();

    result(globalUserCount);
  },
}));

// Start server
server.listen(nconf.get('PORT'));
console.log("Server started on port " + nconf.get('PORT'));

//lm need to decide what to do with errors, can I just raise them javascript style or must I create them etc. maybe I can abstract this

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
