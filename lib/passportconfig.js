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
var util = require('util');

PassportConfig.createPassport = function(serverUrl, cb) {
    var url = require('url'),
        passport = require('passport');

    var authConfig = {
      "google"   : { enabled: false },
      "yahoo"    : { enabled: false },
      "facebook" : { enabled: false, authpath: null },
      "twitter"  : { enabled: false, authpath: null },
      "openid"   : { enabled: false }
    };

    // load our configuration file.
    var fileConfig = readConfig();

    // see if we support google.
    try {
        if (isIdpEnabled("google", fileConfig)) {  
            configureGoogle( require('passport-google').Strategy, passport, serverUrl );
            authConfig.google.enabled = true;
        } else {
            disabledMessage("google");
        }
    } catch (err) {
        console.log("Login via Google disabled (" + err + ").");
    }
    
    // see if we support yahoo.
    try {
        if (isIdpEnabled("yahoo", fileConfig)) {  
            configureYahoo( require('passport-yahoo').Strategy, passport, serverUrl );
            authConfig.yahoo.enabled = true;
        } else {
            disabledMessage("yahoo");
        }
    } catch (err) {
        console.log("Login via Yahoo disabled (" + err + ").");
    }
        
    // see if we support facebook
    try {
        if (isIdpEnabled("facebook", fileConfig)) {        
            configureFacebook( require('passport-facebook').Strategy, passport, serverUrl, fileConfig );
            authConfig.facebook.enabled = true;
            authConfig.facebook.authpath = url.parse(fileConfig.authentication.facebook.callbackURL).pathname;
        } else {
            disabledMessage("facebook");
        }
    } catch (err) {
        console.log("Login via Facebook disabled (" + err + ").");
    }
    
    // see if we support twitter
    try {
        if (isIdpEnabled("twitter", fileConfig)) {
            configureTwitter( require('passport-twitter').Strategy, passport, serverUrl, fileConfig );
            authConfig.twitter.enabled = true;
            authConfig.twitter.authpath = url.parse(fileConfig.authentication.twitter.callbackURL).pathname;
        } else {
            disabledMessage("twitter");
        }
    } catch (err) {
        console.log("Login via Twitter disabled (" + err + ").");
    }
    
    //see if we support plain OpenID
    try {
        if (isIdpEnabled("openid", fileConfig)) {
            configureOpenId( require('passport-openid').Strategy, passport, serverUrl );
            authConfig.openid.enabled = true;
        } else {
            disabledMessage("openid");
        }
    } catch (err) {
        console.log("Login via openid (plain) disabled (" + err + ").");
    }
    
    /* No clever user handling here yet */
    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (obj, done) {
        done(null, obj);
    });

    return cb(passport, authConfig, fileConfig);
}

function readConfig() {
    return require(require('path').join('..', 'config.json'));
}

function disabledMessage(idp) {
    console.log("Login via " + idp + " disabled in config.json");
}

function isIdpEnabled(idp, config) {
    return config.hasOwnProperty("authentication") && 
           config.authentication.hasOwnProperty(idp) &&
           config.authentication[idp].hasOwnProperty("enabled") &&
           config.authentication[idp].enabled;
}

function validateConfigTwitter(config) {
    return config.hasOwnProperty("authentication") && 
           config.authentication.hasOwnProperty("twitter") &&
           config.authentication.twitter.hasOwnProperty("consumerKey") && 
           config.authentication.twitter.consumerKey !== null &&
           config.authentication.twitter.consumerKey !== "" &&
           config.authentication.twitter.hasOwnProperty("consumerSecret") && 
           config.authentication.twitter.consumerSecret !== null && 
           config.authentication.twitter.consumerSecret !== "" &&
           config.authentication.twitter.hasOwnProperty("callbackURL") &&
           config.authentication.twitter.callbackURL !== null &&
           config.authentication.twitter.callbackURL !== "";
}
function validateConfigFacebook(config) {
    return config.hasOwnProperty("authentication") && 
           config.authentication.hasOwnProperty("facebook") &&
           config.authentication.facebook.hasOwnProperty("clientID") && 
           config.authentication.facebook.clientID !== null &&
           config.authentication.facebook.clientID !== "" &&
           config.authentication.facebook.hasOwnProperty("clientSecret") && 
           config.authentication.facebook.clientSecret !== null && 
           config.authentication.facebook.clientSecret !== "" &&
           config.authentication.facebook.hasOwnProperty("callbackURL") &&
           config.authentication.facebook.callbackURL !== null &&
           config.authentication.facebook.callbackURL !== "";
}

