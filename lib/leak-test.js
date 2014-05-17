//
//  leak-test.js
//  gb-chat
//
//  Created by Luka Mirosevic on 17/05/2014.
//  Copyright (c) 2014 Goonbee. All rights reserved.
//

var memwatch = require('memwatch');

memwatch.on('leak', function(info) {
  console.log('----------------LEAK!');
  console.log(info);
});
memwatch.on('stats', function(stats) {
  console.log('----------------stats');
  console.log(stats);
});

setInterval(function(){
  global.gc();
  console.log('----------------GC run');
}, 10000);

