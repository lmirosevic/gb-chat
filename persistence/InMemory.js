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

var p = {
  autoId: function(field, offset) {
    GB.requiredArguments(field);
    GB.requiredVariables(hashingFunction);
    offset = GB.optional(offset, 0);

    var candidate = hashingFunction(_.size(field) + offset);
    if (_.contains(field, candidate)) {
      return this(field, offset + 1);
    }
    else {
      return candidate;
    }
  },
  lazyChat: function(chatId, owner, chatOptions) {
    GB.requiredArguments(owner);

    // attempt to get existing chat
    var rawChat = storage.chats[chatId];

    // lazily create it if it does not exist
    if (_.isUndefined(rawChat)) {
      // generate id for it if necessary
      chatId = GB.optional(chatId, p.autoId(storage.chats));

      // initialize it
      rawChat = {
        meta: {
          owner: owner,
          dateCreated: GB.getCurrentISODate(),
          name: chatOptions.name || null,
          topic: chatOptions.topic || null,
        },
        participants: [],
        messages: []
      };

      // commit it
      storage.chats[chatId] = rawChat;
    }

    // return either the original existing chat or the newly initialized and committed one
    return rawChat;
  },
  verifyUser: function(userId) {
    if (!inMemoryPersistence.userExists(userId)) throw new errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist');
  },
  sliceForRange: function(collection, range) {
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
  }
};

var inMemoryPersistence = module.exports = {
  setHashingFunction: function(handler) {
    GB.requiredArguments(handler);

    hashingFunction = handler;
  },
  userExists: function(username) {
    GB.requiredArguments(username);

    return _.contains(storage.users, username);
  },
  setUser: function(userId, username) {
    GB.requiredArguments(username);
    GB.requiredVariables(hashingFunction);
    p.verifyUser(userId);
    
    // lazy creation of userId (and therewith user)
    if (_.isUndefined(userId)) userId = hashingFunction(_.size(storage.users));

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
    var rawChat = p.lazyChat(chatId, userId);

    var stats = new ttypes.ChatStats({
      messageCount: _.count(rawChat.messages),
      participantCount: _.count(rawChat.participants),
    });

    return stats;
  },
  getChatMeta: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var rawChat = p.lazyChat(chatId, userId);

    var meta = {
      owner: rawChat.meta.owner,
      dateCreated: rawChat.meta.dateCreated,
      name: rawChat.meta.name,
      topic: rawChat.meta.topic,
    };

    return meta;
  },
  setChatOptions: function(userId, chatId, chatOptions) {
    GB.requiredArguments(userId, chatOptions);
    p.verifyUser(userId);
    var rawChat = p.lazyChat(chatId, userId, chatOptions);

    // commit the meta fields which may be optionally passed down
    if (!_.isUndefined(chatOptions.name)) rawChat.meta.name = chatOptions.name;
    if (!_.isUndefined(chatOptions.topic)) rawChat.meta.topic = chatOptions.topic;

    return rawChat;
  },
  getChat: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var rawChat = p.lazyChat(chatId, userId);

    // convert it to the correct type
    var chat = new ttypes.Chat({id: chatId, meta: new ttypes.ChatMeta({owner: rawChat.meta.owner, dateCreated: rawChat.meta.dateCreated, name: rawChat.meta.name, topic: rawChat.meta.topic}), stats: new ttypes.ChatStats({participantCount: _.size(rawChat.participants), messageCount: _.size(rawChat.messages)})});

    return chat;
  },
  getChats: function(sorting, range) {
    GB.requiredArguments(sorting, range);

    // prune the raw chat first to get only what we want out, we do it now because the elements will be copied and this saves memory
    var chats = _.map(storage.chats, function(rawChat, chatId) {
      return new ttypes.Chat({id: chatId, meta: new ttypes.ChatMeta({owner: rawChat.meta.owner, dateCreated: rawChat.meta.dateCreated, name: rawChat.meta.name, topic: rawChat.meta.topic}), stats: new ttypes.ChatStats({participantCount: _.size(rawChat.participants), messageCount: _.size(rawChat.messages)})});
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
    var slice = p.sliceForRange(sortedChats, range);

    // get the correct slice
    chats = chats.slice(slice.begin, slice.end);

    // potentially reverse the chats
    if (range.direction === ttypes.RangeDirection.BACKWARDS) chats.reverse();

    //return chats, they're already in the correct format
    return chats;

  },
  newMessage: function(userId, chatId, content) {
    GB.requiredArguments(userId, chatId, message);
    p.verifyUser(userId);
    var rawChat = p.lazyChat(chatId, userId);

    var rawMessage = {
      date: GB.getCurrentISODate(),
      author: userId,
      content: content,
    };

    rawChat.messages.push(rawMessage);
  },
  getMessages: function(userId, chatId, range) {
    GB.requiredArguments(userId, chatId, range);
    p.verifyUser(userId);
    var rawChat = p.lazyChat(chatId, userId);

    // convert the range into something JS understands
    var slice = p.sliceForRange(rawChat.messages, range);

    // get the messages out
    var rawMessages = rawChat.messages.slice(slice.begin, slice.end);

    // convert rawMessages into Message objects
    var messages = _.each(rawMessages, function(rawMessage, index) {
      return new ttypes.Message({seq: slice.begin + index, dateCreated: rawMessage.dateCreated, author: rawMessage.author, content: rawMessage.content});
    });

    // potentially reverse the messages
    if (range.direction === ttypes.RangeDirection.BACKWARDS) messages.reverse();

    return messages;
  }
};
