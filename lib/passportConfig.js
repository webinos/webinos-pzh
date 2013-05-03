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
        url = require('url'),
        passport = require('passport');

    var config = {
      "google"   : { enabled: false },
      "yahoo"    : { enabled: false },
      "facebook" : { enabled: false, authpath: null },
      "twitter"  : { enabled: false, authpath: null }
    };

    // see if we support google.
    try {
        configureGoogle( require('passport-google').Strategy, passport, serverUrl );
        config.google.enabled = true;
    } catch (err) {
        console.log("Login via Google disabled (" + err + ").");
    }
    
    // see if we support yahoo.
    try {
        configureYahoo( require('passport-yahoo').Strategy, passport, serverUrl );
        config.yahoo.enabled = true;
    } catch (err) {
        console.log("Login via Yahoo disabled (" + err + ").");
    }
    
    try {
        var fbConfig = readConfig("facebook-config.json");
        configureFacebook( require('passport-facebook').Strategy, passport, serverUrl, fbConfig );
        config.facebook.enabled = true;
        config.facebook.authpath = url.parse(fbConfig.callbackURL).pathname;
    } catch (err) {
        console.log("Login via Facebook disabled (" + err + ").");
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

function readConfig(configName) {
    var fs = require('fs'),
        path = require('path');
    var fbFile = fs.readFileSync(path.join(__dirname,"..",configName));
    var fbJson = JSON.parse(fbFile);
    return fbJson;
}

function configureFacebook(FacebookStrategy, passport, serverUrl, fbConfig) {
    if (!fbConfig.hasOwnProperty("clientID") || fbConfig.clientID === null || fbConfig.clientID === "" ||
        !fbConfig.hasOwnProperty("clientSecret") || fbConfig.clientSecret === null || fbConfig.clientSecret === ""|| 
        !fbConfig.hasOwnProperty("callbackURL") || fbConfig.callbackURL === null || fbConfig.callbackURL === "") {
      throw "Facebook config invalid";
    }
    // Read facebook configuration from the ./webinos-pzhWebServer directory.
    // Facebook is configured with a file containing three attributes:
    // {    
    //    "clientID"     : "....",
    //    "clientSecret" : "....",
    //    "callbackURL"  : "https://pzh.webinos.com/auth/facebook/callback"
    // }
    // You will need to have registered an app with Facebook to make this work.
    passport.use(new FacebookStrategy(fbConfig,
      function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            console.log("Received a facebook profile, " + require('util').inspect(profile));
            profile.from = "facebook";
            // we didn't request the email address, so we're generating one
            // note: this might not be valid.
            profile.emails[0].value = profile.username + "@facebook.com"
            profile.identifier = profile.id + "@facebook.com";
            return done(null, profile);
        });
      }
    ));
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

