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

module.exports = function (app, address, port, state) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        passport = require('passport'),
        util = require('util');
    
        app.get('/login', function (req, res) {
        if (req.query.isPzp) {
            req.session.isPzp = true;
            req.session.pzpPort = req.query.port;
        }
        res.render('login', { user:req.user });
    });
    
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
    app.get('/auth/google/return',
        passport.authenticate('google', { failureRedirect:'/login' }),
        function (req, res) {
            res.redirect('/');
        }
    );

    app.get('/logout', function (req, res) {
        req.logout();
        //window.open('https://www.google.com/accounts/Logout');
        //window.open('https://login.yahoo.com/config/login?logout=1');
        res.redirect('/');
    });

    app.get('/auth/yahoo',
        passport.authenticate('yahoo'),
        function (req, res) {
            // The request will be redirected to Yahoo for authentication, so
            // this function will not be called.
        }
    );
    app.get('/auth/yahoo/return',
        passport.authenticate('yahoo', { failureRedirect:'/login' }),
        function (req, res) {
            // Successful authentication, redirect home.
            res.redirect('/');
        }
    );
}
