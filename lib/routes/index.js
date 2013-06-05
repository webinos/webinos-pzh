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
 * Author: Habib Virji (habib.virji@samsung.com) and 
 *         John Lyle (john.lyle@cs.ox.ac.uk)
 *******************************************************************************/
module.exports = function (app, address, port) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhadaptor = require('../pzhadaptor.js'),
        util = require('util'),
        helper = require('./helper.js'),
        Validator = require('express-validator').Validator;

    /* BEGIN 'GET' ROUTES */
    app.get('/', ensureAuthenticated, function (req, res) {
        hasPZHSelector( req, 
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
        res.render("enroll-pzp", {
            "address":address, 
            "port":port, 
            "user":req.user, 
            "profile":req.user,
            "pzpPort":pzpPort,
            "_csrf":req.session._csrf
        });
    }

    app.get('/home', ensureAuthenticated, ensureHasPzh, function (req, res) {
        res.render('main-userdetails', { user:getUserPath(req.user), profile:req.user, _csrf:req.session._csrf });
    });

    app.get('/connectPzh', ensureAuthenticated, ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'getAllPzh', {} , function(pzhList) {
          res.render('main-connectpzh', { user:getUserPath(req.user), profile:req.user, pzhlist:pzhList.message, _csrf:req.session._csrf });        
        });
    });
    app.get('/revokePzp', ensureAuthenticated, ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'getPzps', {} , function(pzps) {
          res.render('main-revokedevice', { user:getUserPath(req.user), profile:req.user, certs:pzps.message, _csrf:req.session._csrf });
        });
    });
    app.get('/approveUser', ensureAuthenticated, ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'getRequestingExternalUser', {} , function(waitingUsers) {
          res.render('main-approveuser', { user:getUserPath(req.user), profile:req.user, waiting:waitingUsers.message, _csrf:req.session._csrf });        
        });
    });
    app.get('/services', ensureAuthenticated, ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'listAllServices', {} , function(services) {
          res.render('main-services', { user:getUserPath(req.user), profile:req.user, services:services.message, _csrf:req.session._csrf });        
        });
    }); 

    app.get('/signup', ensureAuthenticated, function(req,res) {
        if (typeof req.query.error === undefined || req.query.error === null) {
            req.query.error = false;
        }
        res.render("signup", {user:req.user, _csrf:req.session._csrf, error:req.query.error});
    });
   
    // present certificates to an external party.
    app.all('/certificates/:nickname', function (req, res) {
        //return a JSON object containing all the certificates.
        req.assert('nickname', 'Invalid nickname').notEmpty().len(2,50).isAlphanumeric();
        req.params.nickname = decodeURIComponent(req.params.nickname);
        if (!isValid(req,res)) return;
        pzhadaptor.fromWebUnauth(req.params.nickname, {type:"getCertificates"}, res);
    });
        
    /* END 'GET' ROUTES */
