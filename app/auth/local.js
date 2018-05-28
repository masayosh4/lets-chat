'use strict';

var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;
const DbModel = require('../models/');

function Local(options) {
    this.options = options;
    this.key = 'local';
}

Local.key = 'local';

Local.prototype.setup = function() {
console.log('Local.prototype.setup');
    passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    }, function(identifier, password, done) {
console.log('Local.prototype.setup2', identifier, password);
        DbModel.User.authenticate(identifier, password, function(err, user) {
            if (err) {
                return done(null, false, {
                    message: 'Some fields did not validate.'
                });
            }
            if (user) {
                return done(null, user);
            } else {
                return done(null, null, {
                    message: 'Incorrect login credentials.'
                });
            }
        });
    }));
};

Local.prototype.authenticate = function(req, cb) {
console.log('Local.prototype.authenticate');
    passport.authenticate('local', cb)(req);
};

module.exports = Local;
