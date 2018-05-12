'use strict';

const DbModel = require('../models/');

function AccountManager(options) {
    this.core = options.core;
}

AccountManager.prototype.create = function(provider, options, cb) {
  let user = DbModel.User.build({provider: provider});
  Object.keys(options).forEach(function(key) {
    user[key] = options[key];
  });
  return user.save(cb).then(() => {
    cb();
  });
};

AccountManager.prototype.update = function(id, options, cb) {
  let usernameChange = false;
  let user = null;
  const promise = DbModel.User.find({
    where: {
      id: id,
    }
  }).then((user) => {
    if (options.firstName) {
        user.firstName = options.firstName;
    }
    if (options.lastName) {
        user.lastName = options.lastName;
    }
    if (options.displayName) {
        user.displayName = options.displayName;
    }
    if (options.email) {
        user.email = options.email;
    }
    if (options.openRooms) {
      user.openRooms = options.openRooms;
    }
    if (options.username && options.username !== user.username) {
      var xmppConns = this.core.presence.system.connections.query({
        userId: user._id,
        type: 'xmpp'
      });
      if (xmppConns.length) {
        throw new Error('You can not change your username with active XMPP sessions.');
      }
      usernameChange = true;
      user.username = options.username;
    }
    if (user.local) {
      if (options.password || options.newPassword) {
        user.password = options.password || options.newPassword;
      }
    }
    return user.save();
  }).then(() => {
    this.core.emit('account:update', {
      usernameChanged: usernameChange,
      user: user.toJSON()
    });
    cb(null, user);
  }).catch((err) => {
    cb(err.message);
  });
  return promise;
};

AccountManager.prototype.generateToken = function(id, cb) {
  let ret = null;
  const promise = DbModel.User.find({
    where: {
      id: id,
    }
  }).then((user) => {
    return user.generateToken()
    .then((token) => {
      ret = token;
      this.token = token;
      return user.save();
    }).then(() => {
      cb(null, ret);
    }).catch((err) => {
      cb(err.message);
    });
  });
  return promise;
};

AccountManager.prototype.revokeToken = function(id, cb) {
  const promise = DbModel.User.find({
    where: {
      id: id,
    },
  }).then((user) => {
    user.token = null;
    user.save(() => {
      cb();
    });
  });
  return promise;
};

module.exports = AccountManager;