/*
//  TODO: This is not working yet at the PZH TLS server
    app.post('/register-service', ensureAuthenticated, ensureHasPzh, function (req, res) {
        // PZH  / PZP address
        
        pzhadaptor.fromWeb(req.user, 'registerService', {} , function(services) {
          res.render('main-services', { user:getUserPath(req.user), profile:req.user, services:services.message, _csrf:req.session._csrf });        
        });
    });     
*/
    app.post('/unregister-service', ensureAuthenticated, ensureHasPzh, function (req, res) {
        //TODO: Check the service address is valid?
        req.assert('serviceAddress', 'No service address selected').notEmpty().len(6,100);
        req.assert('id', 'No ID for the service').notEmpty().len(5,50);
        req.assert('api', 'No API for the service').notEmpty().len(5,50);        
        if (!isValid(req,res)) return;
        if (!checkCSRF(req,res)) return;
        var msgBody = {
          at : req.body.serviceAddress,
          svID : req.body.id,
          svAPI : req.body.api
        }
        pzhadaptor.fromWeb(req.user, 'unregisterService', msgBody , function(services) {
          res.redirect('/services');
        });
    });     

    /* This post interface revokes a PZP.
     * TODO: The TLS Server appears to be broken for revocation at the moment.
     */
    app.post('/revokePzp', ensureAuthenticated, ensureHasPzh, function(req,res) {
        req.assert('pzp', 'Invalid PZP').notEmpty();
        if (!isValid(req,res)) return;        
        if (!checkCSRF(req,res)) return;
        pzhadaptor.fromWeb(req.user, "getZoneStatus", {}, function(payload) {
            if (!payload || !payload.message.pzps) {
                return doError(res,'Failed to retrieve device information');
            }
            var foundPzp = findPzpFromUrl(req.body.pzp, payload.message.pzps);
            if (foundPzp === null) {
                return doError(res, 'Failed to find requested device');
            } else {
              pzhadaptor.fromWeb(req.user, "revokePzp", { "pzpid" : foundPzp }, function(result) {
                res.render('main-revokedevice', { user:getUserPath(req.user), profile:req.user, pzp:foundPzp, revokeresult:result }); 
              });
            }
        });
    });
    
    // Arbitrary query interface.
    app.post('/query', ensureAuthenticated, ensureHasPzh, function (req, res) {
        req.assert('command', 'must have a command').notEmpty().len(3,50);
        // may have a payload and CSRF flag
        if (!isValid(req,res)) return;
        if (!checkCSRF(req,res)) return;
        pzhadaptor.fromWeb(req.user, req.body.command, req.body.payload, res, req.body.id);
    });

    function findPzpFromUrl(pzpUrl, pzps) {
        for (var p in pzps) {
            if (pzps.hasOwnProperty(p)) {
                if (pzps[p].url === pzpUrl) {
                    return pzps[p];
                }
            }
        }
        return null;
    }

    function doError(res, msg) {
        res.writeHead(500);
        res.end(msg);
        return false;
    }

    app.post('/pzpEnroll', ensureAuthenticated, ensureHasPzh, function (req, res) {
        console.log("PZP Enrol: " + util.inspect(req.body));
        req.assert('from', 'Invalid from field').notEmpty();
        req.assert('csr', 'Invalid csr').notEmpty();
        if (!isValid(req,res)) return;
        if (!checkCSRF(req,res)) return;
        
        var dataSend = {
            from:req.body.from,
            csr:req.body.csr
        }

        pzhadaptor.fromWeb(req.user, "csrFromPzp", dataSend, res);
    });

    //TODO: This should be a POST interface, not a GET interface.
    app.post('/connect-friend-local', ensureAuthenticated, ensureHasPzh, function (req, res) {
        //Args: The external user's ID
        //Auth: User must have logged into their PZH
        //UI: NONE
        //Actions: adds the friend's details to the list of known users
        //         adds the user's details to the friend's list of 'awaiting approval'
        req.assert('nickname', 'Invalid nickname').notEmpty().len(2,50).isAlphanumeric();
        if (!isValid(req,res)) return;
        if (!checkCSRF(req,res)) return;
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
    app.post('/connect-friend', ensureAuthenticated, ensureHasPzh, function (req, res) {
        //Args: The external user's nickname and PZH provider
        //Auth: User must have logged into their PZH
        //UI: NONE
        //Actions: adds the friend's details to the list of 'waiting for approval', redirects the user to the external PZH
    
        req.assert('nickname', 'Invalid nickname').notEmpty().len(2,50).isAlphanumeric();
        req.assert('pzhaddress', 'Invalid PZH address').notEmpty().contains('.').isPzhAddress().isUrl();
        if (!isValid(req,res)) return;
        if (!checkCSRF(req,res)) return;
        var externalNickname = req.body.nickname;
        var externalPZH = req.body.pzhaddress;
                
        logger.log("External: " + externalNickname + " - " + externalPZH);
        helper.getCertsFromHost(externalNickname, externalPZH, function (certs) {
            pzhadaptor.storeExternalUserCert(req.user, externalNickname, externalPZH, certs.message, function (status) {
                if (status.message) {//get my details from somewhere
                    var myCertificateUrl = "https://" + address + ":" + port + "/certificates/" + encodeURIComponent(req.user.nickname);
                    var myPzhUrl = "https://" + address + ":" + port + "";
                    //where are we sending people
                    var redirectUrl = "https://" + externalPZH + "/external/request-access-login?" + 
                        "certUrl="    + encodeURIComponent(myCertificateUrl) +
                        "&nickname="  + encodeURIComponent(externalNickname) +
                        "&pzhInfo="   + encodeURIComponent(myPzhUrl) + 
                        "&ownUserId=" + encodeURIComponent(req.user.nickname);
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
      
        // technically this is a problem.
        // someone could change the URI in transit to transfer different certificates
        // this would make Bob think that Alice was from a different personal zone.
        // TODO: Work out some way of putting the 'get' data into the body, despite this being a redirect.
    });

    app.post('/createPzh', ensureAuthenticated, function(req,res) {
      req.assert('nickname', 'No nickname chosen').notEmpty();
      req.assert('nickname', 'No nickname chosen').len(2,50).isAlphanumeric().notContains(" ");
      if (!isValid(req,res)) return;
      if (!checkCSRF(req,res)) return;
      pzhadaptor.addPzh(req.user, req.body.nickname, function(msg) {
          if (msg.message === 'undefined' || msg.message === null || msg.message.id == 'undefined' || msg.message.id === null) {
              // this nickname was taken.  Go back a step.
              res.redirect('/signup?error=true&nickname=' + encodeURIComponent(req.body.nickname));
          } else {
              //Assume successful PZH addition.
              req.user.hasPzh = true;
              req.user.nickname = msg.message.nickname;
              res.redirect('/');
          }
      });
    });

    app.post('/make-user-decision', ensureAuthenticated, ensureHasPzh, function (req, res) {
        if (!checkCSRF(req,res)) return;
        req.assert('decision', 'Invalid decision').notEmpty();
        if (!isValid(req,res)) return;
        if (req.body.decision && req.user) {
            pzhadaptor.approveFriendRequest(req.user, req.body.decision, res);
        } else {
            pzhadaptor.rejectFriendRequest(req.user, req.body.decision, res);
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
        hasPZHSelector(req, function(foundUser) {
            next();
        }, function() {
            res.redirect('/login');
        });
    }
    
    // Use this to check that the user has a PZH, as well as being authenticated.
    function hasPZHSelector(req, yesFn, noFn) {
        if (req.isAuthenticated() && req.user.hasPzh) {
            yesFn();
        } else {
            noFn(); 
        };
    }
    function getUserPath(user) {
        return encodeURIComponent(user.emails[0].value);
    }
    
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

    function checkCSRF(req, res) {
        // check to see whether there is a valid csrf token in the body of the 
        // request, compared with req.session._csrf
        // we're only checking the body, nowhere else.
        if (typeof req.session._csrf === undefined || req.session._csrf === "" || req.session._csrf === null) {
            return doError(res, "Failed to find a valid CSRF token in the session data");
        }
        if (typeof req.body._csrf === undefined || req.body._csrf === null) {
            return doError(res, "Failed to find a valid CSRF token in request body");
        }
        if (req.body._csrf !== req.session._csrf) {
            return doError(res, "CSRF token does not match the expected value");
        }
        return true;
    }

    function isValid(req,res) {
        var errors = req.validationErrors(true);
        if (errors) {
            res.send('There have been validation errors: ' + util.inspect(errors), 500);
        }
        return !errors;
    }    
};
