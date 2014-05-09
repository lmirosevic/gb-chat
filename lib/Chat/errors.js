//
//  errors.js
//  GBChatService
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//


//lm subsequent stack traces don't seem to show up

var _ = require('underscore');
    clc = require('cli-color');

var ttypes = require('../../gen-nodejs/GoonbeeChatService_types');


var errorTypes = module.exports.errorTypes = {};

var p = {
  makeError: function(type) {
    errorTypes[type] = function(message) {
      this.protype = new Error();
      this.message = message;
      this.constructor.prototype = Object.create(Error.prototype);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.toString = function() {
        return type + ': ' + message + ' :';
      };
    };
  },
  shouldLogOutput: false,
  shouldLogCalls: false,
  shouldLogErrors: false,
  logRed: function(string) { return console.log(clc.red(string)); },
  logBlue: function(string) { return console.log(clc.blue(string)); },
  logPlain: function(string) { return console.log(string); },
  logCallName: function(string) { return console.log('>>> ' + clc.blue(string)); },
};

var errors = {
  setShouldLogOutput: function(shouldLogOutput) {
    p.shouldLogOutput = shouldLogOutput;
  },
  getShouldLogOutput: function() {
    return p.shouldLogOutput;
  },
  setShouldLogCalls: function(shouldLogCalls) {
    p.shouldLogCalls = shouldLogCalls;
  },
  getShouldLogCalls: function() {
    return p.shouldLogCalls;
  },
  setShouldLogErrors: function(shouldLogErrors) {
    p.shouldLogErrors = shouldLogErrors;
  },
  getShouldLogErrors: function() {
    return p.shouldLogErrors;
  },
  convertError: function(e) {
    if (e instanceof errorTypes.GenericError) {
      return new ttypes.RequestError({status: ttypes.ResponseStatus.GENERIC, message: e.message});
    }
    else if (e instanceof errorTypes.AuthenticationError) {
      return new ttypes.RequestError({status: ttypes.ResponseStatus.AUTHENTICATION, message: e.message});
    }
    else {
      return new ttypes.RequestError({status: ttypes.ResponseStatus.GENERIC, message: 'Unknown error occurred'}); 
    }
  },
  errorHandledAPI: function(apiObject) {
    var wrappedApiObject = _.clone(apiObject);
    _.each(wrappedApiObject, function(originalFunction, callName, list) {
      list[callName] = function() {
        var originalArguments = arguments;
        var modifiedArguments = _.clone(originalArguments);
        modifiedArguments[_.max(_.keys(originalArguments))] = function(output) {
          // log the output to the console
          if (errors.getShouldLogOutput()) p.logPlain(output);

          _.last(originalArguments)(null, output);
        };
        try {
          // log the call name to the console
          if (errors.getShouldLogCalls()) p.logCallName(callName);

          // make the original call with the modified arguments
          originalFunction.apply(originalFunction, _.toArray(modifiedArguments));
        }
        catch (e) {
          var convertedError = errors.convertError(e);

          if (errors.getShouldLogErrors()) {
            // log the output to the console (in this case a trift error object)
            p.logPlain(convertedError);

            // log a stack track
            if (!_.isUndefined(e.stack)) {
              p.logRed(e.stack);
            }
            else {
              p.logRed(e + '\n    No stack track available.');
            }
          }

          // attempt to send error info to client
          _.last(originalArguments)(convertedError);
        }
      };
    });
    return wrappedApiObject;
  },
};
_.extend(module.exports, errors);

p.makeError('GenericError');
p.makeError('AuthenticationError');
