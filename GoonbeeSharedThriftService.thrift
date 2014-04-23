//
//  GoonbeeSharedThriftService.thrift
//  Goonbee Thrift Shared
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

namespace java goonbee.sharedThriftService
namespace rb Goonbee.sharedThriftService
namespace js GBSharedThriftService
namespace go GBSharedThriftService
namespace cocoa GBSharedThriftService


enum ErrorType {
	GENERIC = 0,
	SUCCESS = 1,
	MALFORMED_REQUEST = 2,
	AUTHENTICATION = 3,
	AUTHORIZATION = 4,
	PHASED_OUT = 5,
}

exception RequestError {
	1: ErrorType type,
	2: optional string description,
}


service GoonbeeSharedThriftService {
	/**
	 * check whether the service is alive or not
	 */
	string alive() throws(1: RequestError error),
}
