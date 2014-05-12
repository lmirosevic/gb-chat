//
//  inMemory.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore'),
    GB = require('../lib/Goonbee/toolbox'),
    errors = require('../lib/Chat/errors'),//lm sort out this require, it's nasty
    ttypes = require('../gen-nodejs/GoonbeeChatService_types');

var storage = {
  users: {},
  chats: {}
};
var hashingFunction;

var P = function() {
  this.autoId_s = function(field, prefix, offset) {
    GB.requiredArguments(field);
    GB.requiredVariables(hashingFunction);
    offset = GB.optional(offset, 0);

    var itemCount = _.size(field) + offset;
    var candidate = hashingFunction(prefix + itemCount.toString());
    if (_.contains(field, candidate)) {
      return this(field, prefix, offset + 1);
    }
    else {
      return candidate;
    }
  };

  this.lazyChat = function(chatId, owner, chatOptions, callback) {
    GB.requiredArguments(owner);
    chatOptions = GB.optional(chatOptions, {});
    
    // attempt to get existing chat
    var rawChat = storage.chats[chatId];

    if (_.isUndefined(rawChat)) {
      // generate id for it if necessary
      chatId = GB.optional(chatId, p.autoId_s(storage.chats, 'chat'));

      // initialize it
      rawChat = {
        meta: {
          owner: owner,
          dateCreated: GB.getCurrentISODate(),
          name: GB.optional(chatOptions.name, null),
          topic: GB.optional(chatOptions.topic, null),
        },
        participants: [],
        messages: []
      };

      // commit it
      storage.chats[chatId] = rawChat;
    }

    GB.callCallback(callback, chatId);
  };

  this.verifyUser = function(userId, callback) {
    p.isUserIdRegistered(userId, function(isUserIdRegistered) {
      if (!isUserIdRegistered) throw new errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist');

      GB.callCallback(callback);
    });
  };
  
  this.sliceForRange_s = function(collection, range) {
    var elementCount = _.size(collection);
    
    var saneIndex = GB.threshold(range.index, 0, elementCount);
    var saneLength = GB.threshold(range.length, 0, elementCount - saneIndex);

    var begin;
    var end;
    switch (range.direction) {
      case ttypes.RangeDirection.FORWARDS: {
        begin = saneIndex;
        end = begin + saneLength;
      } break;

      case ttypes.RangeDirection.BACKWARDS: {
        end = elementCount - saneIndex;
        begin = end - saneLength;
      } break;
    }

    return {begin: begin, end: end};
  };

  this.isUserIdRegistered = function(userId, callback) {
    GB.requiredArguments(userId);

    GB.callCallback(callback, _.has(storage.users, userId));
  };

  this.setChatOptions = function(userId, chatId, chatOptions, callback) {
    GB.requiredArguments(userId);

    chatOptions = GB.optional(chatOptions, {});

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, chatOptions, function(chatId) {
        var storedChat = storage.chats[chatId];

        // commit the meta fields if they've been set
        if (!_.isUndefined(chatOptions.name)) storedChat.meta.name = chatOptions.name;
        if (!_.isUndefined(chatOptions.topic)) storedChat.meta.topic = chatOptions.topic;

        p.getChatStats(userId, chatId, function(stats) {
          p.getChatMeta(userId, chatId, function(meta) {
            var chat = new ttypes.Chat({
              id: chatId, 
              meta: meta, 
              stats: stats,
            });

            GB.callCallback(callback, chat);
          });
        });
      });
    });
  };

  this.getChatStats = function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var stats = new ttypes.ChatStats({
          messageCount: _.size(storedChat.messages),
          participantCount: _.size(storedChat.participants),
        });

        GB.callCallback(callback, stats);
      });
    });
  };

  this.getChatMeta = function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var meta = new ttypes.ChatMeta({
          owner: storedChat.meta.owner,
          dateCreated: storedChat.meta.dateCreated,
          name: storedChat.meta.name,
          topic: storedChat.meta.topic,
        });

        GB.callCallback(callback, meta);
      });
    });
  };

};
var p = new P();

