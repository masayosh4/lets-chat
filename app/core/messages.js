'use strict';

var _ = require('lodash'),
    helpers = require('./helpers');

const DbModel = require('../models/');

function MessageManager(options) {
    this.core = options.core;
}

MessageManager.prototype.create = function(options, cb) {
  if (typeof cb !== 'function') {
    cb = function() {};
  }
  let t = null;
  let db_room = null;
  let db_message = null;
  const promise = DbModel.db.transaction().then((p_t) => {
    t = p_t;
    return DbModel.Room.find({
      where: {
        room: options.room,
      },
      transaction: t,
    });
  }).then((room) => {
    if (!room) {
        throw new Error('Room does not exist.');
    }
    if (room.archived) {
        throw new Error('Room is archived.');
    }
    if (!room.isAuthorized(options.owner)) {
        throw new Error('Not authorized.');
    }
    db_room = room;
    return DbModel.Message.create(options, {
      transaction: t,
    });
  }).then((message) => {
    // Touch Room's lastActive
    db_room.lastActive = message.posted;
    return db_room.save();
  }).then((message) => {
    db_message = message;
    return DbModel.User.find({
      where: {
        owner: message.owner,
      },
      transaction: t,
    });
  }).then((user) => {
    cb(null, db_message, db_room, user);
    this.core.emit('messages:new', db_message, db_room, user, options.data);
  }).catch((err) => {
    console.error(err.message);
    return cb(err.message);
  });
  return promise;
};

MessageManager.prototype.list = function(options, cb) {
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
    room: options.room,
  };
  if (options.since_id) {
    where.id = {
      $gt:options.since_id
    };
  }
  if (options.from) {
    where.posted = {
      $gt:options.from
    };
  }
  if (options.to) {
    where.posted = {
      $lte:options.to
    };
  }
  if (options.query) {
    where.text = {
      $like: '%' + options.query + '%',
    };
  }
  let message_include = [];
  if (options.expand) {
    var includes = options.expand.replace(/\s/, '').split(',');

    if (_.includes(includes, 'owner')) {
      message_include.push({
        model: DbModel.Owner,
        attributes: ['id', 'username', 'displayName', 'email', 'avatar'],
      });
    }
    if (_.includes(includes, 'room')) {
      message_include.push({
        model: DbModel.Room,
        attributes: ['id', 'name'],
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
    return DbModel.Room.find({
      where: {
        room: options.room,
      },
    });
  }).then((room) => {
    var opts = {
      userId: options.userId,
      password: options.password
    };
    // インデント深くする
    return room.canJoin(opts)
    .then((canJoin) => {
      if (!canJoin) {
        return cb(null, []);
      }
    }).then(() => {
      return DbModel.Message.findAll({
        where: where,
        include: message_include,
        limit: [offset, limit],
        order: order,
      });
    }).then((messages) => {
      cb(null, messages);
    });
  }).catch((err) => {
    console.error(err.message);
    return cb(err.message);
  });
  return promise;
};

module.exports = MessageManager;
