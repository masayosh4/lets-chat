'use strict';

var _ = require('lodash'),
    helpers = require('./helpers'),
    plugins = require('./../plugins'),
    settings = require('./../config').files;

var enabled = settings.enable;
const DbModel = require('../models/');

function FileManager(options) {
    this.core = options.core;

    if (!enabled) {
        return;
    }

    var Provider;

    if (settings.provider === 'local') {
        Provider = require('./files/local');
    } else {
        Provider = plugins.getPlugin(settings.provider, 'files');
    }

    this.provider = new Provider(settings[settings.provider]);
}

FileManager.prototype.create = function(options, cb) {
  if (!enabled) {
      return cb('Files are disabled.');
  }

  if (settings.restrictTypes &&
      settings.allowedTypes &&
      settings.allowedTypes.length &&
      !_.includes(settings.allowedTypes, options.file.mimetype)) {
          return cb('The MIME type ' + options.file.mimetype +
                    ' is not allowed');
  }
  let db_room = null;
  let db_savedFile = null;
  const promise = Promise.resolve().then(() => {
    return DbModel.Room.find({
      where: {
        id: options.room,
      },
    });
  }).then((room) => {
    db_room = room;
    if (!room) {
      throw new Error('Room does not exist.');
    }
    if (room.archived) {
      throw new Error('Room is archived.');
    }
    if (!room.isAuthorized(options.owner)) {
      throw new Error('Not authorized.');
    }
    return new Promise((resolve, reject) => {
      new File({
        owner: options.owner,
        name: options.file.originalname,
        type: options.file.mimetype,
        size: options.file.size,
        room: options.room
      }).save((err, savedFile) => {
        if (err) {
          return reject(err);
        }
        resolve(savedFile);
      });
    });
  }).then((savedFile) => {
    db_savedFile = savedFile;
    return new Promise((resolve,reject) => {
      this.provider.save({file: options.file, doc: savedFile}, (err) => {
        if (err) {
          savedFile.remove();
          return reject(err);
        }
        resolve();
      });
    });
  }).then(() => {
    // Temporary workaround for _id until populate can do aliasing
    return DbModel.User.find({
      where: {
        id: options.owner,
      },
    });
  }).then((user) => {
    cb(null, db_savedFile, db_room, user);
    this.core.emit('files:new', db_savedFile, db_room, user);
    if (options.post) {
      this.core.messages.create({
        room: db_room,
        owner: user.id,
        text: 'upload://' + db_savedFile.url
      });
    }
  }).catch((err) => {
    return cb(err);
  });
  return promise;
};

FileManager.prototype.list = function(options, cb) {
  if (!enabled) {
      return cb(null, []);
  }

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
    room_id: options.room
  };
  if (options.from) {
    where.uploaded = where.uploaded || {};
    where.uploaded.$gt = options.from;
  }
  if (options.to) {
    where.uploaded = where.uploaded || {};
    where.uploaded.$lt = options.to;
  }

  let file_include = [];
  if (options.expand) {
    var includes = options.expand.replace(/\s/, '').split(',');
    if (_.includes(includes, 'owner')) {
      file_include.push({
        model: DbModel.Owner,
        attributes: ['id', 'username', 'displayName', 'email'],
      });
    }
  }
  let offset = 0;
  if (options.skip) {
    offset = options.skip;
  }
  let limit = options.take;
  let order = null;
  if (options.reverse) {
    order = ['uploaded', 'DESC'];
  } else {
    order = ['uploaded', 'ASC'];
  }

  const promise = Promise.resolve().then(() => {
    return DbModel.Room.find({
      where: {
        id: options.room,
      }
    });
  }).then((room) => {
    var opts = {
      userId: options.userId,
      password: options.password
    };
    return new Promise((resolve) => {
      return room.canJoin(opts, (canJoin) => {
        resolve(canJoin);
      });
    });
  }).then((canJoin) => {
    if (!canJoin) {
      return cb(null, []);
    }
    return DbModel.File.findAll({
      where: where,
      includes: file_include,
      limit: [offset, limit],
      order: order,
    }).then((files) => {
      cb(null, files);
    });
  }).catch((err) => {
    return cb(err);
  });
  return promise;
};

FileManager.prototype.getUrl = function(file) {
    if (!enabled) {
        return;
    }

    return this.provider.getUrl(file);
};

module.exports = FileManager;
