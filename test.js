var mongoose = require('mongoose'),
    ObjectId = mongoose.Schema.ObjectId;


mongoose.connect('mongodb://localhost:27017/chat');

var ObjectId = mongoose.Types.ObjectId;

/* Schema definition */

var userSchema = new mongoose.Schema({
  id:                                     { type: String, index: true },
  username:                               { type: String, index: true },
}, {
  _id:                                    false,
});

var chatSchema = new mongoose.Schema({
  id:                                     { type: String, index: true },
  meta: {
    dateCreated:                          { type: String, index: true },
    name:                                 { type: String },
    topic:                                { type: String },
  },
  participantIds:                         [{ type: String }],
  messages: [{
    dateCreated:                          { type: String },
    content:                              { type: String },
    authorName:                           { type: String }
  }],
}, {
  _id:                                    false,
});

var User = mongoose.model('User', userSchema);
var Chat = mongoose.model('Chat', chatSchema);



// var luka = new User({id: '1', username: 'luka'});
// luka.save(function(err, user) {
//   console.log(user);
// });
