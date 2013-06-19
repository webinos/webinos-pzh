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

module.exports = function (app, address, port, authConfig) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        passport = require('passport'),
        util = require('util');
    
    app.get('/login', function (req, res) {
        var isPzp = false;
        if (req.query.isPzp) {
            req.session.isPzp = true;
            req.session.pzpPort = req.query.port;
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
        //window.open('https://www.google.com/accounts/Logout');
        //window.open('https://login.yahoo.com/config/login?logout=1');
        res.redirect('/');
    });
    

    if (authConfig.facebook.enabled) {
        
        app.get(authConfig.facebook.authpath, 
            passport.authenticate('facebook', { successRedirect: '/',
                                                failureRedirect: '/login' }));
        
        //app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
        app.get('/auth/facebook', passport.authenticate('facebook'));
        // made the decision NOT to request email address: we're just going to make it
        // based on the user name and @facebook.com.  Reason - otherwise people can
        // assert any email address, we lose connection with the provider.
    }

    if (authConfig.twitter.enabled) {
        
        app.get(authConfig.twitter.authpath, 
            passport.authenticate('twitter', { successRedirect: '/',
                                                failureRedirect: '/login' }));
        
        app.get('/auth/twitter', passport.authenticate('twitter'));
    }
    
    if (authConfig.google.enabled) {
      // GET /auth/google
      //   Use passport.authenticate() as route middleware to authenticate the
      //   request.  The first step in Google authentication will involve redirecting
      //   the user to google.com.  After authenticating, Google will redirect the
      //   user back to this application at /auth/google/return
      app.get('/auth/google',
          passport.authenticate('google', { failureRedirect:'/login' }),
          function (req, res) {
              res.redirect('/');
          }
      );

      // GET /auth/google/return
      //   Use passport.authenticate() as route middleware to authenticate the
      //   request.  If authentication fails, the user will be redirected back to the
      //   login page.  Otherwise, the primary route function function will be called,
      //   which, in this example, will redirect the user to the home page.
      app.get(authConfig.google.authpath,
          passport.authenticate('google', { failureRedirect:'/login' }),
          function (req, res) {
              res.redirect('/');
          }
      );
    }
    
    
    if (authConfig.yahoo.enabled) {
      app.get('/auth/yahoo',
          passport.authenticate('yahoo'),
          function (req, res) {
              // The request will be redirected to Yahoo for authentication, so
              // this function will not be called.
          }
      );
      app.get(authConfig.yahoo.authpath,
          passport.authenticate('yahoo', { failureRedirect:'/login' }),
          function (req, res) {
              // Successful authentication, redirect home.
              res.redirect('/');
          }
      );
    }
    
    if (authConfig.openid.enabled) {
        app.get('/auth/openid', passport.authenticate('openid'));
        
        app.get(authConfig.openid.authpath, 
            passport.authenticate('openid', 
                { successRedirect: '/',
                  failureRedirect: '/login' }));
    }
    
    
}
