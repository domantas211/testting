// User model

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var JackpotSchema = new Schema({
  pot: [
  	{type: Schema.Types.ObjectId, ref: 'Item'}
  ]
});

mongoose.model('Jackpot', JackpotSchema);