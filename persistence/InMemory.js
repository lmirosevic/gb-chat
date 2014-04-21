//
//  inMemory.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore');
var GB = require('lib/Goonbee/toolbox');

var persistenceCommons = require('persistence/commons');

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

    var candidate = hashingFunction(_.count(field) + offset);
    if (_.contains(field, candidate)) {
      return this(field, offset + 1);
    }
    else {
      return candidate;
    }
  },
  lazyChat: function(chatId, options) {
    GB.requiredArguments(options.owner);

    // attempt to get existing chat
    var chat = storage.chats[chatId];

    // lazily create it if it does not exist
    if (_.isUndefined(chat)) {
      // generate id for it if necessary
      chatId = GB.optional(chatId, p.autoId(storage.chats));

      // initialize it
      chat = {
        meta: {
          owner: options.owner,
          dateCreated: options.dateCreated || GB.getCurrentISODate(),
          name: options.name || null,
          topic: options.topic || null,
        },
        participants: [],
        messages: []
      };

      // commit it
      storage.chats[chatId] = chat;
    }

    // return either the original existing chat or the newly initialized and committed one
    return chat;
  },
  verifyUser: function(userId) {
    if (!inMemoryPersistence.userExists(userId)) throw new Error('The user "' + userId + '" does not exist');
  },
  sliceForRange: function(collection, range) {
    var elementCount = _.count(collection);
    var saneIndex = GB.threshold(range.start, -elementCount, elementCount-1);
    var start = saneIndex >= 0 ? 0 + saneIndex : elementCount + saneIndex;
    var saneLength = GB.threshold(range.length, -start, elementCount - start);
    var end = start + saneLength;

    return {start: start, end: end};
  }
};

var inMemoryPersistence = module.exports = {
  setHashingFunction: function(handler) {
    GB.requiredArguments(handler);

    hashingFunction = handler;
  },
  userExists: function(username) {
    GB.requiredArguments(username);

    return !_.contains(storage.users, username);
  },
  setUser: function(userId, username) {
    GB.requiredArguments(username);
    GB.requiredVariables(hashingFunction);
    p.verifyUser(userId);
    
    // lazy creation of userId (and therewith user)
    if (_.isUndefined(userId)) userId = hashingFunction(_.count(storage.users));

    storage.users[userId] = username;

    return userId;//lm this one needs to be reflected in the thrift interface, i.e. this creates a new user if userId is not supplied
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
    var chat = p.lazyChat(chatId, {owner: userId});

    var stats = {
        messageCount: chat.messages.length,
        participantCount: chat.participants.length,
      };

    return stats;
  },
  getChatMeta: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var chat = p.lazyChat(chatId, {owner: userId});

    var meta = {
        owner: chat.meta.owner,
        dateCreated: chat.meta.dateCreated,
        name: chat.meta.name,
        topic: chat.meta.topic,
      };

    return meta;
  },
  setChatMeta: function(userId, chatId, options) {
    GB.requiredArguments(userId, options);
    p.verifyUser(userId);
    var chat = p.lazyChat(chatId, {owner: userId});

    // make updates
    if (!_.isUndefined(options.owner)) chat.meta.owner = options.owner;
    if (!_.isUndefined(options.dateCreated)) chat.meta.dateCreated = options.dateCreated;
    if (!_.isUndefined(options.name)) chat.meta.name = options.name;
    if (!_.isUndefined(options.topic)) chat.meta.topic = options.topic;

    return chat.id;//lm this one needs to be reflected in the thrift interface, i.e. this creates a new chat if chatId is not supplied
  },
  getChat: function(userId, chatId) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId);
    var chat = p.lazyChat(chatId, {owner: userId});

    var chatObject = {
      id: chat.id,
      meta: this.getChatMeta(chatId),
      stats: this.getChatStats(chatId)
    };

    return chatObject;
  },
  getChats: function(sorting, range) {
    GB.requiredArguments(sorting, range);

    // prune the raw chat first to get only what we want out, we do it now because the elements will be copied and this saves memory
    var prunedChats = _.map(storage.chats, function(chat, key) {
      var chatObject = {
        id: key,
        meta: {
          owner: chat.meta.owner,
          dateCreated: chat.meta.dateCreated,
          name: chat.meta.name,
          topic: chat.meta.topic,
        },
        stats: {
          messageCount: chat.messages.length,
          participantCount: chat.participants.length,
        },
      };

      return chatObject;
    });

    // sort the messages first into the correct order
    var sortedChats = _.sortBy(prunedChats, function(chat) {
      if (sorting == persistenceCommons.ChatSorting.PARTICIPANTS) {
        return chat.stats.participantCount;
      }
      else if (sorting == persistenceCommons.ChatSorting.MESSAGE_COUNT) {
        return chat.stats.messageCount;
      }
      else if (sorting == persistenceCommons.ChatSorting.DATE_CREATED) {
        return chat.meta.dateCreated;
      }
    });

    // convert the range into something JS understands
    var slice = p.sliceForRange(sortedChats, range);

    // get the correct slice
    var chats = sortedChats.slice(slice.start, slice.end);

    //return chats, they're already in the correct format couretesy of the pruning step
    return chats;

  },
  newMessage: function(userId, chatId, text) {
    GB.requiredArguments(userId, chatId, message);
    p.verifyUser(userId);
    var chat = p.lazyChat(chatId, {owner: userId});

    var message = {
      date: GB.getCurrentISODate(),
      author: userId,
      message: text,
    };

    chat.messages.push(message);
  },
  messages: function(chatId, range) {
    GB.requiredArguments(chatId, range);
    var chat = p.lazyChat(chatId, {owner: userId});

    // convert the range into something JS understands
    var slice = p.sliceForRange(chat.messages, range);

    // get the messages out
    var messages = chat.messages.slice(slice.start, slice.end);

    // set the the correct seq number on each message
    _.each(messages, function(message, index) {
      message.seq = slice.start + index;
    });

    return messages;
  }
};

// struct Message {
//   Int seq
//   String date
//   String author
//   String message
// }

//lm make sure that all the calls that need userId are defined as such in thrift.... make the userId required

//lm make sure that these hold
//setting meta on nonexisting chat should make it
//getting messages on nonexsting chat should make it
//getting stats and meta on a nonexisting chat should make it
//chatId is optional and can be autogenerated, with basic clashing protection
//userId is required







/*

id: {
  meta: {
    owner,
    name,
    topic,
    dateCreated,
  },
  participants: [],
  messages: [],
}

*/