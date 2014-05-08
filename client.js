var thrift = require('thrift'),
    GBChatService = require('./gen-nodejs/GoonbeeChatService'),
    ttypes = require('./gen-nodejs/GoonbeeChatService_types'),
    clc = require('cli-color');

var connection = thrift.createConnection("localhost", 56475),
    client = thrift.createClient(GBChatService, connection);

connection.on('error', function(err) {
  console.error(err);
});

var resultLogger = function(err, result) {
  console.log('----------');
  console.log(clc.blue(result));
  console.log(clc.red(err));
  console.log('----------');
};

// client.alive(resultLogger);
// client.isUsernameAvailable("luka", resultLogger);
client.registerUsername(null, "luka", function(err, result) {
  var userId = result;
  resultLogger.apply(this, arguments);

  client.newChat(userId, null, new ttypes.ChatOptions({name: "luka's chat", topic: "all about dogs"}), resultLogger);
});


