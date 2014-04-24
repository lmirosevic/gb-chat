//
//  errors.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var errorTypes = module.exports.errorTypes = {};

var p = {
  makeError: function(type) {
    errorTypes[type] = function(message) {
      this.protype = new Error();
      this.message = message;
    };
  },
};

var errors = {
  convertError: function(e) {
    if (e instanceof errorTypes.GenericError) {
      return new ttypes.RequestError({type: ttypes.ErrorType.GENERIC, description: e.message});
    }
    else if (e instanceof errorTypes.AuthenticationError) {
      return new ttypes.RequestError({type: ttypes.ErrorType.AUTHENTICATION, description: e.message});
    }
  },
  errorHandledAPI: function(apiObject) {
    apiObject = _.map(apiObject, function(originalFunction) {
      return function() {
        try {
          originalFunction.apply(originalFunction, arguments.slice(0, -1).push(function(output) {
            _.last(arguments).call(null, output);
          }));
        }
        catch (e) {
          _.last(arguments).call(errors.convertError(e));
        }
      };
    });
  },
};
_.extend(module.exports, errors);

p.makeError('GenericError');
p.makeError('AuthenticationError');
