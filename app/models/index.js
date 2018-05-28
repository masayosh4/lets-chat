'use strict';
const Sequelize = require('sequelize');
const SequelizeContainer = require('sequelize_container');
const md5 = require('md5');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const hash = require('node_hash');
const settings = require('./../config');
const SpaceArray = require('./space_array');

class MainTable {
  static setTable(log, sequelize) {
    let table = sequelize.table;

    table.User = sequelize.define('user', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      provider: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      token: {
        type: Sequelize.STRING,
      },
      firstName: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false,
        unique: true,
      },
      displayName: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      joined: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false,
      },
      openRooms: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false,
        get: function() {
          return SpaceArray.fromString(this.getDataValue('openRooms')).map((it) => { return +it; });
        },
        set: function(val) {
          this.setDataValue('openRooms', SpaceArray.toString([ ...new Set(val) ]));
        },
      },
    }, {
      freezeTableName: true,
      name: {
        plural: 'user',
      },
      classMethods: {
        findById: function(id, cb) {
          this.find({
            where: {id: id},
          }).then((user) => {
            cb(null, user);
          }).catch((err) => {
            cb(err);
          });
        },
        findByIdentifier: function(identifier, cb) {
            var where = {};

            if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
                where.$or = [{id: identifier}, {username: identifier}];
            } else if (identifier.indexOf('@') === -1) {
                where.username = identifier;
            } else {
                where.email = identifier;
            }
            this.find({
              where: where,
            }).then((user) => {
              cb(null, user);
            }).catch((err) => {
              cb(err);
            });
        },
        authenticate: function(identifier, password, cb) {
            this.findByIdentifier(identifier, function(err, user) {
                if (err) {
                    return cb(err);
                }
                // Does the user exist?
                if (!user) {
                    return cb(null, null, 0);
                }
                // Is this a local user?
                if (user.provider !== 'local') {
                    return cb(null, null, 0);
                }

                // Is password okay?
                user.comparePassword(password, function(err, isMatch) {
                    if (err) {
                        return cb(err);
                    }
                    if (isMatch) {
                        return cb(null, user);
                    }
                    // Bad password
                    return cb(null, null, 1);
                });
            });
        },
      },
      instanceMethods: {
        setPassword: function(next) {
          let user = this;
          bcrypt.hash(user.password, 10, function(err, hash) {
              if (err) {
                  return next(err);
              }
              user.password = hash;
              next();
          });
        },
        generateToken: function(cb) {
            if (!this.id) {
                return cb('User needs to be saved.');
            }

            crypto.randomBytes(24, function(ex, buf) {
                var password = buf.toString('hex');

                bcrypt.hash(password, 10, function(err, hash) {
                    if (err) {
                        return cb(err);
                    }

                    this.token = hash;

                    var userToken = new Buffer(
                        String(this.id) + ':' + password
                    ).toString('base64');

                    cb(null, userToken);

                }.bind(this));
            }.bind(this));
        },
        findByToken: function(token, cb) {
          if (!token) {
              return cb(null, null);
          }
  
          var tokenParts = new Buffer(token, 'base64').toString('ascii').split(':'),
              userId = tokenParts[0],
              hash = tokenParts[1];
  
          if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
              cb(null, null);
          }

          this.find({
            where: {
              id: userId,
            },
          }).then((user) => {
              if (!user) {
                  return cb(null, null);
              }
  
              bcrypt.compare(hash, user.token, function(err, isMatch) {
                  if (err) {
                      return cb(err);
                  }
  
                  if (isMatch) {
                      return cb(null, user);
                  }
  
                  cb(null, null);
              });
          }).catch((err) => {
             return cb(err);
          });
        },
        comparePassword: function(password, cb) {

            var local = settings.auth.local,
                salt = local && local.salt;

            // Legacy password hashes
            if (salt && (hash.sha256(password, salt) === this.password)) {
                return cb(null, true);
            }

            // Current password hashes
            bcrypt.compare(password, this.password, function(err, isMatch) {

                if (err) {
                    return cb(err);
                }

                if (isMatch) {
                    return cb(null, true);
                }

                cb(null, false);

            });
        },
        avatar: function() {
          if (!this.email) {
            return null;
          }
          return md5(this.email);
        },
        toJSON: function() {
          const data = {
            id: this.id,
            firstName: this.firstName,
            lastName: this.lastName,
            username: this.username,
            displayName: this.displayName,
            avatar: this.avatar(),
            openRooms: this.openRooms || [],
          };
          return data;
        },
      },
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    });

    table.Room = sequelize.define('room', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      slug: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false,
      },
      archived: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
      },
      created: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      lastActive: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      private: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
    }, {
      freezeTableName: true,
      name: {
        plural: 'room',
      },
      classMethods: {
        findByIdOrSlug: function(identifier, cb) {
            var where = {
                archived: { $ne: true }
            };

            if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
                where.$or = [{id: identifier}, {slug: identifier}];
            } else {
                where.slug = identifier;
            }

            this.find({
              where: where,
            }, cb);
        },
      },
      instanceMethods: {
        isAuthorized: function(userId) {
            if (!userId) {
                return false;
            }

            userId = userId.toString();

/*
            // Check if userId doesn't match MongoID format
            if (!/^[a-f\d]{24}$/i.test(userId)) {
                return false;
            }
*/

            if (!this.password && !this.private) {
                return true;
            }

            if (this.owner_id == userId) {
                return true;
            }

            return this.participants.some(function(participant) {
                if (participant.id) {
                    return participant.id.equals(userId);
                }

                if (participant.equals) {
                    return participant.equals(userId);
                }

                if (participant.id) {
                    return participant.id === userId;
                }

                return participant === userId;
            });
        },
        canJoin: function(options, cb){
          var userId = options.userId,
              password = options.password,
              saveMembership = options.saveMembership;
  
          if (this.isAuthorized(userId)) {
              return cb(null, true);
          }
  
          if (!this.password) {
              return cb(null, false);
          }
  
          bcrypt.compare(password || '', this.password, function(err, isMatch) {
              if(err) {
                  return cb(err);
              }
  
              if (!isMatch) {
                  return cb(null, false);
              }
  
              if (!saveMembership) {
                  return cb(null, true);
              }
  
              this.participants.push(userId);
  
              this.save(function(err) {
                  if(err) {
                      return cb(err);
                  }
  
                  cb(null, true);
              });
  
          }.bind(this));
        },
        toJSON: function(user) {
            var userId = user ? (user.id || user.id || user) : null;
            var authorized = false;

            if (userId) {
                authorized = this.isAuthorized(userId);
            }

            var room = this.get({plain: true});

            var data = {
                id: room.id,
                slug: room.slug,
                name: room.name,
                description: room.description,
                lastActive: room.lastActive,
                created: room.created,
                owner: this.owner.toJSON(),
                private: room.private,
                hasPassword: this.hasPassword(),
                participants: []
            };

            if (room.private && authorized) {
                var participants = this.participants || [];
                data.participants = participants.map(function(user) {
                    return user.username ? user.username : user;
                });
            }

            if (this.users) {
                data.users = this.users;
                data.userCount = this.users.length;
            }else {
                data.users = [];
                data.userCount = 0;
            }

            return data;
        },
        url: function() {
          return this.slug || this.name.replace(/\W/i, '');
        },
        hasPassword: function() {
          return !!this.password;
        },
      },
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    });
/*
    table.User.hasMany(table.Room, {
      foreignKey: 'owner_id',
      as: 'owner',
    });
*/
    table.Room.belongsTo(table.User, {
      foreignKey: 'owner_id',
      as: 'owner',
    });

    table.UserRoomRel = sequelize.define('user_room_rel', {
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    });
    table.Room.belongsToMany(table.User, {
      through: table.UserRoomRel,
      foreignKey: 'room_id',
      as: 'participants',
    });
    table.User.belongsToMany(table.Room, {
      through: table.UserRoomRel,
      foreignKey: 'user_id',
    });

    table.UserMessage = sequelize.define('user_message', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      text: {
        type: Sequelize.TEXT,
      },
      posted: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    }, {
      freezeTableName: true,
      name: {
        plural: 'user_message',
      },
      instanceMethods: {
      },
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    });
    table.Room.hasMany(table.UserMessage, {
      foreignKey: 'room_id'
    });
    table.User.hasMany(table.UserMessage, {
      foreignKey: 'owner_id'
    });
    table.User.hasMany(table.UserMessage, {
      foreignKey: 'receive_id'
    });

    table.File = sequelize.define('file', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      type: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
      },
      size: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      uploaded: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    }, {
      freezeTableName: true,
      name: {
        plural: 'file',
      },
      instanceMethods: {
        url: function() {
          return 'files/' + this.id + '/' + encodeURIComponent(this.name);
        },
      },
      classMethods: {
        findById: function(id, cb) {
          this.find({
            where: {id: id},
          }).then((file) => {
            cb(null, file);
          }).catch((err) => {
            cb(err);
          });
        },
      },
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    });
    table.Room.hasOne(table.File, {
      foreignKey: 'room_id'
    });
    table.User.hasOne(table.File, {
      foreignKey: 'owner_id'
    });

    table.Message = sequelize.define('message', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      text: {
        type: Sequelize.TEXT,
      },
      posted: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    }, {
      instanceMethods: {
        toJSON: function(user) {
          const data = {
              id: this.id,
              text: this.text,
              posted: this.posted,
  
              // if populate('owner') and user's been deleted - owner will be null
              // otherwise it will be an id or undefined
              owner: this.owner || {
                  displayName: '[Deleted User]',
                  username: '_deleted_user_'
              }
          };
  
          if (this.room && this.room.id) {
              data.room = this.room.toJSON(user);
          } else {
              data.room = this.room;
          }
  
          return data;
        },
      },
      freezeTableName: true,
      name: {
        plural: 'message',
      },
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    });
    table.Room.hasMany(table.Message, {
      foreignKey: 'room_id',
    });
    table.Message.belongsTo(table.Room, {
      foreignKey: 'room_id',
    });
    table.User.hasMany(table.Message, {
      foreignKey: 'owner_id',
      as: 'owner',
    });
    table.Message.belongsTo(table.User, {
      foreignKey: 'owner_id',
      as: 'owner',
    });
  }
}

class DbBaseModel {
  constructor(aTable) {
    this.db = SequelizeContainer.get({
      database: "legal",
      user: "legal",
      password: "legalpasswd",
      logging:true,
    });

    if (!Array.isArray(aTable)) {
      aTable = [];
    }
    aTable.unshift(MainTable);

    for (let i = 0; i < aTable.length; ++i) {
      const name = aTable[i].name;
      if (!this.db[name]) {
        aTable[i].setTable(this.log, this.db);
        this.db[name] = true;
      }
    }
    for (let key in this.db.table) {
      this[key] = this.db.table[key];
    }
  }

  syncAll() {
    const Model = require('sequelize/lib/model');

    let aModels = [];
    for (let m in this) {
      // defineからModelクラスのインスタンスが返る
      if (this[m] instanceof Model) {
        aModels.push(this[m]);
      }
    }

    const promise = new Promise((resolve) => {
      let i = 0;
      let func = () => {
        if (i >= aModels.length) {
          resolve();
          return;
        }
        aModels[i].sync().then(() => {
          func();
        });
        ++i;
      };
      func();
    });
    return promise;
  }
}

module.exports = new DbBaseModel();
