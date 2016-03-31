var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose');
  
module.exports = function (app) {
  app.use('/', router);
};

router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Generator-Express MVC'
  });
});

router.get('/comingsoon', function (req, res, next) {
  res.render('comingsoon');
});
