// Item model

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var ItemSchema = new Schema({
  classid: Number,
  instanceid: Number,
  name: String,
  image: String,
  price: Number // in keys
});

module.exports = mongoose.model('Item', ItemSchema);

