//
//  inMemory.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var crypto = require('crypto'),
    _ = require('underscore'),
    nconf = require('nconf'),
    toolbox = require('gb-toolbox'),
    api = require('gb-api'),
    ttypes = require('../gen-nodejs/GoonbeeChatService_types');

var options = nconf.get('PERSISTENCE').options;

var storage = {
  users: {},
  chats: {}
};

var P = function() {
  this.hashingFunction = function(input) {
    var hashInput = input.toString() + options.hashingSalt;
    if (options.idHashingEnabled) {
      return crypto.createHash('sha1').update(hashInput).digest('hex');
    }
    else {
      return hashInput;
    }
  };

  this.autoId_s = function(field, prefix, offset) {
    toolbox.requiredArguments(field);
    toolbox.requiredVariables(p.hashingFunction);
    offset = toolbox.optional(offset, 0);

    var itemCount = _.size(field) + offset;
    var candidate = p.hashingFunction(prefix + itemCount.toString());
    if (_.contains(field, candidate)) {
      return this(field, prefix, offset + 1);
    }
    else {
      return candidate;
    }
  };

  this.lazyChat = function(chatId, ownerId, chatOptions, callback) {
    toolbox.requiredArguments(ownerId);
    chatOptions = toolbox.optional(chatOptions, {});
    
    // attempt to get existing chat
    var rawChat = storage.chats[chatId];

    if (_.isUndefined(rawChat)) {
      // generate id for it if necessary
      chatId = toolbox.optional(chatId, p.autoId_s(storage.chats, 'chat'));

      // initialize it
      rawChat = {
        meta: {
          ownerId: ownerId,
          dateCreated: toolbox.getCurrentISODate(),
          name: toolbox.optional(chatOptions.name, nconf.get('DEFAULT_CHAT_NAME')),
          topic: toolbox.optional(chatOptions.topic, null),
        },
        participants: [],
        messages: []
      };

      // commit it
      storage.chats[chatId] = rawChat;
    }

    // commit the meta fields if they've been set
    if (!_.isUndefined(chatOptions.name)) rawChat.meta.name = chatOptions.name;
    if (!_.isUndefined(chatOptions.topic)) rawChat.meta.topic = chatOptions.topic;

    toolbox.callCallback(callback, chatId);
  };

  this.verifyUser = function(userId, callback) {
    p.isUserIdRegistered(userId, function(isUserIdRegistered) {
      if (!isUserIdRegistered) throw new api.errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist');

      toolbox.callCallback(callback);
    });
  };
  
  this.sliceForRange_s = function(collection, range) {
    var elementCount = _.size(collection);
    
    var saneIndex = toolbox.threshold(range.index, 0, elementCount);
    var saneLength = toolbox.threshold(range.length, 0, elementCount - saneIndex);

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
    toolbox.requiredArguments(userId);

    toolbox.callCallback(callback, _.has(storage.users, userId));
  };

  this.getChatStats = function(userId, chatId, callback) {
    toolbox.requiredArguments(userId, chatId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var stats = new ttypes.ChatStats({
          messageCount: _.size(storedChat.messages),
          participantCount: _.size(storedChat.participants),
        });

        toolbox.callCallback(callback, stats);
      });
    });
  };

  this.getChatMeta = function(userId, chatId, callback) {
    toolbox.requiredArguments(userId, chatId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var meta = new ttypes.ChatMeta({
          ownerId: storedChat.meta.ownerId,
          dateCreated: storedChat.meta.dateCreated,
          name: storedChat.meta.name,
          topic: storedChat.meta.topic,
        });

        toolbox.callCallback(callback, meta);
      });
    });
  };

  this.setChatOptions = function(userId, chatId, chatOptions, callback) {
    toolbox.requiredArguments(userId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, chatOptions, function(chatId) {
        p.getChatStats(userId, chatId, function(stats) {
          p.getChatMeta(userId, chatId, function(meta) {
            var chat = new ttypes.Chat({
              id: chatId,
              meta: meta,
              stats: stats,
            });

            toolbox.callCallback(callback, chat);
          });
        });
      });
    });
  };

};
var p = new P();

var inMemoryPersistence = module.exports = {
  isUsernameAvailable: function(username, callback) {
    toolbox.requiredArguments(username);

    var isUsernameAvailable = !_.contains(storage.users, username);

    toolbox.callCallback(callback, null, isUsernameAvailable);
  },
  setUser: function(userId, username, callback) {
    toolbox.requiredArguments(username);

    // lazy creation of userId
    userId = toolbox.optional(userId, p.autoId_s(storage.users, 'user'));
    // ...and therewith user
    storage.users[userId] = username;  

    toolbox.callCallback(callback, null, userId);
  },
  getUsername: function(userId, callback) {
    toolbox.requiredArguments(userId);

    p.verifyUser(userId, function() {
      toolbox.callCallback(callback, null, storage.users[userId]);      
    });
  },
  getUserCount: function(callback) {
    toolbox.callCallback(callback, null, _.size(storage.users));
  },
  getChatStats: function(userId, chatId, callback) {
    p.getChatStats(userId, chatId, function(stats) {
      toolbox.callCallback(callback, null, stats);
    });
  },
  getChatMeta: function(userId, chatId, callback) {
    p.getChatMeta(userId, chatId, function(meta) {
      toolbox.callCallback(callback, null, meta);
    });
  },
  setChatOptions: function(userId, chatId, chatOptions, callback) {
    p.setChatOptions(userId, chatId, chatOptions, function(chat) {
      toolbox.callCallback(callback, null, chat);
    });
  },
  getChat: function(userId, chatId, callback) {
    toolbox.requiredArguments(userId);

    p.setChatOptions(userId, chatId, undefined, function(chat) {
      toolbox.callCallback(callback, null, chat);
    });
  },
  getChats: function(sorting, range, callback) {
    toolbox.requiredArguments(sorting, range);

    // prune the raw chat first to get only what we want out, we do it now because the elements will be copied and this saves memory
    var chats = _.map(storage.chats, function(representationalChat, chatId) {
      return new ttypes.Chat({
        id: chatId, 
        meta: new ttypes.ChatMeta({
          ownerId: representationalChat.meta.ownerId,
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
    toolbox.callCallback(callback, null, chats);
  },
  newMessage: function(userId, chatId, content, callback) {
    toolbox.requiredArguments(userId, chatId, content);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var rawMessage = {
          dateCreated: toolbox.getCurrentISODate(),
          authorId: userId,
          content: content,
        };

        // insert message
        storedChat.messages.push(rawMessage);
        // insert participant
        if (!_.contains(storedChat.participants, userId)) storedChat.participants.push(userId);

        toolbox.callCallback(callback, null);
      });  
    });
  },
  getMessages: function(userId, chatId, range, callback) {
    toolbox.requiredArguments(userId, chatId, range);

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

        toolbox.callCallback(callback, null, messages);
      });
    });
  }
};