function configureFacebook(FacebookStrategy, passport, serverUrl, config) {
    if (!validateConfigFacebook(config)) {
      throw "Facebook config invalid";
    }
    var fbConfig = config.authentication.facebook;
    // Read configuration from the ./webinos-pzhWebServer directory.
    // Facebook is configured with three attributes:
    //{
    //  "authentication" :
    //    { "facebook" : 
    //      { "clientID"     : ""
    //      , "clientSecret" : ""
    //      , "callbackURL"  : ""
    //      }
    //    }
    //}
    // You will need to have registered an app with Facebook to make this work.
    passport.use(new FacebookStrategy(fbConfig,
      function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            profile.from = "facebook";
            // we didn't request the email address, so we're generating one
            // note: this might not be valid.
            profile.emails[0].value = profile.username + "@facebook.com"
            profile.identifier = profile.id + "@facebook.com";
            profile.photoUrl = "https://graph.facebook.com/" + profile.username + "/picture?type=large";
            return getPzhStatus(profile, done);
        });
      }
    ));
}

function configureTwitter(TwitterStrategy, passport, serverUrl, config) {
    if (!validateConfigTwitter(config)) {
      throw "Twitter config invalid";
    }
    var twitterConfig = config.authentication.twitter;
    // Read configuration from the ./webinos-pzhWebServer directory.
    // Twitter is configured with three attributes:
    //{
    //  "authentication" :
    //    { "twitter" : 
    //      { "consumerKey"     : ""
    //      , "consumerSecret"  : ""
    //      , "callbackURL"     : ""
    //      }
    //    }
    //}
    // You will need to have registered an app with Facebook to make this work.
    passport.use(new TwitterStrategy(twitterConfig,
      function(token, tokenSecret, profile, done) {
        process.nextTick(function() {
            profile.from = "twitter";
            // we didn't request the email address, so we're generating one
            // note: this might not be valid.
            profile.emails = [{ "value" : profile.username + "@twitter.com" }];
            profile.identifier = "twitter-" + profile.id;
            profile.photoUrl = "https://api.twitter.com/1/users/profile_image?screen_name=" + profile.username + "&size=original";
            return getPzhStatus(profile, done);
        });
      }
    ));
}

function configureOpenId(OpenIDStrategy, passport, serverUrl) {
    passport.use(new OpenIDStrategy({
          returnURL: serverUrl + '/auth/openid/return',
          realm: serverUrl,
          profile: true,
          pape:{ 'maxAuthAge' : 600 }
        },
        function(identifier, profile, done) {
            process.nextTick(function () {
                profile.from = "openid";
                profile.identifier = identifier;
                return getPzhStatus(profile, done);
            });
        }
    ));
}

function configureGoogle(GoogleStrategy, passport, serverUrl) {
    passport.use(new GoogleStrategy({
            returnURL:serverUrl + '/auth/google/return',
            realm:serverUrl + '/',
            profile:true,
//            pape:{ 'maxAuthAge' : 600 }
        },
        function (identifier, profile, done) {
            "use strict";
            process.nextTick(function () {
                profile.from = "google";
                profile.identifier = identifier;
                return getPzhStatus(profile, done);
            });
        }
    ));
}

function configureYahoo(YahooStrategy, passport, serverUrl) {
    passport.use(new YahooStrategy({
            returnURL:serverUrl + '/auth/yahoo/return',
            realm:serverUrl + '/',
            profile:true,
//            pape:{ 'maxAuthAge' : 600 }
        },
        function (identifier, profile, done) {
            "use strict";
            process.nextTick(function () {
                profile.from = "yahoo";
                profile.identifier = identifier;
                return getPzhStatus(profile, done);
            });
        }
    ));
}

function getPzhStatus(profile, callback) {
    var pzhadaptor = require('./pzhadaptor.js');
    pzhadaptor.checkUserHasPzh(profile, function(answer) {
        profile.hasPzh = answer.message.result;
        if (answer.message.result) {
            profile.nickname = answer.message.user.nickname;
        }
        callback(null, profile);
    });
}
