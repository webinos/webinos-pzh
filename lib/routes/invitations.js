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
 * Copyright 2013 University of Oxford
 * Author: John Lyle (john.lyle@cs.ox.ac.uk)
 *******************************************************************************/
module.exports = function (app, authConfig, routeutil) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhadaptor = require('../pzhadaptor.js'),
        util = require('util'),
        url = require('url'),
        Validator = require('express-validator').Validator;


    app.get('/twitterInvite', routeutil.ensureHasPzh, routeutil.hasTwitter, function(req,res) {
        var twitterInvite = require('./twitterinvite.js');
        var T = new twitterInvite(authConfig.twitter.oauth, req.user.username)
        T.getContacts(function(userList) {
            var twitter = { "friends" : userList };
            res.render('main-twitterinvite', { user:routeutil.getUserPath(req.user), profile:req.user, twitter:twitter, _csrf:req.session._csrf });
        }, function(err) {
            logger.log(err);
            res.redirect('/');
        });
    });

    /* This is just for testing, and should be deleted before any pull request
     *
     */
    //app.get('/genericInvite', routeutil.ensureHasPzh, routeutil.hasTwitter, function(req,res) {
    //    pzhadaptor.registerToken( req.user, { "provider" : "generic", "id":"none" }, function(reply) {
    //        var targetPzhUrl = routeutil.getGenericPzhUrl(); // we use a generic point to the recipient's own PZH.  TODO.
            // create a URL pointing to confirmTokenInvite containing the details of this PZH and the token.
    //        req.session.linkUrl = routeutil.getUrlForConfirmTokenInvite(targetPzhUrl, req.user.nickname , reply.message );
    //        res.redirect('/twitter-invite-success');
    //    });
    //})

    app.get('/twitter-invite-success', routeutil.ensureHasPzh, routeutil.hasTwitter, function(req,res) {
        res.render('main-twittersuccess',{ user:routeutil.getUserPath(req.user), profile:req.user, linkUrl : req.session.linkUrl, _csrf:req.session._csrf });
    });

    /* This method is called when the user has received an invitation to connect to another personal 
     * zone, with a token delivered out-of-band.  It will ask the recipient to approve the request
     * and then accept the invitation.
     */
    // '/confirmTokenInvite'
    app.get(routeutil.getPathForConfirmTokenInvite(), routeutil.ensureHasPzh, function(req,res) {
        req.assert('token', 'Invalid token').notEmpty().len(50,1000);
        req.assert('pzhCertUrl', 'Invalid external URL').notEmpty().isUrl();
        req.assert('pzhAddress', 'Invalid external PZH URL').notEmpty().isUrl();
        if (!routeutil.isValid(req,res)) return;

        req.session.invite = {};
        req.session.invite.token = req.query.token;
        req.session.invite.pzhCertUrl = req.query.pzhCertUrl;
        req.session.invite.pzhAddress = req.query.pzhAddress;

        var external = {
            token    : req.query.token,
            pzhurl   : req.query.pzhAddress
        }

        res.render('main-confirminvite', { user:routeutil.getUserPath(req.user), profile:req.user, external:external, _csrf:req.session._csrf });
    });

    // This is the page that another PZH can use to send their pre-approved certificates.
    // It is entirely unauthenticated, relying on token authentication.  This is actually
    // a bit worrying.  LONG Tokens are needed, as this is subject to online attacks.
    // Also (TODO), this probably requires a timeout, to prevent too many requests.
    // Arguments expected:
    // token, pzhAddress, pzhCertUrl, targetNickname
    app.get('/external/request-access-with-token', function(req,res) {
        // check we have the right arguments
        req.assert('targetNickname', 'No nickname given').len(2,50).isAlphanumeric().notContains(" ");
        req.assert('pzhCertUrl', 'No valid URL for external certificates').len(2,100).isUrl();
        req.assert('pzhAddress', 'No valid URL for the external PZH').len(2,100).isUrl();
        req.assert('token', 'No token given').notEmpty().len(75,200);
        if (!routeutil.isValid(req,res)) return;

        var externalNickname = url.parse(req.query.pzhAddress).auth;

        // check that the token is valid
        pzhadaptor.checkToken(req.query.targetNickname, req.query.token, function(msg) {
            if (msg !== null && msg.message.result) {
                addExternalAsTrusted(req.query.pzhCertUrl, req.query.pzhAddress, { nickname : req.query.targetNickname }, function() {
                    //success
                    pzhadaptor.deleteToken(req.query.targetNickname, req.query.token, function() { /* Do nothing */ });
                    res.json({result : "success"});
                }, function(err) {
                    res.json(500, { error : "Failed to add your PZH."}); 
                });
            } else {
                res.json(500, { error : "Invalid token"});  
            }
        }, function(err) {
            logger.log(err);
            res.json(500, { error : "Failed to retrieve certificates: unknown error"});
        });
    });

	function sendDirectMessage(user, recipient, link, cb, errcb) {
		var msg = link;
		logger.log("Sending a direct twitter message to " + recipient + ", Message: \"" + msg + "\"");
		var twitterInvite = require('./twitterinvite.js');
        var T = new twitterInvite(authConfig.twitter.oauth, user.username)
        T.sendDM(recipient, msg, cb, errcb);
	}

    app.post('/invite-friend-twitter', routeutil.ensureHasPzh, function(req,res) {
        req.assert('twitterId', 'No twitter ID given').notEmpty().len(2,20).isNumeric();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        pzhadaptor.registerToken( req.user, { "provider" : "twitter", "id":req.body.twitterId }, function(reply) {
            var targetPzhUrl = routeutil.getGenericPzhUrl(); // we use a generic point to the recipient's own PZH.  TODO.
            // create a URL pointing to confirmTokenInvite containing the details of this PZH and the token.
            req.session.linkUrl = routeutil.getUrlForConfirmTokenInvite(targetPzhUrl, req.user.nickname , reply.message );
            //TODO: Send with Twitter.
            sendDirectMessage(req.user, req.body.twitterId, req.session.linkUrl, function(result) {
            	res.redirect('/twitter-invite-success');
            }, function(err) {
            	res.json(500, { error : "Failed to send Direct Message", message: err});
            });
        });
    });

        // Having received an invitation token, this POST method is called to process it
    // this is going to get a bunch of certificates and install them as trusted,
    // and then do something weird to make the request happen on the external PZH
    app.post('/acceptTokenInvite', routeutil.ensureHasPzh, function(req,res) {
        if (!routeutil.checkCSRF(req,res)) return;
        if (typeof req.session.invite == "undefined" || req.session.invite === null ) {
            logger.log("Lack of session data")
            res.writeHead(200, "Invalid external PZH - no session data");
            return;
        }
        // I need to ask the remote PZH to add me
        var externalPZH = req.session.invite.pzhAddress;
        var externalPZHCerts = req.session.invite.pzhCertUrl;
        var externalNickname = url.parse(req.session.invite.pzhAddress).auth;
        // note that the base URL is the web server, not the PZH TLS server.
        var remoteUrl = routeutil.getUrlForAddUserByToken(req.session.invite.pzhCertUrl, req.user.nickname, req.session.invite.token, externalNickname);

        // send the external users my details
        routeutil.getJsonFromHostByUrl(remoteUrl, function(data) {
            if (typeof data.error !== "undefined" && data.error !== null) {
                routeutil.doError(res, 'Failed to sign up with remote host');
                return;
            } else if (data.result === "success") {
                addExternalAsTrusted(externalPZHCerts, externalPZH, req.user, function() {
                    res.redirect('/');
                }, function (err) {
                    routeutil.doError(res, 'Failed to retrieve certificate from remote host');
                    return;
                });
            }
        }, function(error) {
            logger.log(error);
            routeutil.doError(res, "Invalid external PZH");
            return;
        });
    });

    function addExternalAsTrusted(externalPZHCertUrl, externalPZHAddress, user, successcb, errorcb) {
        // Add the external user
        logger.log("Adding an external as a 'trusted' PZH.  External: " + externalPZHAddress);

        routeutil.getJsonFromHostByUrl(externalPZHCertUrl, function (certs) {
            pzhadaptor.storeExternalUserCert(user, externalPZHAddress, certs.message, function (status) {
                if (status.message) {
                    successcb(status);
                } else {
                    errorcb(status);
                }
            });
        }, errorcb);
    }
};