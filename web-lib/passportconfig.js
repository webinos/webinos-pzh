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
var url = require('url');

PassportConfig.createPassport = function(serverUrl, cb) {
    var passport = require('passport');

    var authConfig = {
      "google"   : { enabled: false, apikey : null },
      "yahoo"    : { enabled: false },
      "facebook" : { enabled: false, authpath: null, app_id : null },
      "twitter"  : { enabled: false, authpath: null, oauth: null },
      "openid"   : { enabled: false }
    };

    // load our configuration file.
    var fileConfig = readConfig();

    // see if we support google.
    try {
        if (isIdpEnabled("google", fileConfig)) {  
            configureGoogle( require('passport-google').Strategy, passport, serverUrl, fileConfig );
            authConfig.google.enabled = true;
            authConfig.google.authpath = getAuthPath(serverUrl, "google", fileConfig);
            authConfig.google.apikey = getApiKey("google", fileConfig);
        } else {
            disabledMessage("google");
        }
    } catch (err) {
        console.log("Login via Google disabled (" + err + ").");
    }
    
    // see if we support yahoo.
    try {
        if (isIdpEnabled("yahoo", fileConfig)) {  
            configureYahoo( require('passport-yahoo').Strategy, passport, serverUrl, fileConfig );
            authConfig.yahoo.enabled = true;
            authConfig.yahoo.authpath = getAuthPath(serverUrl, "yahoo", fileConfig);
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
            authConfig.facebook.authpath = getAuthPath(serverUrl, "facebook", fileConfig);
            authConfig.facebook.app_id = getAppId("facebook", fileConfig);
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
            authConfig.twitter.authpath = getAuthPath(serverUrl, "twitter", fileConfig);
            authConfig.twitter.oauth = getOAuthConfig("twitter", fileConfig);
        } else {
            disabledMessage("twitter");
        }
    } catch (err) {
        console.log("Login via Twitter disabled (" + err + ").");
    }
    
    //see if we support plain OpenID
    try {
        if (isIdpEnabled("openid", fileConfig)) {
            configureOpenId( require('passport-openid').Strategy, passport, serverUrl, fileConfig );
            authConfig.openid.enabled = true;
            authConfig.openid.authpath = getAuthPath(serverUrl, "openid", fileConfig);
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
    return require(require('path').join('..', 'webconfig.json'));
}

function disabledMessage(idp) {
    console.log("Login via " + idp + " disabled in webconfig.json");
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

function getApiKey(provider, config) {
    if ( config.authentication[provider].hasOwnProperty("apiKey")) {
        return config.authentication[provider].apiKey;    
    } else {
        return null;
    }
}

function getAppId(provider, config) {
    return config.authentication[provider].clientID;
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
            profile._json = {};
            profile._raw = {};            
            profile.accessToken = accessToken;
            profile.refreshToken = refreshToken;
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
            profile._json = {};
            profile._raw = {};
            profile.photoUrl = profile._json.profile_image_url_https;
            profile.token = token;
            profile.tokenSecret = tokenSecret;
            return getPzhStatus(profile, done);
        });
      }
    ));
}

function configureOpenId(OpenIDStrategy, passport, serverUrl, config) {
    var openidConfig = config.authentication.openid;
    passport.use(new OpenIDStrategy({
          returnURL:getAuthURL(serverUrl, 'openid', config),
          realm:getAuthRealm(serverUrl, 'openid', config),
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

function configureGoogle(GoogleStrategy, passport, serverUrl, config) {
    passport.use(new GoogleStrategy({
            returnURL:getAuthURL(serverUrl, 'google', config),
            realm:getAuthRealm(serverUrl, 'google', config),
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

function configureYahoo(YahooStrategy, passport, serverUrl, config) {
    passport.use(new YahooStrategy({
            returnURL:getAuthURL(serverUrl, 'yahoo', config),
            realm:getAuthRealm(serverUrl, 'yahoo', config),
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
            profile.photoUrl = answer.message.user.photoUrl;
        }
        callback(null, profile);
    });
}

/* Given a callback URL that the IDP will redirect to after authentication,
 * work out the path that this server should be accepting.  E.g., given arguments
 *
 * serverUrl === "... anything ..."
 * provider === "twitter"
 * config.authentication.twitter.callbackURL === "https://pzh.webinos.org/auth/twitter/callback"
 *
 * return 
 * "/auth/twitter/callback"
 *
 * If the configuration has nothing useful, return the serverUrl plus the standard /auth/provider/return path.
 *
 */
function getAuthPath(serverUrl, provider, config) {
    return url.parse(getAuthURL(serverUrl, provider, config)).path;
}

function getAuthURL(serverUrl, provider, config) {
    var authPath = serverUrl + "/auth/" + provider + "/return";
    if (config.authentication[provider].callbackURL && config.authentication[provider].callbackURL !== "") {
        authPath = config.authentication[provider].callbackURL;
    }
    return authPath;
}

function getAuthRealm(serverUrl, provider, config) {
    var realmUrl = url.parse(getAuthURL(serverUrl, provider, config));
    var realm = realmUrl.protocol;
    if (realmUrl.slashes) realm += "//";
    realm += realmUrl.host;
    realm += "/";
    return realm;
}

/* This takes a combination of oauth and other settings
 * to create a settings object compatible with the
 * 'Twit' module - https://github.com/ttezel/twit
 * E.g., 
 * 
 * { "consumer_key"        : ... 
 * , "consumer_secret"     : ...
 * , "access_token"        : ...
 * , "access_token_secret" : ...
 * }
 */
function getOAuthConfig(provider, config) {
    if (!isValidOAuthConfig(provider, config)) {
        console.log("Disabling twitter OAuth due to missing settings");
        return null;
    }
    return {
        "consumer_key"        : config.authentication[provider].consumerKey,
        "consumer_secret"     : config.authentication[provider].consumerSecret,
        "access_token"        : config.authentication[provider].oauth.accessToken,
        "access_token_secret" : config.authentication[provider].oauth.accessTokenSecret
    }
}

function isValidOAuthConfig(provider, config) {
    return config.hasOwnProperty("authentication") && 
           config.authentication.hasOwnProperty(provider) &&
           config.authentication[provider].hasOwnProperty("consumerKey") &&
           config.authentication[provider].hasOwnProperty("consumerSecret") &&
           config.authentication[provider].hasOwnProperty("oauth") &&
           config.authentication[provider].oauth.hasOwnProperty("accessToken") &&
           config.authentication[provider].oauth.hasOwnProperty("accessTokenSecret");
}