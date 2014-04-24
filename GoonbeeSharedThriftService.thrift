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


service GoonbeeSharedThriftService {
	/**
	 * check whether the service is alive or not
	 */
	string alive();
}
