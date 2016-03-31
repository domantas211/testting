var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env = process.env.NODE_ENV || 'development';

var config = {
  development: {
    root: rootPath,
    app: {
      name: 'tossup'
    },
    port: 3000,
    db: 'mongodb://localhost/tossup-development'
  },

  test: {
    root: rootPath,
    app: {
      name: 'tossup'
    },
    port: 3000,
    db: 'mongodb://localhost/tossup-test'
  },

  production: {
    root: rootPath,
    app: {
      name: 'tossup'
    },
    port: 80,
    db: 'mongodb://localhost/tossup-production'
  }
};

module.exports = config[env];
