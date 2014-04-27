//
//  errors.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore');

var ttypes = require('../../gen-nodejs/GoonbeeChatService_types');


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
      return new ttypes.RequestError({status: ttypes.ResponseStatus.GENERIC, message: e.message});
    }
    else if (e instanceof errorTypes.AuthenticationError) {
      return new ttypes.RequestError({status: ttypes.ResponseStatus.AUTHENTICATION, message: e.message});
    }
  },
  errorHandledAPI: function(apiObject) {
    var wrappedApiObject = _.clone(apiObject);
    _.each(wrappedApiObject, function(originalFunction, key, list) {
      list[key] = function() {
        var originalArguments = arguments;
        var modifiedArguments = _.clone(originalArguments);
        modifiedArguments[_.max(_.keys(originalArguments))] = function(output) {
          _.last(originalArguments)(null, output);
        };
        try {
          //lm maybe add some logging here
          originalFunction.apply(originalFunction, _.toArray(modifiedArguments));
        }
        catch (e) {
          //lm would be good to dump a stack trace here
          _.last(originalArguments)(errors.convertError(e));
        }
      };
    });
    return wrappedApiObject;
  },
};
_.extend(module.exports, errors);

p.makeError('GenericError');
p.makeError('AuthenticationError');
