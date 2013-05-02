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
 * Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
 * Copyright 2012 - 2013 University of Oxford
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
 
var PassportConfig = exports;

PassportConfig.createPassport = function(serverUrl, cb) {
    var util = require('util'),
        passport = require('passport');

    var config = {
      "google"   : false,
      "yahoo"    : false,
      "facebook" : false,
      "twitter"  : false
    };

    // see if we support google.
    try {
        configureGoogle( require('passport-google').Strategy, passport, serverUrl );
        config.google = true;
    } catch (err) {
        console.log("No Google!");
    }
    
    // see if we support yahoo.
    try {
        configureYahoo( require('passport-yahoo').Strategy, passport, serverUrl );
        config.yahoo = true;
    } catch (err) {
        console.log("No Yahoo!");
    }
    
    /* No clever user handling here yet */
    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (obj, done) {
        done(null, obj);
    });

    return cb(passport, config);
}

function configureGoogle(GoogleStrategy, passport, serverUrl) {
    passport.use(new GoogleStrategy({
            returnURL:serverUrl + '/auth/google/return',
            realm:serverUrl + '/',
            profile:true,
            pape:{ 'maxAuthAge' : 600 }
        },
        function (identifier, profile, done) {
            "use strict";
            // asynchronous verification, for effect...
            process.nextTick(function () {

                // To keep the example simple, the user's Google profile is returned to
                // represent the logged-in user.  In a typical application, you would want
                // to associate the Google account with a user record in your database,
                // and return that user instead.
                profile.from = "google";
                profile.identifier = identifier;
                return done(null, profile);
            });
        }
    ));
}


function configureYahoo(YahooStrategy, passport, serverUrl) {
    passport.use(new YahooStrategy({
            returnURL:serverUrl + '/auth/yahoo/return',
            realm:serverUrl + '/',
            profile:true,
            pape:{ 'maxAuthAge' : 600 }
        },
        function (identifier, profile, done) {
            "use strict";
            process.nextTick(function () {
                profile.from = "yahoo";
                profile.identifier = identifier;
                return done(null, profile);
            });
        }
    ));
}

