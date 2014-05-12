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

var options = nconf.get('PERSISTENCE').options;

//lm sort out error handling so it doesn't crash the process

/* Schema */

var userSchema = new mongoose.Schema({
  mId:                                    { type: String, index: { unique: true } },
  username:                               { type: String, index: { unique: true } },
}, {
  _id: false,
});

var chatSchema = new mongoose.Schema({
  mId:                                    { type: String, index: { unique: true } },
  owner:                                  { type: mongoose.Schema.ObjectId },
  meta: {
    dateCreated:                          { type: String, index: true },
    name:                                 { type: String },
    topic:                                { type: String },
  },
  participantIds:                         [{ type: String }],
  messages: [{
    dateCreated:                          { type: String },
    content:                              { type: String },
    authorName:                           { type: String },
  }],
  messageCount:                           { type: Number },
}, {
  _id: false,
});

/* Models */

var User = mongoose.model('User', userSchema);
var Chat = mongoose.model('Chat', chatSchema);

/* Error handling */

//lm sort this out
// mongoose.connection.on('error', function(error) {
//   console.log('here here');
//   console.log(error);
// });
// User.on('error', function(error) {
//   console.log('userwoops');
//   console.log(error);
// });
// Chat.on('error', function(error) {
//   console.log('chatwoops');
//   console.log(error);
// });

/* Connect */

mongoose.connect(options.url);

/* Main logic */

