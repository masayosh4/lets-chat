'use strict';

var _ = require('lodash'),
    helpers = require('./helpers');

const DbModel = require('../models/');

function UserMessageManager(options) {
    this.core = options.core;
}

// options.currentUser, options.user

UserMessageManager.prototype.onMessageCreated = function(message, user, options, cb) {
  return DbModel.User.find({
    where: {
      id: message.owner,
    },
  }).then((owner) => {
    cb(null, message, user, owner);
    this.core.emit('user-messages:new', message, user, owner, options.data);
  }).catch((err) => {
    console.error(err);
    return cb(err);
  });
};

UserMessageManager.prototype.create = function(options, cb) {
  return Promise.resolve().then(() => {
    return DbModel.User.find({
      where: {
        id:options.user,
      },
    });
  }).then((user) => {
    if (!user) {
      throw new Error('User does not exist.');
    }
    var data = {
      users: [options.owner, options.user],
      owner: options.owner,
      text: options.text
    };
    var message = DbModel.UserMessage.build(data);
    // Test if this message is OTR
    if (data.text.match(/^\?OTR/)) {
      message.id = 'OTR';
      this.onMessageCreated(message, user, options, cb);
    } else {
      return message.save().then(() => {
        this.onMessageCreated(message, user, options, cb);
      });
    }
  }).catch((err) => {
    console.error(err);
    return cb(err);
  });
};

UserMessageManager.prototype.list = function(options, cb) {
  options = options || {};

  if (!options.room) {
      return cb(null, []);
  }

  options = helpers.sanitizeQuery(options, {
      defaults: {
          reverse: true,
          take: 500
      },
      maxTake: 5000
  });

  let where = {
    users: { $in: [options.currentUser, options.user] }
  };

  if (options.since_id) {
    where.id = {
      $gt: options.since_id,
    };
  }
  if (options.from) {
    where.posted = where.posted || {};
    where.posted.$gt = options.from;
  }
  if (options.to) {
    where.posted = where.posted || {};
    where.posted.$lte = options.to;
  }
  
  let user_message_include = [];
  if (options.expand) {
      var includes = options.expand.split(',');
      if (_.includes(includes, 'owner')) {
        user_message_include.push({
          model: DbModel.Owner,
          attributes: ['id', 'username', 'displayName', 'email', 'avatar'],
        });
      }
  }
  let offset = 0;
  let limit = options.take;
  let order = [];
  if (options.skip) {
    offset = options.skip;
  }
  if (options.reverse) {
    order = [['posted', 'DESC']];
  } else {
    order = [['posted', 'ASC']];
  }
  const promise = Promise.resolve().then(() => {
    return DbModel.UserMessage.findAll({
      where: where,
      include: user_message_include,
      limit: [offset, limit],
      order: order,
    });
  }).then((messages) => {
    cb(null, messages);
  }).catch((err) => {
    console.error(err.message);
    return cb(err.message);
  });
  return promise;
};

module.exports = UserMessageManager;
