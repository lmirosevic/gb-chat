//
//  inMemory.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore');
    GB = require('../lib/Goonbee/toolbox');
    errors = require('../lib/Chat/errors');//lm sort out this require, it's nasty


var storage = {
  users: {},
  chats: {}
};
var hashingFunction;

var P = function() {
  this.autoId = function(field, prefix, offset) {
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

  this.lazyChat = function(chatId, owner, chatOptions) {
    GB.requiredArguments(owner);
    chatOptions = GB.optional(chatOptions, {});
    
    // attempt to get existing chat
    var rawChat = storage.chats[chatId];

    // lazily create it if it does not exist
    if (_.isUndefined(rawChat)) {
      // generate id for it if necessary
      chatId = GB.optional(chatId, p.autoId(storage.chats, 'chat'));

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

    //create a representationalChat, which is like the rawChat but with the id property set
    var representationalChat = _.clone(rawChat);
    representationalChat.id = chatId;

    // return either the original existing chat or the newly initialized and committed one
    return representationalChat;
  };

  this.verifyUser = function(userId) {
    if (!this.isUserIdRegistered(userId)) throw new errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist');
  };
  
  this.sliceForRange = function(collection, range) {
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

  this.usernameExists = function(username) {
    GB.requiredArguments(username);

    return _.contains(storage.users, username);
  };

  this.isUserIdRegistered = function(userId) {
    GB.requiredArguments(userId);

    return _.has(storage.users, userId);
  };
};
var p = new P();

var inMemoryPersistence = module.exports = {
  setHashingFunction: function(handler) {
    GB.requiredArguments(handler);

    hashingFunction = handler;
  },
  isUsernameAvailable: function(username) {
    GB.requiredArguments(username);

    return !p.usernameExists(username);
  },
  setUser: function(userId, username) {
    GB.requiredArguments(username);
    GB.requiredVariables(hashingFunction);

    // lazy creation of userId
    userId = GB.optional(userId, p.autoId(storage.users, 'user'));
    // ...and therewith user
    storage.users[userId] = username;

    return userId;
  },
  getUsername: function(userId) {
    GB.requiredArguments(userId);
    p.verifyUser(userId);

    return storage.users[userId];
  },
  getUserCount: function() {
    return _.size(storage.users);
  },
  getChatStats: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var representationalChat = p.lazyChat(chatId, userId);

    var stats = new ttypes.ChatStats({
      messageCount: _.count(representationalChat.messages),
      participantCount: _.count(representationalChat.participants),
    });

    return stats;
  },
  getChatMeta: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var representationalChat = p.lazyChat(chatId, userId);

    var meta = ttypes.ChatMeta({
      owner: representationalChat.meta.owner,
      dateCreated: representationalChat.meta.dateCreated,
      name: representationalChat.meta.name,
      topic: representationalChat.meta.topic
    });

    return meta;
  },
  setChatOptions: function(userId, chatId, chatOptions) {
    GB.requiredArguments(userId, chatOptions);
    p.verifyUser(userId);
    var representationalChat = p.lazyChat(chatId, userId, chatOptions);

    // commit the meta fields if they've been set
    var rawChat = storage.chats[representationalChat.id];
    if (!_.isUndefined(chatOptions.name)) rawChat.meta.name = chatOptions.name;
    if (!_.isUndefined(chatOptions.topic)) rawChat.meta.topic = chatOptions.topic;

    // convert it to the correct type
    var chat = new ttypes.Chat({
      id: representationalChat.id, 
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

    return chat;
  },
  getChat: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var representationalChat = p.lazyChat(chatId, userId);

    // convert it to the correct type
    var chat = new ttypes.Chat({
      id: representationalChat.id, 
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

    return chat;
  },
  getChats: function(sorting, range) {
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
    var slice = p.sliceForRange(chats, range);

    // get the correct slice
    chats = chats.slice(slice.begin, slice.end);

    // potentially reverse the chats
    if (range.direction === ttypes.RangeDirection.BACKWARDS) chats.reverse();

    //return chats, they're already in the correct format
    return chats;
  },
  newMessage: function(userId, chatId, content) {
    GB.requiredArguments(userId, chatId, content);
    p.verifyUser(userId);
    var representationalChat = p.lazyChat(chatId, userId);

    var rawChat = storage.chats[representationalChat.id];

    var rawMessage = {
      dateCreated: GB.getCurrentISODate(),
      authorId: userId,
      content: content,
    };

    // insert message
    rawChat.messages.push(rawMessage);
    // insert participant
    if (!_.contains(rawChat.participants, userId)) rawChat.participants.push(userId);
  },
  getMessages: function(userId, chatId, range) {
    GB.requiredArguments(userId, chatId, range);
    p.verifyUser(userId);
    var representationalChat = p.lazyChat(chatId, userId);

    // convert the range into something JS understands
    var slice = p.sliceForRange(representationalChat.messages, range);

    // get the messages out
    var rawMessages = representationalChat.messages.slice(slice.begin, slice.end);

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

    return messages;
  }
};
