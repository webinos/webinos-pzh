/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2012 - 2013 The University of Oxford
 * Author: John Lyle (john.lyle@cs.ox.ac.uk)
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/

module.exports = function (app, authConfig, routeutil) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        passport = require('passport'),
        util = require('util');
    
    app.get('/login', function (req, res) {
        var isPzp = false;
        if (req.query.isPzp) {
            req.session.isPzp = true;
            req.session.pzpPort = req.query.port;
            req.session.friendlyName = req.query.friendlyName;
            req.session.deviceType = req.query.deviceType;
            isPzp = true;
        }
        if (req.isAuthenticated()) {
            res.redirect('/');
        } else {
            res.render('login', { user:req.user, auth:authConfig, "isPzp": req.query.isPzp, "isExternal" : false });
        }
    });
    
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });
    
    if (authConfig.facebook.enabled) {
        app.get('/auth/facebook', passport.authenticate('facebook'));
        app.get(authConfig.facebook.authpath, 
            passport.authenticate('facebook', { failureRedirect: '/login' }), routeutil.doPostLoginRedirect);
        //app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
    }

    if (authConfig.twitter.enabled) {
        app.get('/auth/twitter', passport.authenticate('twitter'));
        app.get(authConfig.twitter.authpath, 
            passport.authenticate('twitter', { failureRedirect: '/login' }), routeutil.doPostLoginRedirect);
    }
    
    if (authConfig.google.enabled) {
        app.get('/auth/google', passport.authenticate('google'));
        app.get(authConfig.google.authpath,
            passport.authenticate('google', { failureRedirect:'/login' }), routeutil.doPostLoginRedirect);
    }
    
    
    if (authConfig.yahoo.enabled) {
      app.get('/auth/yahoo',passport.authenticate('yahoo'));
      app.get(authConfig.yahoo.authpath,
          passport.authenticate('yahoo', { failureRedirect:'/login' }), routeutil.doPostLoginRedirect);
    }
    
    if (authConfig.openid.enabled) {
        app.get('/auth/openid', passport.authenticate('openid'));
        app.get(authConfig.openid.authpath, 
            passport.authenticate('openid', { failureRedirect: '/login' }), routeutil.doPostLoginRedirect);
    }
}