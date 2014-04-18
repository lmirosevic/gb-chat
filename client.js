var thrift = require('thrift'),
    ChatService = require('./gen-nodejs/ChatService'),
    ttypes = require('./gen-nodejs/ChatService_types');

var connection = thrift.createConnection("localhost", 5000),
    client = thrift.createClient(ChatService, connection);

connection.on('error', function(err) {
  console.error(err);
});

client.alive(function(err, result) {
  console.log(result);
});
