var thrift = require('thrift'),
    GoonbeeChatService = require('./gen-nodejs/GoonbeeChatService'),
    ttypes = require('./gen-nodejs/GoonbeeChatService');

var connection = thrift.createConnection("localhost", 56475),
    client = thrift.createClient(GoonbeeChatService, connection);

connection.on('error', function(err) {
  console.error(err);
});

client.alive(function(err, result) {
  console.log('----------');
  console.log(err);
  console.log(result);
  console.log('----------');
});

// client.isUsernameAvailable("luka", function(err, result) {
//   console.log('----------');
//   console.log(err);
// 	console.log(result);
//   console.log('----------');
// });