var P = function() {
  this.autoId_s = function() {
    var candidate = new mongoose.Types.ObjectId().toString();

    return candidate;
  };

  this.lazyChat = function(chatId, owner, chatOptions, callback) {
    GB.requiredArguments(owner);

    chatOptions = GB.optional(chatOptions, {});
    
    // make sure we have a valid chatId
    chatId = GB.optional(chatId, p.autoId_s());

    // what we will set on object creation
    var setOnInsertObject = {};
    setOnInsertObject.participantIds = [];
    setOnInsertObject.messages = [];
    setOnInsertObject.messageCount = 0;
    setOnInsertObject['meta.owner'] = owner;
    setOnInsertObject['meta.dateCreated'] = GB.getCurrentISODate();
    if (_.isUndefined(chatOptions.name)) setOnInsertObject['meta.name'] = nconf.get('DEFAULT_CHAT_NAME');

    // some optional customisation that we do each time
    var setObject = {};
    if (!_.isUndefined(chatOptions.name)) setObject['meta.name'] = chatOptions.name;
    if (!_.isUndefined(chatOptions.topic)) setObject['meta.topic'] = chatOptions.topic;

    var updateObject = {};
    if (_.size(setOnInsertObject) > 0) updateObject.$setOnInsert = setOnInsertObject;
    if (_.size(setObject) > 0) updateObject.$set = setObject;

    Chat
      .update({
        mId: chatId
      }, updateObject, {
        upsert: true,
      })
      .exec()
      .then(function(chat) {
        GB.callCallback(callback, chatId);
      })
      .end();
  };

  this.verifyUser = function(userId, callback) {
    p.isUserIdRegistered(userId, function(isUserIdRegistered) {
      if (!isUserIdRegistered) throw new errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist');

      GB.callCallback(callback);
    });
  };
  
  this.sliceForRangeMongo_s = function(range) {
    var skip;
    var limit;
    switch (range.direction) {
      case ttypes.RangeDirection.FORWARDS: {
        skip = range.index;
        limit = range.length;
      } break;

      case ttypes.RangeDirection.BACKWARDS: {
        skip = -(range.index + 1);
        limit = range.length;
      } break;
    }

    return {skip: skip, limit: limit};
  };

  this.isUserIdRegistered = function(userId, callback) {
    GB.requiredArguments(userId);

    User
      .count({
        mId: userId
      })
      .exec()
      .then(function(count) {
        var isUserIdRegistered = (count >= 1);

        GB.callCallback(callback, isUserIdRegistered);
      })
      .end();
  };

  this.getChatStats = function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);
    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        Chat
          .aggregate()
          .match({
            mId: chatId
          })
          .group({ 
            _id: {
              mId: '$mId',
              messageCount: '$messageCount',
            },
              participantCount: { $sum: { $size: '$participantIds' } },
          })
          .project({
            mId: '$_id.mId',
            stats: {
              messageCount: '$_id.messageCount',
              participantCount: '$participantCount',
            }
          })
          .exec()
          .then(function(results) {
            var processedChat = _.find(results, function(result) {
              return (result._id.mId === chatId);
            });

            var stats = new ttypes.ChatStats({
              messageCount: processedChat.stats.messageCount,
              participantCount: processedChat.stats.participantCount,
            });

            GB.callCallback(callback, stats);
          })
          .end();
      });
    });
  };

  this.getChatMeta = function(userId, chatId, callback) {
    GB.requiredArguments(userId, chatId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        Chat
          .findOne({
            mId: chatId
          })
          .select('meta')
          .exec()
          .then(function(rawChat){
            var meta = new ttypes.ChatMeta({
              owner: rawChat.meta.owner,
              dateCreated: rawChat.meta.dateCreated,
              name: rawChat.meta.name,
              topic: rawChat.meta.topic
            });

            GB.callCallback(callback, meta);
          })
          .end();
      });
    });
  };

  this.setChatOptions = function(userId, chatId, chatOptions, callback) {
    GB.requiredArguments(userId);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, chatOptions, function(chatId) {
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

};
var p = new P();

var inMemoryPersistence = module.exports = {
  setHashingFunction: function(handler, callback) {
    //lm kill this method
    GB.callCallback(callback);
  },
  isUsernameAvailable: function(username, callback) {
    GB.requiredArguments(username);

    User
      .count({
        username: username
      })
      .exec()
      .then(function(count) {
        var isUsernameAvailable = (count === 0);

        GB.callCallback(callback, isUsernameAvailable);
      })
      .end();
  },
  setUser: function(userId, username, callback) {
    GB.requiredArguments(username);

    // lazy creation of userId
    userId = GB.optional(userId, p.autoId_s());
    // ...and therewith user
    User
      .update({
        mId: userId
      }, {
        $set: {
          username: username,
        },
      }, {
        upsert: true,
      })
      .exec()
      .then(function() {
        GB.callCallback(callback, userId);
      })
      .end();
  },
  getUsername: function(userId, callback) {
    GB.requiredArguments(userId);

    User
      .findOne({
        mId: userId
      })
      .exec()
      .then(function(user) {
        var username = user ? user.username : null;

        GB.callCallback(callback, username);
      })
      .end();
  },
  getUserCount: function(callback) {
    User
      .count()
      .exec()
      .then(function(count) {
        GB.callCallback(callback, count);
      })
      .end();
  },
  getChatStats: p.getChatStats,// abstracted into private to avoid code repetition
  getChatMeta: p.getChatMeta,// abstracted into private to avoid code repetition
  setChatOptions: p.setChatOptions,// abstracted into private to avoid code repetition
  getChat: function(userId, chatId, callback) {
    GB.requiredArguments(userId);

    p.setChatOptions(userId, chatId, undefined, callback);
  },
  getChats: function(sorting, range, callback) {
    GB.requiredArguments(sorting, range);

    // convert the range into something Mongo understands
    slice = p.sliceForRangeMongo_s(range);

    // determine sorting key
    var sortKey;
    switch (sorting) {
      case ttypes.ChatSorting.PARTICIPANT_COUNT: {
        sortKey = 'stats.participantCount';
      } break;

      case ttypes.ChatSorting.MESSAGE_COUNT: {
        sortKey = 'stats.messageCount';
      } break;

      case ttypes.ChatSorting.DATE_CREATED: {
        sortKey = 'meta.dateCreated';
      } break;
    }

    // potentially reverse the chats... by prepending a minus to the sortKey
    if (range.direction === ttypes.RangeDirection.BACKWARDS) sortKey = "-" + sortKey;

    //lm fix this, look at how I do it in the other aggregation example
    Chat
      .aggregate()
      .group({ 
        _id: '$mId',
        // meta: '$meta',
        // stats: { 
          // messageCount: '$stats.messageCount',
          participantCount: { $sum: { $size: '$participantIds' } },
        // }
      })
      .sort(sortKey)
      .skip(Math.abs(slice.skip))
      .limit(slice.limit)
      .exec()
      .then(function(rawChats) {
        var chats = _.map(rawChats, function(rawChat) {
          return new ttypes.Chat({
            id: rawChat.id,
            meta: new ttypes.ChatMeta({
              owner: rawChat.meta.owner,
              dateCreated: rawChat.meta.dateCreated,
              name: rawChat.meta.name,
              topic: rawChat.meta.topic
            }), 
            stats: new ttypes.ChatStats({
              participantCount: rawChat.stats.participantCount,
              messageCount: rawChat.stats.messageCount,
            }),
          });
        });

        GB.callCallback(callback, chats);
      })
      .then(null, function(err) {
        console.log(err);
      })
      .end();
  },
  newMessage: function(userId, chatId, content, callback) {
    GB.requiredArguments(userId, chatId, content);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {

      var rawMessage = {
        dateCreated: GB.getCurrentISODate(),
        authorId: userId,
        content: content,
      };

      Chat
        .update({
          mId: chatId
        }, {
          // insert message
          $push: {
            messages: rawMessage,
          },
          // increment messageCount
          $inc: {
            'stats.messageCount': 1
          },
          // insert participants
          $addToSet: {
            participants: userId,
          },
        })
        .exec()
        .then(function(out) {
          GB.callCallback(callback);
        })
        .end();
      });  
    });
  },
  getMessages: function(userId, chatId, range, callback) {
    GB.requiredArguments(userId, chatId, range);

    p.verifyUser(userId, function() {
      p.lazyChat(chatId, userId, undefined, function(chatId) {
        // convert the range into something JS understands
        var slice = p.sliceForRangeMongo_s(range);

        Chat
          .findOne({
            mId: chatId
          })
          .where('messages').slice([slice.skip, slice.limit])
          .select('messages stats.messageCount')
          .exec()
          .then(function(rawChat) {
            // get author names
            var authorIds = _.uniq(_.map(rawChat.messages, function (rawMessage) {
              return rawMessage.authorId;
            }));

            User
              .where('mId').in(authorIds)
              .exec()
              .then(function(users) {
                // create mapping of userIds to usernames
                var usernameMap = {};
                users.forEach(function(user) {
                  usernameMap[user.mId] = user.username;
                });

                // convert raw messages into Message objects
                var messages = _.map(rawChat.messages, function(rawMessage, index) {
                  // process the tricky fields
                  var seq = ((range.direction === ttypes.RangeDirection.FORWARDS) ? 0 : rawChat.stats.messageCount) + slice.begin + index;
                  var authorName = usernameMap[rawMessage.authorId];

                  return new ttypes.Message({
                    seq:  seq,
                    dateCreated: rawMessage.dateCreated,
                    authorName: authorName,
                    content: rawMessage.content,
                  });
                });

                // potentially reverse the messages
                if (range.direction === ttypes.RangeDirection.BACKWARDS) messages.reverse();

                GB.callCallback(callback, messages);
              })
              .end();
          })
          .end();
      });
    });
  }
};