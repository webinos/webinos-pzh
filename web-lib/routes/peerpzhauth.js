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
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
module.exports = function (app, authConfig, routeutil) {
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhadaptor = require('../pzhadaptor.js'),
        util = require("util"),
        url = require("url"),
        Validator = require('express-validator').Validator;


   // This is the landing page for external users
   // They get redirected to authenticate, then land up here again
   // There should be plenty of data in the session about them
    app.get('/external/request-access-login', function(req, res) {       
        if (recordVarsInSession(req,res)) {
            if (req.isAuthenticated()) {
                makeConnectionRequest(req,res);
            } else {
                redirectToLogin(req,res);
            }
        } else {
            res.writeHead(200);
            res.end('Error: wrong parameters in request');
        }
    });

    app.get('/approveUser', routeutil.ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'getRequestingExternalUser', {} , function(waitingUsers) {
          res.render('main-approveuser', { user:routeutil.getUserPath(req.user), profile:req.user, waiting:waitingUsers.message, _csrf:req.session._csrf });        
        });
    });

    function makeConnectionRequest(req,res) {   
        var myNickname = req.session.externalReq.targetNickname;
        var externalPzhServer = url.parse(req.session.externalReq.pzhAddress);
        logger.log("Successfully authenticated external user: " + req.user.emails[0].value +
                      " who wants to connect to " + myNickname + 
                      " and who claims to have nickname: " + externalPzhServer.auth + " and Cert URL: " + req.session.externalReq.pzhCertUrl +
                      " and PZH Server address: " + req.session.externalReq.pzhAddress);

        // we don't know the external nickname for sure, but we're willing to believe
        // what we're told at this stage...
        req.user.nickname = externalPzhServer.auth;
        
        // Now, we need to get the certs of this external user
        routeutil.getJsonFromHostByUrl(req.session.externalReq.pzhCertUrl, function(certs) {
            var pzhData = {
                pzhCerts   : certs.message,
                pzhCertUrl : req.session.externalReq.pzhCertUrl,
                pzhAddress : req.session.externalReq.pzhAddress
            };
            
            //find a good URL to redirect the user to.
            var externalPzhWebAddress = url.parse(req.session.externalReq.pzhCertUrl);
            delete externalPzhWebAddress.pathname;
            delete externalPzhWebAddress.path;
            delete externalPzhWebAddress.query;
            
            pzhadaptor.requestAddFriend(req.user, myNickname, pzhData, function (status) {
                if (status.message) {
                    res.render("external-request-success",
                        { "externaluser"   : req.user, 
                          "user"           : myNickname,
                          "externalPzhUrl" : url.format(externalPzhWebAddress)
                        });
                } else {
                    res.writeHead(200);
                    res.end('Error requesting inter-zone connection');
                    return;
                }
            });
        }, function (err) {
            res.writeHead(200);
            res.end('Failed to retrieve certificate from remote host');
            return;
        });
    }
    
    /**
     * Record incoming variables to the session, return false if no variables
     * are found or already present.
     * 
     */
    function recordVarsInSession(req, res) {
        console.log("Found query vars: " + util.inspect(req.query));
        if (!req.hasOwnProperty("query")) return false;
        if ((typeof req.query.pzhCertUrl !== 'undefined') &&
              (typeof req.query.pzhAddress !== 'undefined') &&
              (typeof req.query.targetNickname !== 'undefined')) {
            req.session.externalReq = {};
            req.session.externalReq.pzhCertUrl = req.query.pzhCertUrl;
            req.session.externalReq.pzhAddress = req.query.pzhAddress;
            req.session.externalReq.targetNickname = req.query.targetNickname;            
            return true;
        } else {
            return req.session.hasOwnProperty("externalReq") && 
              req.session.externalReq.hasOwnProperty("pzhCertUrl") && 
              req.session.externalReq.hasOwnProperty("pzhAddress") && 
              req.session.externalReq.hasOwnProperty("targetNickname");
        }
    }

    // This is where we redirect if they are not authenticated.
    function redirectToLogin(req, res) {
        req.session.isExternal = true;
        res.render('login', { auth:authConfig, "isPzp" : false, "isExternal" : true, "nickname":req.params.nickname});
    }

    app.post('/make-user-decision', routeutil.ensureHasPzh, function (req, res) {
        if (!routeutil.checkCSRF(req,res)) return;
        req.assert('decision', 'Invalid decision').notEmpty();
        if (!routeutil.isValid(req,res)) return;
        if (req.body.decision && req.user) {
            pzhadaptor.approveFriendRequest(req.user, req.body.decision, res);
        } else {
            pzhadaptor.rejectFriendRequest(req.user, req.body.decision, res);
        }
        res.redirect('/');
    });

    app.post('/connect-friend-local', routeutil.ensureHasPzh, function (req, res) {
        //Args: The external user's nickname
        //Actions: adds the friend's details to the list of known users
        //         adds the user's details to the friend's list of 'awaiting approval'
        req.assert('nickname', 'Invalid nickname').notEmpty().len(2,50).isAlphanumeric();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        var externalNickname = req.body.nickname;        
        logger.log("Local friend: " + externalNickname);
        pzhadaptor.requestAddLocalFriend(req.user, externalNickname, function (status) {
            if (status.message) {
                //success, return home.
                res.redirect('/');
            } else {
                return onError(res, 'Certificate already exchanged');
            }
        });
    });

    //Certificate exchange...
    app.post('/connect-friend', routeutil.ensureHasPzh, function (req, res) {
        //Args: The external user's nickname and PZH provider
        //Auth: User must have logged into their PZH
        //UI: NONE
        //Actions: adds the friend's details to the list of 'waiting for approval', redirects the user to the external PZH
    
        req.assert('nickname', 'Invalid nickname').notEmpty().len(2,50).isAlphanumeric();
        // This is the one place where pzhaddress ISNT a URL, but rather a domain with optional port.
        req.assert('pzhaddress', 'Invalid PZH address').notEmpty().contains('.').isPzhAddress().isUrl();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        var externalNickname = req.body.nickname;

        // The problem here, is that we know the PZH host name, but we don't know any ports.  We're going to have to guess. 
        // We're expecting to get the web server port, we'll then use that to get certificates which will also contain the server port.
        var externalPZHwebport = req.body.pzhaddress.split(":")[1] || 443
        var externalPZHdomain = req.body.pzhaddress.split(":")[0] || req.body.pzhaddress
        var externalPZHwebaddress = routeutil.getExternalPzhWebServerUrl(externalPZHdomain, externalPZHwebport);
        var externalCertUrl = routeutil.getExternalPzhCertificatesUrl(externalPZHdomain, externalPZHwebport, externalNickname);

        logger.log("External Cert URL expected: " + externalCertUrl);

        routeutil.getJsonFromHostByUrl(externalCertUrl, function (certs) {
            // Now I have the full address.
            var externalPZHAddress = routeutil.getFullExternalPzhAddress(externalPZHdomain, certs.message.serverPort, externalNickname);

            logger.log("Now expecting to add PZH with address: " + externalPZHAddress + ", and with certificates message " + certs.message.provider);

            // Store this user certificate as 'untrusted'
            pzhadaptor.storeExternalUserCert(req.user, externalPZHAddress, certs.message, false, function (status) {
                if (status.message) {//get my details from somewhere
                    // Redirect to the external PZH.
                    var redirectUrl = routeutil.getUrlForExternalRequestAccessLogin(externalPZHwebaddress, req.user.nickname, externalNickname);
                    res.redirect(redirectUrl);
                    logger.log("Now redirecting to : " + redirectUrl);
                } else {
                    res.writeHead(200);
                    res.end('Certificate already exchanged');
                }
            });
        }, function (err) {
            res.writeHead(200);
            res.end('Failed to retrieve certificate from remote host');
        });
      
        // technically this is a problem.
        // someone could change the URI in transit to transfer different certificates
        // this would make Bob think that Alice was from a different personal zone.
        // TODO: Work out some way of putting the 'get' data into the body, despite this being a redirect.
    });

    Validator.prototype.isJson = function() {
        var json = JSON.parse(this.str);
        if (typeof json === 'undefined' || json === null) {
            this.error(this.msg || this.str + " is not JSON or is null");
        }
        return this;
    }
    
    Validator.prototype.isPzhAddress = function() {
        this.str = "https://" + this.str;    
        return this;
    };
};
