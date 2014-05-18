//
//  MongoDB.js
//  gb-chat
//
//  Created by Luka Mirosevic on 11/05/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore'),
    nconf = require('nconf'),
    mongoose = require('mongoose'),
    toolbox = require('gb-toolbox'),
    api = require('gb-api'),
    Q = require('q'),
    ttypes = require('../../thrift/gen-nodejs/GoonbeeChatService_types'),
    ttypesShared = require('../../thrift/gen-nodejs/GoonbeeShared_types');

var options = nconf.get('PERSISTENCE').options;

/* Schema */

var userSchema = new mongoose.Schema({
  mId:                                    { type: String, index: { unique: true } },
  username:                               { type: String, index: { unique: true } },
}, {
  _id: false,
});

var chatSchema = new mongoose.Schema({
  mId:                                    { type: String, index: { unique: true } },
  meta: {
    ownerId:                              { type: String },
    dateCreated:                          { type: String, index: true },
    name:                                 { type: String },
    topic:                                { type: String },
  },
  participantIds:                         [{ type: String }],
  messages: [{
    authorId:                             { type: String },
    dateCreated:                          { type: String },
    content:                              { type: String },
  }],
  messageCount:                           { type: Number },
}, {
  _id: false,
});

/* Models */

var User = mongoose.model(options.collectionNamespace + '.' + 'User', userSchema);
var Chat = mongoose.model(options.collectionNamespace + '.' + 'Chat', chatSchema);

/* Connect */

mongoose.connection.on('error', function(err) {
  // try again in a little while
  setTimeout(connect, options.reconnectionTimeout);
});
var connect = function() { 
  console.log('Attempting (re)connection to MongoDB on ' + options.url);
  mongoose.connect(options.url, { autoReconnect: true });
};
connect();

/* Main logic */

var P = function() {
  this.autoId_s = function() {
    var candidate = new mongoose.Types.ObjectId().toString();

    return candidate;
  };

  this.lazyChat = function(chatId, ownerId, chatOptions) {
    toolbox.requiredArguments(ownerId);

    chatOptions = toolbox.optional(chatOptions, {});
    
    // make sure we have a valid chatId
    chatId = toolbox.optional(chatId, p.autoId_s());

    // what we will set on object creation
    var setOnInsertObject = {};
    setOnInsertObject.participantIds = [];
    setOnInsertObject.messages = [];
    setOnInsertObject.messageCount = 0;
    setOnInsertObject['meta.ownerId'] = ownerId;
    setOnInsertObject['meta.dateCreated'] = toolbox.getCurrentISODate();
    if (_.isUndefined(chatOptions.name)) setOnInsertObject['meta.name'] = nconf.get('DEFAULT_CHAT_NAME');

    // some optional customisation that we do each time
    var setObject = {};
    if (!_.isUndefined(chatOptions.name)) setObject['meta.name'] = chatOptions.name;
    if (!_.isUndefined(chatOptions.topic)) setObject['meta.topic'] = chatOptions.topic;

    var updateObject = {};
    if (_.size(setOnInsertObject) > 0) updateObject.$setOnInsert = setOnInsertObject;
    if (_.size(setObject) > 0) updateObject.$set = setObject;

    return Chat
      .update({
        mId: chatId
      }, updateObject, {
        upsert: true,
      })
      .exec()
      .then(function() {
        return chatId;
      });
  };

  this.verifyUser = function(userId) {
    return p.isUserIdRegistered(userId)
      .then(function(isUserIdRegistered) {
        if (!isUserIdRegistered) throw new api.errors.errorTypes.AuthenticationError('The user "' + userId + '" does not exist.');
      });
  };
  
  this.sliceForRangeMongo_s = function(range) {
    var skip;
    var limit;
    switch (range.direction) {
      case ttypesShared.Direction.FORWARDS: {
        skip = range.index;
        limit = range.length;
      } break;

      case ttypesShared.Direction.BACKWARDS: {
        skip = -(range.index + 1);
        limit = range.length;
      } break;
    }

    return {skip: skip, limit: limit};
  };

  this.isUserIdRegistered = function(userId) {
    toolbox.requiredArguments(userId);

    return User
      .count({
        mId: userId
      })
      .exec()
      .then(function(count) {
        var isUserIdRegistered = (count >= 1);

        return isUserIdRegistered;
      });
  };

  this.getChatStats = function(userId, chatId) {
    toolbox.requiredArguments(userId, chatId);
    return p.verifyUser(userId)
      .then(function() {
        return p.lazyChat(chatId, userId)
          .then(function(chatId) {
            return Chat
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
                messageCount: '$_id.messageCount',
                participantCount: '$participantCount',
              })
              .exec()
              .then(function(results) {
                var processedChat = _.find(results, function(result) {
                  return (result._id.mId === chatId);
                });

                var stats = new ttypes.ChatStats({
                  messageCount: processedChat.messageCount,
                  participantCount: processedChat.participantCount,
                });

                return stats;
              });
          });
      });
  };

  this.getChatMeta = function(userId, chatId) {
    toolbox.requiredArguments(userId, chatId);

    return p.verifyUser(userId)
      .then(function() {
        return p.lazyChat(chatId, userId)
          .then(function(chatId) {
            return Chat
              .findOne({
                mId: chatId
              })
              .select('meta')
              .exec()
              .then(function(rawChat){
                var meta = new ttypes.ChatMeta({
                  ownerId: rawChat.meta.ownerId,
                  dateCreated: rawChat.meta.dateCreated,
                  name: rawChat.meta.name,
                  topic: rawChat.meta.topic
                });

                return meta;
              });
          });
      });
  };

};
var p = new P();

