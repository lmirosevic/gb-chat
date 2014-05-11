//
//  toolbox.js
//  Goonbee Toolbox
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore');

var P = function() {
  this.slice = Array.prototype.slice;

  this.requiredSomething = function(what) {
    return function() {
      _.each(arguments, function(argument, index) {
        if (_.isUndefined(argument)) throw new Error('Required ' + what + ' (' + index + ') not supplied');
      });
    };
  };
};
var p = new P();

var Toolbox = function() {
  this.requiredArguments = p.requiredSomething('argument');

  this.requiredVariables = p.requiredSomething('variable');

  this.optional = function(variable, fallback) {
    return ((typeof variable !== 'undefined') && (variable !== null)) ? variable : fallback;
  };

  this.getCurrentISODate = function() {
    return new Date().toISOString();
  };

  this.threshold = function(variable, min, max) {
    if (variable > max) {
      return max;
    }
    else if (variable < min) {
      return min;
    }
    else {
      return variable;
    }
  };

  this.callCallback = function(callback) {
    if ((typeof callback !== 'undefined') && (callback !== null)) callback.apply(callback, p.slice.call(arguments, 1));
  };
};
var toolbox = module.exports = new Toolbox();