var inMemoryPersistence = module.exports = {
  setHashingFunction: function(handler, callback) {
    GB.requiredArguments(handler);

    hashingFunction = handler;

    GB.callCallback(callback);
  },
  isUsernameAvailable: function(username, callback) {
    GB.requiredArguments(username);

    var isUsernameAvailable = !_.contains(storage.users, username);

    GB.callCallback(callback, isUsernameAvailable);
  },
  setUser: function(userId, username, callback) {
    GB.requiredArguments(username);

    // lazy creation of userId
    userId = GB.optional(userId, p.autoId_s(storage.users, 'user'));
    // ...and therewith user
    storage.users[userId] = username;  

    GB.callCallback(callback, userId);
  },
  getUsername: function(userId, callback) {
    GB.requiredArguments(userId);

    p.verifyUser(userId, function() {
      GB.callCallback(callback, storage.users[userId]);      
    });
  },
  getUserCount: function(callback) {
    GB.callCallback(callback, _.size(storage.users));
  },
  getChatStats: p.getChatStats,
  getChatMeta: p.getChatMeta,
  setChatOptions: p.setChatOptions,
  getChat: function(userId, chatId, callback) {
    GB.requiredArguments(userId);

    p.setChatOptions(userId, chatId, undefined, callback);
  },
  getChats: function(sorting, range, callback) {
    GB.requiredArguments(sorting, range);

    // prune the raw chat first to get only what we want out, we do it now because the elements will be copied and this saves memory
    var chats = _.map(storage.chats, function(representationalChat, chatId) {
      return new ttypes.Chat({
        id: chatId, 
        meta: new ttypes.ChatMeta({
          owner: representationalChat.meta.owner, 
          dateCreated: representationalChat.meta.dateCreated, 
          name: representationalChat.meta.name, 
          topic: representationalChat.meta.topic
        }), 
        stats: new ttypes.ChatStats({
          participantCount: _.size(representationalChat.participants), 
          messageCount: _.size(representationalChat.messages)
        })
      });
    });

    // sort the chats first into the correct order
    chats = _.sortBy(chats, function(chat) {
      switch (sorting) {
        case ttypes.ChatSorting.PARTICIPANT_COUNT: {
          return chat.stats.participantCount;
        } break;

        case ttypes.ChatSorting.MESSAGE_COUNT: {
          return chat.stats.messageCount;
        } break;

        case ttypes.ChatSorting.DATE_CREATED: {
          return chat.stats.dateCreated;
        } break;
      }
    });

    // convert the range into something JS understands
    var slice = p.sliceForRange_s(chats, range);

    // get the correct slice
    chats = chats.slice(slice.begin, slice.end);

    // potentially reverse the chats
    if (range.direction === ttypes.RangeDirection.BACKWARDS) chats.reverse();

    //return chats, they're already in the correct format
    GB.callCallback(callback, chats);
  },
  newMessage: function(userId, chatId, content, callback) {
    GB.requiredArguments(userId, chatId, content);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var rawMessage = {
          dateCreated: GB.getCurrentISODate(),
          authorId: userId,
          content: content,
        };

        // insert message
        storedChat.messages.push(rawMessage);
        // insert participant
        if (!_.contains(storedChat.participants, userId)) storedChat.participants.push(userId);

        GB.callCallback(callback);
      });  
    });
  },
  getMessages: function(userId, chatId, range, callback) {
    GB.requiredArguments(userId, chatId, range);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        // convert the range into something JS understands
        var slice = p.sliceForRange_s(storedChat.messages, range);
          
        // get the messages out
        var rawMessages = storedChat.messages.slice(slice.begin, slice.end);

        // convert rawMessages into Message objects
        var messages = _.map(rawMessages, function(rawMessage, index) {
          // get the name of the author
          var authorName = storage.users[rawMessage.authorId];

          return new ttypes.Message({
            seq: slice.begin + index, 
            dateCreated: rawMessage.dateCreated, 
            authorName: authorName,
            content: rawMessage.content
          });
        });

        // potentially reverse the messages
        if (range.direction === ttypes.RangeDirection.BACKWARDS) messages.reverse();

        GB.callCallback(callback, messages);
      });
    });
  }
};
