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
module.exports = function (app, authConfig, routeutil, serverAddress) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhadaptor = require('../pzhadaptor.js'),
        util = require('util'),
        url = require('url'),
        Validator = require('express-validator').Validator;


    // This route on Alice's PZH allows Bob to visit and find out who she is.
    // Following this, it will redirect Bob to his own PZH, to allow him to accept
    // the invitation to connect
    // WARNING: UNAUTHENTICATED
    // TODO: DoS protection
    app.get('/inviteRedirect/:nickname/:token', function(req,res) {
        req.assert('token', 'Invalid token').notEmpty().len(50,1000);
        req.assert('nickname', 'Invalid user selected').len(2,50).isAlphanumeric().notContains(" ");
        if (!routeutil.isValid(req,res)) return;
        // look up the token to see whether it is valid.
        // if so, present some information.
        req.params.token = decodeURIComponent(req.params.token);
        pzhadaptor.checkToken(req.params.nickname, req.params.token, function(msg) {
            if (msg !== null && msg.message.result) {
                pzhadaptor.fromWebUnauth(req.params.nickname, {"type" : "getUserDetails"}, function(userDetails) {
                    res.render('invite-redirect', {user:userDetails.message, token:req.params.token, nickname:req.params.nickname, _csrf:req.session._csrf} );
                })
            } else {
                res.json(500, { error : "Invalid token"});  
            }
        }, function(err) {
            logger.log(err);
            res.json(500, { error : "Invalid request: bad token."});
        });
    });


    // All we do here is redirect to the PZH of the external user.
    // nickname: the user of THIS personal zone, not the external
    // token: the token for THIS personal zone, not the external
    // pzhUrl: the URL for the external user, sans any path information.
    // WARNING: UNAUTHENTICATED
    // TODO: DoS protection
    app.post('/inviteRedirect', function(req,res) {
        req.assert('token', 'Invalid token').notEmpty().len(50,1000);
        req.assert('nickname', 'Invalid user selected').len(2,50).isAlphanumeric().notContains(" ");
        //Note: this is not the pzhAddress of the server, but of the web server.
        req.assert('pzhWebUrl', 'Invalid external PZH URL').notEmpty().isUrl();        
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;

        //This is all unauthenticated, so lets check the PZH URL again
        pzhadaptor.checkToken(req.body.nickname, req.body.token, function(msg) {
            var targetUrl = url.parse(req.body.pzhWebUrl);
            var linkUrl = routeutil.getUrlForConfirmTokenInvite(url.format(targetUrl), req.body.nickname , req.body.token );
            logger.log("Redirecting to external PZH: " + linkUrl);
            res.redirect(linkUrl);
        }, function(err) {
            logger.log(err);
            res.json(500, { error : "Invalid request: bad token."});
        });
    });

    app.get('/invite', routeutil.ensureHasPzh, function(req,res) {
        var inviter = null;
        var postAddress = null;
        if (req.user.from === "twitter") {
            var twitterInvite = require('./twitterinvite.js');
            inviter = new twitterInvite(authConfig.twitter.oauth, req.user);
            postAddress = "/invite-friend-twitter";
        } else if (req.user.from === "facebook") {
            var fbInvite = require('./facebookinvite.js');
            inviter = new fbInvite(req.user.accessToken, req.user);
            postAddress = "/invite-friend-facebook";
        } else {
            logger.log("Need either a facebook or twitter user account");
            res.redirect("/genericInvite");
            return;
        }

        inviter.getContacts(function(userList) {
            userList = userList.sort(function(a,b) { 
                if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
                if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
                return 0;
            });
            res.render('main-invite', { user:routeutil.getUserPath(req.user), profile:req.user, friends:userList, postAddress:postAddress, _csrf:req.session._csrf });
        }, function(err) {
            logger.log(err);
            res.redirect('/');
        });
    });

    app.get('/genericInvite', routeutil.ensureHasPzh, function(req,res) {
        pzhadaptor.registerToken( req.user, { "provider" : "generic", "id":"none" }, function(reply) {
            // create a URL pointing to confirmTokenInvite containing the details of this PZH and the token.
            req.session.linkUrl = routeutil.getUrlForInviteRedirect(req.user.nickname , reply.message );
            routeutil.shortenUrl(req.session.linkUrl, function(shortUrl) {
                req.session.linkUrl = shortUrl;
                res.redirect('/invite-success?showLink=true');
            }, function(err) {
                logger.log("URL Shortening error: " + err);
                res.redirect('/invite-success?showLink=true');
            });
        });
    })

    app.get('/invite-success', routeutil.ensureHasPzh, function(req,res) {
        var showLink = req.query.showLink || false;
        var showMessage = req.query.showMessage || false;
        res.render('main-invitesuccess',{ user:routeutil.getUserPath(req.user), profile:req.user, linkUrl : req.session.linkUrl, showLink : showLink, showMessage:showMessage, _csrf:req.session._csrf });
        req.session.linkUrl = null;
    });

    /* This method is called when the user has received an invitation to connect to another personal 
     * zone, with a token delivered out-of-band.  It will ask the recipient to approve the request
     * and then accept the invitation.
    *
     * This route will work in the following situation:
     * You receive an invitation to someone else's personal zone, through a
     * URL pointing to YOUR personal zone, at this address.
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
                addExternalAsTrusted(req.query.pzhCertUrl, req.query.pzhAddress, { nickname : req.query.targetNickname }, false, function() {
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
        var T = new twitterInvite(authConfig.twitter.oauth, user)
        T.sendDM(recipient, msg, cb, errcb);
	}

    app.post('/invite-friend-twitter', routeutil.ensureHasPzh, function(req,res) {
        req.assert('friendId', 'No twitter ID given').notEmpty().len(2,20).isNumeric();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        pzhadaptor.registerToken( req.user, { "provider" : "twitter", "id":req.body.friendId }, function(reply) {
            req.session.linkUrl = routeutil.getUrlForInviteRedirect(req.user.nickname, reply.message);
            sendDirectMessage(req.user, req.body.friendId, req.session.linkUrl, function(result) {
            	res.redirect('/invite-success?showMessage=true');
            }, function(err) {
            	res.json(500, { error : "Failed to send Direct Message", message: err});
            });
        });
    });

    app.post('/invite-friend-facebook', routeutil.ensureHasPzh, function(req,res) {
        req.assert('friendId', 'No facebook ID given').notEmpty().len(2,20).isNumeric();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        pzhadaptor.registerToken( req.user, { "provider" : "facebook", "id":req.body.friendId }, function(reply) {
            req.session.linkUrl = routeutil.getUrlForInviteRedirect(req.user.nickname, encodeURIComponent(reply.message));
            var fbInvite = require('./facebookinvite.js');
            var inviter = new fbInvite(req.user.accessToken, authConfig.facebook.app_id, req.user);
            var returnUrl = url.parse(serverAddress);
            returnUrl.path = "/invite-success";
            returnUrl.query = {"showMessage" : true};
            inviter.getSendRedirect(req.body.friendId, req.session.linkUrl, url.format(returnUrl), function(result) {
                logger.log("Redirecting to " + result);
                res.redirect(result);
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
        // kill all stored session data.
        req.session.shouldRedirect = false;
        req.session.originalUrl = null;
        
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
                addExternalAsTrusted(externalPZHCerts, externalPZH, req.user, true, function() {
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

    function addExternalAsTrusted(externalPZHCertUrl, externalPZHAddress, user, connectImmediately, successcb, errorcb) {
        // Add the external user
        logger.log("Adding an external as a 'trusted' PZH.  External: " + externalPZHAddress);
        if (connectImmediately) {
            logger.log("Will immediately establish connection");
        }
        routeutil.getJsonFromHostByUrl(externalPZHCertUrl, function (certs) {
            pzhadaptor.storeExternalUserCert(user, externalPZHAddress, certs.message, connectImmediately, function (status) {
                if (status.message) {
                    successcb(status);
                } else {
                    errorcb(status);
                }
            });
        }, errorcb);
    }
};