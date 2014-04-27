//
//  ChatService.thrift
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

include "GoonbeeSharedThriftService.thrift"


namespace js GBChatService
namespace cocoa GBChat


enum ChatSorting {
	PARTICIPANTS = 0,
	MESSAGE_COUNT,
	DATE_CREATED,
}

enum ResponseStatus {
	SUCCESS = 0,
	GENERIC = 1,
	MALFORMED_REQUEST = 2,
	AUTHENTICATION = 3,
	AUTHORIZATION = 4,
	PHASED_OUT = 5,
}

struct Range {
	1: i32 index,
	2: i32 length,
}

struct ChatStats {
	1: i32 messageCount,
	2: i32 participantCount,
}

struct ChatMeta {
	1: optional string owner,
	2: optional string dateCreated,
	3: optional string name,
	4: optional string topic,
}

struct Chat {
	1: string id,
	2: ChatMeta meta,
	3: ChatStats stats,
}

struct Message {
	1: optional i32 seq,
	2: optional string date,
	3: optional string author,
	4: string message,
}

exception RequestError {
	1: ResponseStatus status,
	2: optional string message,
}


service GoonbeeChatService extends GoonbeeSharedThriftService.GoonbeeSharedThriftService {
	/**
	 * Check whether the username is available or not
	 */
	bool				isUsernameAvailable		(1: string username)												throws(1: RequestError error),

	/**
	 * Register a username, or change it if you are already registered. pass null or empty string to userId if not registered, returns userId on success
	 */
	string 				registerUsername		(1: string userId, 2: string username)								throws(1: RequestError error),

	/**
	 * Create a new chat channel. Chats are created lazily so this method is identical to `chat` with an added chatMeta parameter
	 */
	Chat 				newChat					(1: string userId, 2: string chatId, 3: ChatMeta chatMeta)			throws(1: RequestError error),

	/**
	 * Returns info on all available chat channels (e.g. how many messages, participators, date created, etc.)
	 */
	list<Chat> 			chats					(1: ChatSorting sorting, 2: Range range)							throws(1: RequestError error),

	/**
	 * Returns info on a particular chat channel
	 */
	Chat 				chat 	 				(1: string userId, 2: string chatId)								throws(1: RequestError error),

	/**
	 * Post a new message on a certain chat channel
	 */
	void				newMessage				(1: string userId, 2: string chatId, 3: Message message)			throws(1: RequestError error),

	/**
	 * Returns messags for a chat channel, according to range
	 */
	list<Message> 		messages				(1: string userId, 2: string chatId, 3: Range range)				throws(1: RequestError error),

	/**
	 * Update a chat's meta. This is an alias for newChat, which creates chats lazily
	 */
	Chat 				setChatMeta				(1: string userId, 2: string chatId, 3: ChatMeta chatMeta)			throws(1: RequestError error),

	/**
	 * Get the total number of users registered with the chat service
	 */
	i32					globalUserCount			()																	throws(1: RequestError error),
}

/*

Bool				isUsernameAvailable		(String username)										//lets you check whether the username is available or not
String 				registerUsername		(String userId[optional], String username)				//lets you register a username, or change it if you are already registered

Void 				newChat					(String userId, ChatMeta chatMeta)						//create a new chat channel
Array<Chat> 		chats					(ChatSorting sorting, Range range)						//return info on all available chat channels (e.g. how many messages, participators, date created, etc.)
Chat 				chat 	 				(String chatId)											//returns info on a particular channel

Void				newMessage				(String userId, String chatId, Message message)			//posts a new message on a certain chat channel
Array<Message> 		messages				(String chatId, Range range)							//returns messags for a chat channel, according to range


Void 				setChatMeta				(String chatId, ChatMeta chatMeta)						//let's you update a chat's options
Int					globalUserCount			()



struct Chat {
	1: required string id
	2: required ChatMeta meta
	3: required ChatStats stats
}

struct ChatStats {
	1: required Int messageCount
	2: required Int participantCount
}

struct ChatMeta {
	String name
	String topic
	String dateCreated
}

struct Message {
	Int seq
	String date
	String author
	String message
}

enum ChatSorting {
	participantCount
	messageCount
	messageVelocity
	dateCreated
}

struct Range {
	Int index
	int length
}

*/
