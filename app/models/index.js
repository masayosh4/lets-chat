'use strict';
const Sequelize = require('sequelize');
const SequelizeContainer = require('sequelize_container');
const md5 = require('md5');

class MainTable {
  static setTable(log, sequelize) {
    let table = sequelize.table;

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
    });
    table.Room.prototype.url = function() {
      return this.slug || this.name.replace(/\W/i, '');
    };
    table.Room.prototype.hasPassword = function() {
      return !!this.password;
    };
    table.User = sequelize.define('room', {
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
      hash: {
        type: Sequelize.BLOB,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        defaultValue: '',
        allowNull: false
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
        allowNull: false
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
        allowNull: false
      },
    });
    table.User.prototype.avatar = function() {
      if (!this.email) {
        return null;
      }
      return md5(this.email);
    };
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
    });
    table.File.prototype.url = function() {
      return 'files/' + this.id + '/' + encodeURIComponent(this.name);
    };
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
    });
    table.Room.hasOne(table.Message, {
      foreignKey: 'room_id'
    });
    table.User.hasOne(table.Message, {
      foreignKey: 'owner_id'
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
}

module.exports = DbBaseModel;
