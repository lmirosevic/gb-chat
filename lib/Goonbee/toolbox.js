//
//  toolbox.js
//  Goonbee Toolbox
//
//  Created by Luka Mirosevic on 17/04/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var _ = require('underscore');

var p = {
  requiredSomething: function(what) {
    return function() {
      _.each(arguments, function(argument, index) {
        if (_.isUndefined(argument)) throw new Error('Required ' + what + ' (' + index + ') not supplied');
      });
    };
  },
};

module.exports = {
  requiredArguments: p.requiredSomething('argument'),
  requiredVariables: p.requiredSomething('variable'),
  optional: function(variable, fallback) {
    return ((typeof variable !== 'undefined') && (variable !== null)) ? variable : fallback;
  },
  getCurrentISODate: function() {
    return new Date().toISOString();
  },
  threshold: function(variable, min, max) {
    if (variable > max) {
      return max;
    }
    else if (variable < min) {
      return min;
    }
    else {
      return variable;
    }
  }
};
