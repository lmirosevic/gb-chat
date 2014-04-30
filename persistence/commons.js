//
//  commons.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var ttypes = require('../gen-nodejs/GoonbeeChatService_types');


var persistenceCommons = module.exports = {
	ChatSorting: {
		'PARTICIPANTS' : 0,
		'MESSAGE_COUNT' : 1,
		'DATE_CREATED' : 2
	},
  converters: {
    apiToPersistence: {
      chat: function(chat) {
        return {id: chat.id, meta: this.chatMeta(chat.meta), stats: this.chatStats(chat.stats)};
      },
      chatMeta: function(chatMeta) {
        return {owner: chatMeta.owner, dateCreated: chatMeta.dateCreated, name: chatMeta.name, topic: chatMeta.topic};
      },
      chatStats: function(chatStats) {
        return {messageCount: chatStats.messageCount, participantCount: chatStats.participantCount};
      },
      range: function(range) {
        return {index: range.index, length: range.length};
      },
      sorting: function(sorting) {
        var sortingP;
        switch (sorting) {
          case GBChatService.ChatSorting.PARTICIPANTS: {
            sortingP = persistenceCommons.ChatSorting.PARTICIPANTS;
          } break;
          case GBChatService.ChatSorting.MESSAGE_COUNT: {
            sortingP = persistenceCommons.ChatSorting.MESSAGE_COUNT;
          } break;
          case GBChatService.ChatSorting.DATE_CREATED: {
            sortingP = persistenceCommons.ChatSorting.DATE_CREATED;
          } break;
        }

        return sortingP;
      },
      message: function(message) {
        return {seq: message.seq, date: message.date, author: message.author, message: message.message};
      }
    },
    persistenceToApi: {
      chat: function(chatP) {
        return new ttypes.Chat({id: chatP.id, meta: this.chatMeta(chatP.meta), stats: this.chatStats(chatP.stats)});
      },
      chatMeta: function(chatMetaP) {
        return new ttypes.ChatMeta({owner: chatMetaP.owner, name: chatMetaP.name, topic: chatMetaP.topic, dateCreated: chatMetaP.dateCreated});
      },
      chatStats: function(chatStatsP) {  
        return new ttypes.ChatStats({messageCount: chatStatsP.messageCount, participantCount: chatStatsP.participantCount});
      },
      range: function(rangeP) {
        return new ttypes.Range({index: rangeP.index, length: rangeP.length});
      },
      sorting: function(sortingP) {
        var sorting;
        switch (sortingP) {
          case persistenceCommons.ChatSorting.PARTICIPANTS: {
            sorting = GBChatService.ChatSorting.PARTICIPANTS;
          } break;
          case persistenceCommons.ChatSorting.MESSAGE_COUNT: {
            sorting = GBChatService.ChatSorting.MESSAGE_COUNT;
          } break;
          case persistenceCommons.ChatSorting.DATE_CREATED: {
            sorting = GBChatService.ChatSorting.DATE_CREATED;
          } break;
        }
        
        return sorting;
      },
      message: function(messageP) {
        return new ttypes.Message({seq: messageP.seq, date: messageP.date, author: messageP.author, message: messageP.message});
      }
    }
  }
};
