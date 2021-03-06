var thrift = require('thrift'),
    GBChatService = require('./thrift/gen-nodejs/GoonbeeChatService'),
    ttypes = require('./thrift/gen-nodejs/GoonbeeChatService_types'),
    ttypesShared = require('./thrift/gen-nodejs/GoonbeeShared_types'),
    clc = require('cli-color');

var connection = thrift.createConnection("localhost", 56101),
    client = thrift.createClient(GBChatService, connection);

connection.on('error', function(err) {
  console.error(err);
});

var resultLogger = function(err, result) {
  console.log('----------');
  console.log(clc.blue(result));
  console.log(clc.red(err ? err.status.toString() + ': ' + err : ''));
  console.log('----------');
};

client.setChatOptions('nonsense', 'anychat', null, resultLogger);



// // // client.alive(resultLogger);
// client.isUsernameAvailable('luka', function(err, result) {
//   resultLogger.apply(this, arguments);

//   var isUsernameAvailable = result;

//   if (isUsernameAvailable) {
//     client.registerUsername(null, "luka", function(err, result) {
//       resultLogger.apply(this, arguments);

//       var userId = result;

//       whatToDo(userId);
//     });
//   }
//   else {
//     whatToDo('5371eca27ba5e6ce1bf04077');
//   }
// });

// //what to do with our logged in user
// var whatToDo = function(userId) {
//   client.messages(userId, 'dogchat', new ttypesShared.Range({direction: ttypesShared.Direction.FORWARDS, index: 0, length: 10}));

//   //foo try that one
//   // client.setChatOptions(userId, 'dogchat', new ttypes.ChatOptions({name: "luka's chat", topic: "all about dogs"}), resultLogger);

//   // client.chats(ttypes.ChatSorting.PARTICIPANT_COUNT, new ttypesShared.Range({direction: ttypesShared.Direction.FORWARDS, index: 0, length: 10}), resultLogger);
// };

