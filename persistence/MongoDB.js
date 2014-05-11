//
//  MongoDB.js
//  GBChatService
//
//  Created by Luka Mirosevic on 11/05/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore'),
    nconf = require('nconf'),
    mongoose = require('mongoose'),
    GB = require('../lib/Goonbee/toolbox'),
    errors = require('../lib/Chat/errors'),//lm sort out this require, it's nasty
    ttypes = require('../gen-nodejs/GoonbeeChatService_types');


/* Mongoose Setup and Schema */

mongoose.connect(nconf.get('PERSISTENCE').options.url);

var userSchema = new mongoose.Schema({
  username:                               { type: String, index: { unique: true } },
});

var chatSchema = new mongoose.Schema({
  owner:                                  { type: mongoo.schema.ObjectId },
  meta: {
    dateCreated:                          { type: String, index: true },
    name:                                 { type: String },
    topic:                                { type: String },
  },
  participantIds:                         [{ type: String }],
  messages: [{
    dateCreated:                          { type: String },
    content:                              { type: String },
    authorName:                           { type: String }
  }],
});

var User = mongoose.model('User', userSchema);
var Chat = mongoose.model('Chat', chatSchema);


/* Main logic */

var P = function() {
  this.autoId = function(callback) {
    var cadidate = new mongoose.types.ObjectId();
    
    GB.callCallback(candidate);
  };

  this.lazyChat = function(chatId, owner, chatOptions, callback) {
    GB.requiredArguments(owner);
    chatOptions = GB.optional(chatOptions, {});
    
    // make sure we have a valid chatId
    chatId = GB.optional(chatId, new mongoose.types.ObjectId());

    // set properties which are defined on the options, if they're undefined then we won't set them, if they're null then we will
    var setObject = {};
    if (!_.isUndefined(chatOptions.name)) setObject['meta.name'] = chatOptions.name;
    if (!_.isUndefined(chatOptions.topic)) setObject['meta.topic'] = chatOptions.topic;

    Chat
      .update({
        id: chatId
      }, {
        $setOnInsert: {
          'meta.owner': owner,
          'meta.dateCreated': GB.getCurrentISODate(),
        },
        $set: setObject,
      }, {
        upsert: true,
      })
      .run(function(err, chat) {
        console.log(err);//lm kill
        console.log(chat);//lm kill

        // return just the chatId
        GB.callCallback(callback, chatId);

        //lm need to change the semantics so that it works with the chatId returned from lazyChat, as opposed to a representationChat thing
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

    User.exists(username, function(err, exists) {
      console.log('exists: ' + username + '  y/n: ' + exists);
      GB.callCallback(callback, !exists);
    });

    // p.usernameExists(username, function(usernameExists) {
    //   GB.callCallback(callback, !usernameExists);      
    // });
  },
  setUser: function(userId, username, callback) {
    GB.requiredArguments(username);
    GB.requiredVariables(hashingFunction);

    // lazy creation of userId
    userId = GB.optional(userId, new mongoose.types.ObjectId());
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
  getChatStats: function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(representationalChat) {
        var stats = new ttypes.ChatStats({
          messageCount: _.count(representationalChat.messages),
          participantCount: _.count(representationalChat.participants),
        });

        GB.callCallback(callback, stats);
      });
    });
  },
  getChatMeta: function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(representationalChat) {
        var meta = ttypes.ChatMeta({
          owner: representationalChat.meta.owner,
          dateCreated: representationalChat.meta.dateCreated,
          name: representationalChat.meta.name,
          topic: representationalChat.meta.topic
        });

        GB.callCallback(callback, meta);
      });
    });
  },
  setChatOptions: function(userId, chatId, chatOptions, callback) {
    GB.requiredArguments(userId, chatOptions);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, chatOptions, function(representationalChat) {
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

        GB.callCallback(callback, chat);
      });
    });
  },
  getChat: function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(representationalChat) {
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
      p.lazyChat(chatId, userId, undefined, function(representationalChat) {
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

        GB.callCallback(callback);
      });  
    });
  },
  getMessages: function(userId, chatId, range, callback) {
    GB.requiredArguments(userId, chatId, range);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(representationalChat) {
        // convert the range into something JS understands
        p.sliceForRange(representationalChat.messages, range, function(slice) {
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

          GB.callCallback(callback, messages);
        });
      });
    });
  }
};
