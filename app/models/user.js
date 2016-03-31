// User model

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var UserSchema = new Schema({
  name: String,
  steamid: String,
  profilePicture: String,
  credits: {type: Number, default: 0},
  banned: Boolean,
  tradeToken: String,
  referralLink: String
});

mongoose.model('User', UserSchema);

