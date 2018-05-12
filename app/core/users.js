'use strict';

var helpers = require('./helpers');
const DbModel = require('../models/');

function UserManager(options) {
    this.core = options.core;
}

UserManager.prototype.list = function(options, cb) {
  options = options || {};

  options = helpers.sanitizeQuery(options, {
    defaults: {
      take: 500
    },
    maxTake: 5000
  });

  let offset = 0;
  let limit = options.take;
  if (options.skip) {
    offset = options.skip;
  }
  return DbModel.User.findAll({
    limit: [offset, limit],
  }).then((users) => {
    cb(null, users);
  });
};

UserManager.prototype.get = function(identifier, cb) {
  return DbModel.User.find({
    where: {
      id: identifier,
    }
  }).then((user) => {
    cb(null, user);
  });
};

UserManager.prototype.username = function(username, cb) {
  return DbModel.User.find({
    where: {
      username: username,
    }
  }).then((user) => {
    cb(null, user);
  });
};

module.exports = UserManager;
