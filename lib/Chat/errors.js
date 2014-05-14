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
    var NewError = function () {
      var tmp = Error.apply(this, arguments);
      tmp.name = this.name = type;
      this.stack = tmp.stack;
      this.message = tmp.message;

      return this;
    };
    var IntermediateInheritor = function() {};
    IntermediateInheritor.prototype = Error.prototype;
    NewError.prototype = new IntermediateInheritor();

    errorTypes[type] = NewError;
  },
  shouldLogOutput: false,
  shouldLogCalls: false,
  shouldLogErrors: false,
  logRed: function(string) { return console.log(clc.red(string)); },
  logBlue: function(string) { return console.log(clc.blue(string)); },
  logPlain: function(string) { return console.log(string); },
  logCallName: function(string) { return console.log('>>> ' + clc.blue(string)); },
  handleAndLogError: function(callback, err) {
    var convertedError = errors.convertError(err);

    // log error
    if (errors.getShouldLogErrors()) {
      // log the output to the console (in this case a trift error object)
      p.logPlain(convertedError);

      // log a stack track
      if (!_.isUndefined(err.stack)) {
        p.logRed(err.stack);
      }
      else {
        p.logRed(err + '\n    No stack track available.');
      }
    }

    // attempt to send error info to client
    callback.call(callback, errors.convertError(err));
  },
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
    return _.object(_.map(apiObject, function(originalFunction, callName) {
      return [callName, function() {
        var myArguments = arguments;
        var originalCallback = _.last(myArguments);
        var callbackArgumentIndex = _.max(_.keys(myArguments));

        myArguments[callbackArgumentIndex] = function(err, output) {
          // clean call
          if (_.isUndefined(err) || _.isNull(err)) {
            // log the output to the console
            if (errors.getShouldLogOutput()) p.logPlain(output);

            originalCallback(null, output); 
          }
          // callback style error
          else {
            p.handleAndLogError(originalCallback, err);
          }
        };

        try {
          // log the call name to the console
          if (errors.getShouldLogCalls()) p.logCallName(callName);

          // make the original call with the modified arguments
          originalFunction.apply(originalFunction, myArguments);
        }
        // throw style error
        catch (err) {
          p.handleAndLogError(originalCallback, err);
        }
      }];
    }));
  },
  // errorHandledAPI: function(apiObject) {
  //   var wrappedApiObject = _.clone(apiObject);
  //   _.each(wrappedApiObject, function(originalFunction, callName, list) {
  //     list[callName] = function() {
  //       var myArguments = arguments;
  //       var originalCallback = _.last(myArguments);
  //       var callbackArgumentIndex = _.max(_.keys(myArguments));

  //       myArguments[callbackArgumentIndex] = function(err, output) {
  //         // clean call
  //         if (_.isUndefined(err) || _.isNull(err)) {
  //           // log the output to the console
  //           if (errors.getShouldLogOutput()) p.logPlain(output);

  //           originalCallback(null, output); 
  //         }
  //         // callback style error
  //         else {
  //           p.handleAndLogError(originalCallback, err);
  //         }
  //       };

  //       try {
  //         // log the call name to the console
  //         if (errors.getShouldLogCalls()) p.logCallName(callName);

  //         // make the original call with the modified arguments
  //         originalFunction.apply(originalFunction, _.toArray(myArguments));
  //       }
  //       // throw style error
  //       catch (err) {
  //         p.handleAndLogError(originalCallback, err);
  //       }
  //     };
  //   });
  //   return wrappedApiObject;
  // },
};
_.extend(module.exports, errors);

p.makeError('GenericError');
p.makeError('AuthenticationError');
