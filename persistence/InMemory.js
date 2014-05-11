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
  this.autoId = function(field, prefix, offset, callback) {
    GB.requiredArguments(field);
    GB.requiredVariables(hashingFunction);
    offset = GB.optional(offset, 0);

    var itemCount = _.size(field) + offset;
    var candidate = hashingFunction(prefix + itemCount.toString());
    if (_.contains(field, candidate)) {
      GB.callCallback(callback, this(field, prefix, offset + 1, callback));
    }
    else {
      GB.callCallback(callback, candidate);
    }
  };

  this.lazyChat = function(chatId, owner, chatOptions, callback) {
    GB.requiredArguments(owner);
    chatOptions = GB.optional(chatOptions, {});
    
    // attempt to get existing chat
    var rawChat = storage.chats[chatId];

    p.autoId(storage.chats, 'chat', undefined, function(generatedId) {
      if (_.isUndefined(rawChat)) {
        // generate id for it if necessary
        chatId = GB.optional(chatId, generatedId);

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
    });
  };

  this.verifyUser = function(userId, callback) {
    p.isUserIdRegistered(userId, function(isUserIdRegistered) {
      if (!isUserIdRegistered) throw new errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist');

      GB.callCallback(callback);
    });
  };
  
  this.sliceForRange = function(collection, range, callback) {
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

    GB.callCallback(callback, {begin: begin, end: end});
  };

  this.usernameExists = function(username, callback) {
    GB.requiredArguments(username);

    GB.callCallback(callback, _.contains(storage.users, username));
  };

  this.isUserIdRegistered = function(userId, callback) {
    GB.requiredArguments(userId);

    GB.callCallback(callback, _.has(storage.users, userId));
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

    p.usernameExists(username, function(usernameExists) {
      GB.callCallback(callback, !usernameExists);      
    });
  },
  setUser: function(userId, username, callback) {
    GB.requiredArguments(username);
    GB.requiredVariables(hashingFunction);

    // lazy creation of userId
    p.autoId(storage.users, 'user', undefined, function(generatedId) {
      userId = GB.optional(userId, generatedId);
      // ...and therewith user
      storage.users[userId] = username;  

      GB.callCallback(callback, userId);
    });
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
  getChatStats: function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var stats = new ttypes.ChatStats({
          messageCount: _.count(storedChat.messages),
          participantCount: _.count(storedChat.participants),
        });

        GB.callCallback(callback, stats);
      });
    });
  },
  getChatMeta: function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        var meta = ttypes.ChatMeta({
          owner: storedChat.meta.owner,
          dateCreated: storedChat.meta.dateCreated,
          name: storedChat.meta.name,
          topic: storedChat.meta.topic
        });

        GB.callCallback(callback, meta);
      });
    });
  },
  setChatOptions: function(userId, chatId, chatOptions, callback) {
    GB.requiredArguments(userId, chatOptions);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];

        // commit the meta fields if they've been set
        if (!_.isUndefined(chatOptions.name)) storedChat.meta.name = chatOptions.name;
        if (!_.isUndefined(chatOptions.topic)) storedChat.meta.topic = chatOptions.topic;

        // convert it to the correct type
        var chat = new ttypes.Chat({
          id: chatId, 
          meta: new ttypes.ChatMeta({
            owner: storedChat.meta.owner, 
            dateCreated: storedChat.meta.dateCreated, 
            name: storedChat.meta.name, 
            topic: storedChat.meta.topic
          }), 
          stats: new ttypes.ChatStats({
            participantCount: _.size(storedChat.participants), 
            messageCount: _.size(storedChat.messages)
          })
        });

        GB.callCallback(callback, chat);
      });
    });
  },
  getChat: function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        var storedChat = storage.chats[chatId];
        
        // convert it to the correct type
        var chat = new ttypes.Chat({
          id: chatId, 
          meta: new ttypes.ChatMeta({
            owner: storedChat.meta.owner, 
            dateCreated: storedChat.meta.dateCreated, 
            name: storedChat.meta.name, 
            topic: storedChat.meta.topic
          }), 
          stats: new ttypes.ChatStats({
            participantCount: _.size(storedChat.participants), 
            messageCount: _.size(storedChat.messages)
          })
        });

        GB.callCallback(callback, chat);
      });
    });
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
    p.sliceForRange(chats, range, function(slice) {
      // get the correct slice
      chats = chats.slice(slice.begin, slice.end);

      // potentially reverse the chats
      if (range.direction === ttypes.RangeDirection.BACKWARDS) chats.reverse();

      //return chats, they're already in the correct format
      GB.callCallback(callback, chats);

    });
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
        p.sliceForRange(storedChat.messages, range, function(slice) {
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
    });
  }
};
