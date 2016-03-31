var express = require('express')
var app = module.exports = express.createServer();

app.configure(function(){
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
});

app.get('/', function(){
    res.render('index', {option: 'value'});
});