var InMemoryPersistence = function() {
  this.isUsernameAvailable = function(username, callback) {
    toolbox.requiredArguments(username);

    User
      .count({
        username: username
      })
      .exec()
      .then(function(count) {
        var isUsernameAvailable = (count === 0);

        toolbox.callCallback(callback, null, isUsernameAvailable);
      })
      .end(callback);
  };

  this.setUser = function(userId, username, callback) {
    toolbox.requiredArguments(username);

    // lazy creation of userId
    userId = toolbox.optional(userId, p.autoId_s());
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
        toolbox.callCallback(callback, null, userId);
      })
      .end(callback);
  };
  
  this.getUsername = function(userId, callback) {
    toolbox.requiredArguments(userId);

    User
      .findOne({
        mId: userId
      })
      .exec()
      .then(function(user) {
        var username = user ? user.username : null;

        toolbox.callCallback(callback, null, username);
      })
      .end(callback);
  };

  this.getUserCount = function(callback) {
    User
      .count()
      .exec()
      .then(function(count) {
        toolbox.callCallback(callback, null, count);
      })
      .end(callback);
  };

  this.getChatStats = function(userId, chatId, callback) {
    p.getChatStats(userId, chatId)
      .then(function(stats) {
        toolbox.callCallback(callback, null, stats);
      })
      .end(callback);
  };

  this.getChatMeta = function(userId, chatId, callback) {
    p.getChatMeta(userId, chatId)
      .then(function(meta) {
        toolbox.callCallback(callback, null, meta);
      })
      .end(callback);
  };

  this.setChatOptions = function(userId, chatId, chatOptions, callback) {
    toolbox.requiredArguments(userId);


    p.verifyUser(userId)
      .then(function() {

        return p.lazyChat(chatId, userId, chatOptions)
          .then(function(chatId) {
            return Q.all([p.getChatStats(userId, chatId), p.getChatMeta(userId, chatId)])
              .spread(function(stats, meta) {
                var chat = new ttypes.Chat({
                  id: chatId,
                  meta: meta,
                  stats: stats,
                });

                toolbox.callCallback(callback, null, chat);
              });
          });
      })
      .end(callback);
  };

  this.getChat = function(userId, chatId, callback) {
    toolbox.requiredArguments(userId);

    inMemoryPersistence.setChatOptions(userId, chatId, undefined, callback);
  };

  this.getChats = function(sorting, range, callback) {
    toolbox.requiredArguments(sorting, range);

    // convert the range into something Mongo understands
    slice = p.sliceForRangeMongo_s(range);

    // determine sorting key
    var sortKey;
    switch (sorting) {
      case ttypes.ChatSorting.PARTICIPANT_COUNT: {
        sortKey = 'participantCount';
      } break;

      case ttypes.ChatSorting.MESSAGE_COUNT: {
        sortKey = '_id.messageCount';
      } break;

      case ttypes.ChatSorting.DATE_CREATED: {
        sortKey = '_id.meta.dateCreated';
      } break;
    }

    // potentially reverse the chats... by prepending a minus to the sortKey
    if (range.direction === ttypesShared.Direction.BACKWARDS) sortKey = "-" + sortKey;

    // calculate the offset
    var skip = slice.skip >= 0 ? slice.skip : -1 - slice.skip;

    Chat
      .aggregate()
      .group({ 
        _id: {
          mId: '$mId',
          messageCount: '$messageCount',
          meta: '$meta'
        },
        participantCount: { $sum: { $size: '$participantIds' } },
      })
      .sort(sortKey)
      .skip(skip)
      .limit(slice.limit)
      .project({
        _id: 0,
        mId: '$_id.mId',
        meta: '$_id.meta',
        messageCount: '$_id.messageCount',
        participantCount: '$participantCount',
      })
      .exec()
      .then(function(results) {
        var chats = _.map(results, function(rawChat) {
          return new ttypes.Chat({
            id: rawChat.mId,
            meta: new ttypes.ChatMeta({
              ownerId: rawChat.meta.ownerId,
              dateCreated: rawChat.meta.dateCreated,
              name: rawChat.meta.name,
              topic: rawChat.meta.topic
            }), 
            stats: new ttypes.ChatStats({
              participantCount: rawChat.participantCount,
              messageCount: rawChat.messageCount,
            }),
          });
        });

        toolbox.callCallback(callback, null, chats);
      })
      .end(callback);
  };

  this.newMessage = function(userId, chatId, content, callback) {
    toolbox.requiredArguments(userId, chatId, content);

    p.verifyUser(userId)
      .then(function() {
        return p.lazyChat(chatId, userId)
          .then(function(chatId) {

            var rawMessage = {
              authorId: userId,
              dateCreated: toolbox.getCurrentISODate(),
              content: content,
            };

            return Chat
              .update({
                mId: chatId
              }, {
                // insert message
                $push: {
                  messages: rawMessage,
                },
                // increment messageCount
                $inc: {
                  'messageCount': 1
                },
                // insert participantIds
                $addToSet: {
                  participantIds: userId,
                },
              })
              .exec()
              .then(function() {
                toolbox.callCallback(callback, null);
              });
          });
      })
      .end(callback);
  };

  this.getMessages = function(userId, chatId, range, callback) {
    toolbox.requiredArguments(userId, chatId, range);

    p.verifyUser(userId)
      .then(function() {
        return p.lazyChat(chatId, userId)
          .then(function(chatId) {
            // convert the range into something JS understands
            var slice = p.sliceForRangeMongo_s(range);

            return Chat
              .findOne({
                mId: chatId
              })
              .where('messages').slice([slice.skip, slice.limit])
              .select('messages messageCount')
              .exec()
              .then(function(rawChat) {
                // get author names
                var authorIds = _.uniq(_.map(rawChat.messages, function (rawMessage) {
                  return rawMessage.authorId;
                }));

                return User
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
                      var seq = ((range.direction === ttypesShared.Direction.FORWARDS) ? 0 : rawChat.messageCount - 1) + slice.skip + index;
                      var authorName = usernameMap[rawMessage.authorId];

                      return new ttypes.Message({
                        seq:  seq,
                        dateCreated: rawMessage.dateCreated,
                        authorName: authorName,
                        content: rawMessage.content,
                      });
                    });

                    // potentially reverse the messages
                    if (range.direction === ttypesShared.Direction.BACKWARDS) messages.reverse();

                    toolbox.callCallback(callback, null, messages);
                  });
              });
          });
      })
      .end(callback);
  };
};
var inMemoryPersistence = module.exports = new InMemoryPersistence();
