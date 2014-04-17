//
//  GoonbeeSharedService.thrift
//  Goonbee Thrift Shared
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

namespace java goonbee.thirftSharedService
namespace rb Goonbee.ThriftSharedService
namespace js GBThriftSharedService
namespace go GBThriftSharedService
namespace cocoa GBThriftSharedService


enum ErrorType {
	GENERIC = 0,
}

exception RequestError {
	1: ErrorType type,
	2: optional string description,
}


service BaseService {
	/**
	 * check whether the service is alive or not
	 */
	string alive() throws(1: RequestError error),
}
