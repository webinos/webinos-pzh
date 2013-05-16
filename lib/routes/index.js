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
module.exports = function (app, address, port) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhadaptor = require('../pzhadaptor.js'),
        util = require('util'),
        helper = require('./helper.js');

    app.get('/', ensureAuthenticated, function (req, res) {
        hasPZHSelector( req.user, 
            function() {
                // You have a PZH.  Are you a PZP enrolling?  If so, we've got to enroll you.
                if (req.session.isPzp) {
                    handleEnrolmentPostLogin(req,res);
                } else {
                    res.redirect('/home');
                }
            }, 
            function() {
                // No PZH? Then either you're here to request access to someone 
                // else's PZP, or you should go and sign up for one.
                if (req.session.isExternal) {
                    res.redirect('/external/request-access-login');
                } else {
                    res.redirect('/signup');             
                }
            }
        );
    });
    
    function handleEnrolmentPostLogin(req,res) {
        var pzpPort = req.session.pzpPort;
        req.session.isPzp = "";
        req.session.pzpPort = "";
        pzhadaptor.enrollPzpWithAuthCode( req.user, function(msg) {
            res.render("enroll-pzp", {
                "address":address, 
                "port":port, 
                "authCode":msg.message.payload.code, 
                "user":req.user, 
                "pzpPort":pzpPort
            });
        });
    }

    app.get('/home', ensureAuthenticated, ensureHasPzh, function (req, res) {
        res.render('main', { user:getUserPath(req.user), profile:req.user });
    });

    // Arbitrary query interface.
    app.post('/query', ensureAuthenticated, function (req, res) {
        pzhadaptor.fromWeb(req.user, req.body, res);
    });

    // present certificates to an external party.
    app.all('/certificates/:useremail', function (req, res) {
        //return a JSON object containing all the certificates.
        pzhadaptor.fromWebUnauth(req.params.useremail, {type:"getCertificates"}, res);
    });

    app.post('/pzpEnroll', ensureAuthenticated, ensureHasPzh, function (req, res) {
        var dataSend = {
            payload:{
                status:"csrAuthCodeByPzp",
                from:req.body.from,
                csr:req.body.csr,
                code:req.body.authCode
            }
        };
        pzhadaptor.fromWeb(req.user, dataSend, res);
    });

    //TODO: This should be a POST interface, not a GET interface.
    app.get('/connect-friend-local', ensureAuthenticated, ensureHasPzh, function (req, res) {
        //Args: The external user's email address
        //Auth: User must have logged into their PZH
        //UI: NONE
        //Actions: adds the friend's details to the list of known users
        //         adds the user's details to the friend's list of 'awaiting approval'
        var externalEmail = req.query.externalemail;
        logger.log("External: " + externalEmail);
        if (externalEmail === req.user.emails[0].value) {
            res.writeHead(200);
            res.end('Cannot register own PZH ' + externalEmail);
        } else {
            pzhadaptor.requestAddLocalFriend(req.user, externalEmail, function (status) {
                if (status.message) {
                    //success, return home.
                    res.redirect('/');
                } else {
                    res.writeHead(200);
                    res.end('Certificate already exchanged');
                }
            });
        }
    });

    //Certificate exchange...
    //TODO: This should be a POST interface, not a GET interface.
    app.get('/connect-friend', ensureAuthenticated, ensureHasPzh, function (req, res) {
        //Args: The external user's email address and PZH provider
        //Auth: User must have logged into their PZH
        //UI: NONE
        //Actions: adds the friend's details to the list of 'waiting for approval', redirects the user to the external PZH
        var externalEmail = req.query.externalemail;
        var externalPZH = req.query.externalpzh;
        logger.log("External: " + externalEmail + " - " + externalPZH);
        if (externalEmail === req.user.emails[0].value) {
            res.writeHead(200);
            res.end('Cannot register own PZH ' + externalEmail);
        } else {
            //get those certificates
            helper.getCertsFromHost(externalEmail, externalPZH, function (certs) {
                pzhadaptor.storeExternalUserCert(req.user, externalEmail, externalPZH, certs.message, function (status) {
                    if (status.message) {//get my details from somewhere
                        var myCertificateUrl = "https://" + address + ":" + port + "/certificates/" + req.params.user;
                        var myPzhUrl = "https://" + address + ":" + port + "";
                        //where are we sending people
                        var redirectUrl = "https://" + externalPZH + "/external/request-access-login?" + 
                            "certUrl="    + encodeURIComponent(myCertificateUrl) +
                            "&userEmail=" + encodeURIComponent(externalEmail) +
                            "&pzhInfo="   + encodeURIComponent(myPzhUrl) + 
                            "&ownEmailId="+ encodeURIComponent(req.params.user);
                        res.redirect(redirectUrl);
                    } else {
                        res.writeHead(200);
                        res.end('Certificate already exchanged');
                    }
                });
            }, function (err) {
                res.writeHead(200);
                res.end('Failed to retrieve certificate from remote host');
            });
        }
        // technically this is a problem.
        // someone could change the URI in transit to transfer different certificates
        // this would make Bob think that Alice was from a different personal zone.
        // TODO: Work out some way of putting the 'get' data into the body, despite this being a redirect.
    });

    app.post('/createPzh', ensureAuthenticated, function(req,res) {
      pzhadaptor.addPzh(req.user, function(userid) {
          res.redirect('/');      
      });
    });

    app.get('/signup', ensureAuthenticated, function(req,res) {
      res.render("signup", {user:req.user});
    });

    app.get('/approve-user?externalemail', ensureAuthenticated, ensureHasPzh, function (req, res) {
        pzhadaptor.getRequestingExternalUser(req.user, req.params.externalemail, function (answer) {
            if (answer.message) {
                res.render("approve-user", {user:req.user, externalUser:req.params.externalemail});
            } else {
                res.writeHead(200);
                res.end('Failed to approve user ' + req.params.externalemail);
            }
        });
        //Args: None
        //Auth: PZH login required
        //UI: Show the external user's details
        //Actions: have a button that, once approved, add the external user's certificate details to the trusted list.
    });

    //TODO: Solve all the CSRF issues
    app.post('/make-user-decision', ensureAuthenticated, ensureHasPzh, function (req, res) {
        if (req.body.decision && req.user) {
            pzhadaptor.approveFriend(req.user, req.body.decision, res);
        } else {
            pzhadaptor.rejectFriend(req.user, req.body.decision, res);
        }
        res.redirect('/');
    });
    
    // Simple route middleware to ensure user is authenticated.
    //   Use this route middleware on any resource that needs to be protected.  If
    //   the request is authenticated (typically via a persistent login session),
    //   the request will proceed.  Otherwise, the user will be redirected to the
    //   login page.
    function ensureAuthenticated(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/login');
    }

    // must be called after ensureAuthenticated
    function ensureHasPzh(req, res, next) {
        hasPZHSelector(req.user, next, function() {
          res.redirect('/login');
        });
    }
    
    // Use this to check that the user has a PZH, as well as being authenticated.
    // TODO: Cache this information to save some time.
    function hasPZHSelector(user, yesFn, noFn) {
        pzhadaptor.checkUserHasPzh(user, function(answer) {
          if (answer.message) {
            yesFn();
          } else {
            noFn();
          }
        });
    }
    function getUserPath(user) {
        return encodeURIComponent(user.emails[0].value);
    }
};
