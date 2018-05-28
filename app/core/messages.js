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
  let db_user = null;
  const promise = DbModel.db.transaction().then((p_t) => {
    t = p_t;
    return DbModel.Room.find({
      include: [{
        model: DbModel.User,
        as: 'owner',
      }, {
        model: DbModel.User,
        as: 'participants',
      }],
      where: {
        id: options.room,
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
    return DbModel.Message.create({
      room_id: options.room,
      owner_id: options.owner,
      text: options.text,
    }, {
      transaction: t,
    });
  }).then((message) => {
    db_message = message;
    // Touch Room's lastActive
    db_room.lastActive = message.posted;
    return db_room.save({transaction: t});
  }).then(() => {
    return DbModel.User.find({
      where: {
        id: db_message.owner_id,
      },
      transaction: t,
    });
  }).then((user) => {
    db_user = user;
    return t.commit();
  }).then(() => {
    cb(null, db_message, db_room, db_user);
    this.core.emit('messages:new', db_message, db_room, db_user, options.data);
  }).catch((err) => {
    console.log(err);
    return cb(err);
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
    room_id: options.room,
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
        model: DbModel.User,
        as: 'owner',
        attributes: ['id', 'username', 'displayName', 'email'],
      });
    }
    if (_.includes(includes, 'room')) {
      message_include.push({
        model: DbModel.Room,
        attributes: ['id', 'name'],
        include: [{
          model: DbModel.User,
          as: 'owner',
        }, {
          model: DbModel.User,
          as: 'participants',
        }],
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
        id: options.room,
      },
    });
  }).then((room) => {
    var opts = {
      userId: options.userId,
      password: options.password
    };
    return new Promise((resolve, reject) => {
      return room.canJoin(opts, (err, canJoin) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(canJoin);
      });
    });
  }).then((canJoin) => {
    if (!canJoin) {
      return cb(null, []);
    }
    return DbModel.Message.findAll({
      where: where,
      include: message_include,
      limit: [offset, limit],
      order: order,
    }).then((messages) => {
      cb(null, messages);
    });
  }).catch((err) => {
    console.log(err);
    return cb(err);
  });
  return promise;
};

module.exports = MessageManager;
