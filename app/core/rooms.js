'use strict';

var _ = require('lodash'),
    helpers = require('./helpers');

const DbModel = require('../models/');

var getParticipants = function(room, options, cb) {
    if (!room.private || !options.participants) {
        return cb(null, []);
    }

    var participants = [];

    if (Array.isArray(options.participants)) {
        participants = options.participants;
    }

    if (typeof options.participants === 'string') {
        participants = options.participants.replace(/@/g, '')
            .split(',').map(function(username) {
                return username.trim();
            });
    }

    participants = _.chain(participants)
        .map(function(username) {
            return username && username.replace(/@,\s/g, '').trim();
        })
        .filter(function(username) { return !!username; })
        .uniq()
        .value();

    const promise = Promise.resolve().then(() => {
      return DbModel.User.find({
        where: {
          username: {
            $in: participants,
          },
        },
      });
    }).then(() => {
      cb();
    });
    return promise;
};

function RoomManager(options) {
    this.core = options.core;
}

RoomManager.prototype.canJoin = function(options, cb) {
console.log('RoomManager.prototype.canJoin', options);
    var method = options.id ? 'get' : 'slug',
        roomId = options.id ? options.id : options.slug;

    this[method](roomId, function(err, room) {
        if (err) {
            return cb(err);
        }

        if (!room) {
            return cb();
        }
        return room.canJoin(options, (err, canJoin) => {
          if (!canJoin) {
            return cb(null, []);
          }
          cb(err, room, canJoin);
        });
    });
};

RoomManager.prototype.create = function(options, cb) {
console.log('RoomManager.prototype.create', options);
    return DbModel.Room.create(options)
    .then((room) => {
      return DbModel.Room.find({
        include: [{
          model: DbModel.User,
          as: 'owner',
        }, {
          model: DbModel.User,
          as: 'participants',
        }],
        where: {
          id: room.id,
        },
      });
    }).then((room) => {
      cb(null, room);
      this.core.emit('rooms:new', room);
    }).catch((err) => {
      return cb(err);
    });
};

RoomManager.prototype.update = function(roomId, options, cb) {
console.log('RoomManager.prototype.update');
    const promise =  DbModel.Room.find({
      include: [{
        model: DbModel.User,
        as: 'owner',
      }, {
        model: DbModel.User,
        as: 'participants',
      }],
      where: {
        id: roomId,
      }
    }).then((room) => {
        if (!room) {
          throw new Error('Room does not exist.');
        }
        if(room.private && room.owner_id != options.user.id) {
          throw new Error('Only owner can change private room.');
        }
        return new Promise((resolve) => {
          return getParticipants(room, options, function(err, participants) {
            if (err) {
              // Oh noes, a bad thing happened!
              console.error(err);
              return new Error(err);
            }
            resolve([participants, room]);
          });
        });
    }).then((result) => {
      let participants = result[0];
      let room = result[1];
      room.name = options.name;
      // DO NOT UPDATE SLUG
      // room.slug = options.slug;
      room.description = options.description;

      if (room.private) {
          room.password = options.password;
          room.participants = participants;
      }
      return room.save();
    }).then((room) => {
      cb(null, room);
      this.core.emit('rooms:update', room);
    }).catch((err) => {
      console.log(err);
      return cb(err);
    });
    return promise;
};

RoomManager.prototype.archive = function(roomId, cb) {
console.log('RoomManager.prototype.archive');
  const promise = Promise.resolve().then(() => {
    return DbModel.Room.find({
      include: [{
        model: DbModel.User,
        as: 'owner',
      }, {
        model: DbModel.User,
        as: 'participants',
      }],
      where: {
        id: roomId,
      },
    });
  }).then((room) => {
    if (!room) {
      throw new Error('Room does not exist.');
    }
    room.archived = true;
    return room.save();
  }).then((room) => {
    cb(null, room);
    this.core.emit('rooms:archive', room);
  }).catch((err) => {
    console.log(err);
    return cb(err);
  });
  return promise;
};

RoomManager.prototype.list = function(options, cb) {
console.log('RoomManager.prototype.list:', options);
  options = options || {};

  options = helpers.sanitizeQuery(options, {
      defaults: {
          take: 500
      },
      maxTake: 5000
  });
  let where = {
    archived: {
      $ne: true,
    },
    $or: [
      {private: false},
      {owner_id: options.userId},
//      {participants: options.userId},
      {password: {
        $ne: ''
      }}
    ]
  };
  let offset = 0;
  let limit = options.take;
  let order = [];
  if (options.skip) {
    offset = options.skip;
  }
  if (options.sort) {
    //var sort = options.sort.replace(',', ' ');
    order = [['posted', 'ASC']];
  } else {
    order = [['lastActive', 'DESC']];
  }
  let room_include = [];
  room_include.push({
    model: DbModel.User,
    as: 'owner',
  });
  room_include.push({
    model: DbModel.User,
    as: 'participants',
  });

  return DbModel.Room.findAll({
    where: where,
    include: room_include,
    limit: [offset, limit],
    order: order,
  }).then((rooms) => {
    _.each(rooms, function(room) {
        this.sanitizeRoom(options, room);
    }.bind(this));
  
    if (options.users && !options.sort) {
        rooms = _.sortBy(rooms, ['userCount', 'lastActive'])
                 .reverse();
    }
    cb(null, rooms);
  });
};

RoomManager.prototype.sanitizeRoom = function(options, room) {
console.log('RoomManager.prototype.sanitizeRoom');
    var authorized = options.userId && room.isAuthorized(options.userId);

    if (options.users) {
        if (authorized) {
            room.users = this.core.presence
                        .getUsersForRoom(room.id.toString());
        } else {
            room.users = [];
        }
    }
};

RoomManager.prototype.findOne = function(options, cb) {
console.log('RoomManager.prototype.findOne:', options);
  return DbModel.Room.find({
    include: [{
      model: DbModel.User,
      as: 'owner',
    }, {
      model: DbModel.User,
      as: 'participants',
    }],
    where: options.criteria,
  }).then((room) => {
    this.sanitizeRoom(options, room);
    cb(null, room);
  }).catch((err) => {
    return cb(err);
  });
};

RoomManager.prototype.get = function(options, cb) {
console.log('RoomManager.prototype.get');
    var identifier;

    if (options !== Object(options)) {
        // オブジェクト以外
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        id: identifier,
        archived: { $ne: true }
    };

    this.findOne(options, cb);
};

RoomManager.prototype.slug = function(options, cb) {
console.log('RoomManager.prototype.slug');
    var identifier;

    if (typeof options === 'string') {
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        slug: identifier,
        archived: { $ne: true }
    };

    this.findOne(options, cb);
};

module.exports = RoomManager;
