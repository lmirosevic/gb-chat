var _ = require('underscore');

var users = [],
    chats = {},
    messages ;
  
var InMemoryPersistence = module.exports = {
  userExists: function(username) {
    return !_.contains(users, username);
  },

};


// var chat = {
//   id: "",
//   meta: "",
//   messages: "",
// };
