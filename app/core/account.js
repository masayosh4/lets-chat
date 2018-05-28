'use strict';

const DbModel = require('../models/');

function AccountManager(options) {
    this.core = options.core;
}

AccountManager.prototype.create = function(provider, options, cb) {
console.log('AccountManager.prototype.create');
  let user = DbModel.User.build({provider: provider});
  Object.keys(options).forEach(function(key) {
    user[key] = options[key];
  });
  return user.setPassword(() => {
    user.save().then(() => {
      cb();
    });
  });
};

AccountManager.prototype.update = function(id, options, cb) {
console.log('AccountManager.prototype.update');
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
        userId: user.id,
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
  }).then((user) => {
    this.core.emit('account:update', {
      usernameChanged: usernameChange,
      user: user.toJSON()
    });
    cb(null, user);
  }).catch((err) => {
    console.log(err);
    cb(err);
  });
  return promise;
};

AccountManager.prototype.generateToken = function(id, cb) {
console.log('AccountManager.prototype.generateToken');
  let ret = null;
  const promise = DbModel.User.find({
    where: {
      id: id,
    }
  }).then((user) => {
    return new Promise((resolve, reject) => {
      user.generateToken((err, token) => {
        if (err) {
          return reject(err);
        }
        ret = token;
        user.token = token;
        resolve(user);
      });
    });
  }).then((user) => {
    return user.save();
  }).then(() => {
    cb(null, ret);
  }).catch((err) => {
    console.log(err);
    cb(err);
  });
  return promise;
};

AccountManager.prototype.revokeToken = function(id, cb) {
console.log('AccountManager.prototype.revokeToken');
  const promise = DbModel.User.find({
    where: {
      id: id,
    },
  }).then((user) => {
    user.token = null;
    return user.save();
  }).then(() => {
    cb(null);
  }).catch((err) => {
    console.log(err);
    cb(err);
  });
  return promise;
};

module.exports = AccountManager;
