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
module.exports = function (app, address, port, routeutil) {
    "use strict";
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhadaptor = require('../pzhadaptor.js'),
        util = require('util'),
        url = require('url'),
        Validator = require('express-validator').Validator;

    /* BEGIN 'GET' ROUTES */
    app.get('/', routeutil.ensureAuthenticated, function (req, res) {
        routeutil.hasPZHSelector( req, 
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
                    res.redirect(routeutil.getPathForRequestAccessLogin());
                } else {
                    res.redirect('/signup');             
                }
            }
        );
    });
    
    function handleEnrolmentPostLogin(req,res) {
        res.render("enroll-pzp", {
            "address":address, 
            "port":port, 
            "user":req.user, 
            "profile":req.user,
            "pzpPort":req.session.pzpPort,
            "deviceType":req.session.deviceType,
            "friendlyName":req.session.friendlyName,
            "_csrf":req.session._csrf
        });
        req.session.isPzp = "";
        req.session.pzpPort = "";
        req.session.deviceType = "";
        req.session.friendlyName = "";
    }

    app.get('/home', routeutil.ensureHasPzh, function (req, res) {
        res.render('main-userdetails', { user:routeutil.getUserPath(req.user), profile:req.user, _csrf:req.session._csrf });
    });

    app.get('/connectPzh', routeutil.ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'getAllPzh', {} , function(pzhList) {
            pzhadaptor.registerToken( req.user, { "provider" : "generic", "id":"none" }, function(reply) {
                // create a URL pointing to confirmTokenInvite containing the details of this PZH and the token.
                req.session.linkUrl = routeutil.getUrlForInviteRedirect(req.user.nickname , reply.message );
                routeutil.shortenUrl(req.session.linkUrl, function(shortUrl) {
                    res.render('main-connectpzh', { user:routeutil.getUserPath(req.user), profile:req.user, linkUrl:shortUrl, pzhlist:pzhList.message, _csrf:req.session._csrf });
                }, function(err) {
                    res.render('main-connectpzh', { user:routeutil.getUserPath(req.user), profile:req.user, linkUrl:linkUrl, pzhlist:pzhList.message, _csrf:req.session._csrf });
                });
            });
        });
    });
    app.get('/revokePzp', routeutil.ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'getPzps', {} , function(pzps) {
          res.render('main-revokedevice', { user:routeutil.getUserPath(req.user), profile:req.user, certs:pzps.message, _csrf:req.session._csrf });
        });
    });
    app.get('/services', routeutil.ensureHasPzh, function (req, res) {
        pzhadaptor.fromWeb(req.user, 'listAllServices', {} , function(services) {
          res.render('main-services', { user:routeutil.getUserPath(req.user), profile:req.user, services:services.message, _csrf:req.session._csrf });
        });
    }); 

    app.get('/signup', routeutil.ensureAuthenticated, function(req,res) {
        if (typeof req.query.error === undefined || req.query.error === null) {
            req.query.error = false;
        }
        if (req.user) {
            var proposedNick = req.user.username || req.user.displayName ||
            (req.user.emails && req.user.emails[0] && req.user.emails[0].value && req.user.emails[0].value.split("@") || req.user.emails[0].value.split("@")[0] );
            if (proposedNick){
               proposedNick = proposedNick.trim().replace(" ", "").replace(":","").toLowerCase().replace(/\W/g, '');
            } else {
               proposedNick="Set your preferred nickname";
            }
            res.render("signup", {user:req.user, proposedNick:proposedNick, _csrf:req.session._csrf, error:req.query.error});
        }
    });
   
    // present certificates to an external party.
    app.all('/certificates/:nickname', function (req, res) {
        //return a JSON object containing all the certificates.
        req.assert('nickname', 'Invalid nickname').notEmpty().len(2,50).isAlphanumeric();
        req.params.nickname = decodeURIComponent(req.params.nickname);
        if (!routeutil.isValid(req,res)) return;
        pzhadaptor.fromWebUnauth(req.params.nickname, {type:"getCertificates"}, res);
    });
        
    /* END 'GET' ROUTES */
/*
//  TODO: This is not working yet at the PZH TLS server
    app.post('/register-service', ensureAuthenticated, ensureHasPzh, function (req, res) {
        // PZH  / PZP address
        
        pzhadaptor.fromWeb(req.user, 'registerService', {} , function(services) {
          res.render('main-services', { user:routeutil.getUserPath(req.user), profile:req.user, services:services.message, _csrf:req.session._csrf });        
        });
    });     
*/
    app.post('/unregister-service', routeutil.ensureAuthenticated, routeutil.ensureHasPzh, function (req, res) {
        //TODO: Check the service address is valid?
        req.assert('serviceAddress', 'No service address selected').notEmpty().len(6,100);
        req.assert('id', 'No ID for the service').notEmpty().len(5,50);
        req.assert('api', 'No API for the service').notEmpty().len(5,50);        
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
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
    app.post('/revokePzp', routeutil.ensureHasPzh, function(req,res) {
        req.assert('pzp', 'Invalid PZP').notEmpty();
        if (!routeutil.isValid(req,res)) return;        
        if (!routeutil.checkCSRF(req,res)) return;
        pzhadaptor.fromWeb(req.user, "getZoneStatus", {}, function(payload) {
            if (!payload || !payload.message.pzps) {
                return routeutil.doError(res,'Failed to retrieve device information');
            }
            var foundPzp = findPzpFromUrl(req.body.pzp, payload.message.pzps);
            if (foundPzp === null) {
                return routeutil.doError(res, 'Failed to find requested device');
            } else {
              pzhadaptor.fromWeb(req.user, "revokePzp", { "pzpid" : foundPzp }, function(result) {
                res.redirect('/revokePzp'); 
              });
            }
        });
    });
    
    // Arbitrary query interface.
    app.post('/query', routeutil.ensureHasPzh, function (req, res) {
        req.assert('command', 'must have a command').notEmpty().len(3,50);
        // may have a payload and CSRF flag
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
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

    app.post('/setPhotoURL', routeutil.ensureHasPzh, function (req, res) {
        console.log("SET PHOTO URL >> ",req.body)
        req.assert('photoURL', 'Should not be empty').notEmpty();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        var dataSend = {
            message: req.body.photoURL
        };
        pzhadaptor.fromWeb(req.user, "setPhotoURL", dataSend, function(){
            req.user.photoUrl = req.body.photoURL;
            res.redirect('/');
        });
    });
    app.post('/pzpEnroll', routeutil.ensureHasPzh, function (req, res) {
        req.assert('from', 'Invalid from field').notEmpty();
        req.assert('csr', 'Invalid csr').notEmpty();
        if (!routeutil.isValid(req,res)) return;
        if (!routeutil.checkCSRF(req,res)) return;
        
        var dataSend = {
            from:req.body.from,
            csr:req.body.csr,
            friendlyName: req.body.friendlyName,
            deviceType: req.body.deviceType
        }

        pzhadaptor.fromWeb(req.user, "csrFromPzp", dataSend, res);
    });

    app.post('/createPzh', routeutil.ensureAuthenticated, function(req,res) {
        req.assert('nickname', 'No nickname chosen').notEmpty().len(2,50).isAlphanumeric().notContains(" ").notContains(":");
        if (!routeutil.isValid(req,res)) {
            res.redirect('/signup?error=true&nickname=' + encodeURIComponent(req.body.nickname));;
            return;
        }
        if (!routeutil.checkCSRF(req,res)) return;
        pzhadaptor.addPzh(req.user, req.body.nickname, function(msg) {
          if (msg.message === 'undefined' || msg.message === null || msg.message.id == 'undefined' || msg.message.id === null) {
              // this nickname was taken.  Go back a step.
              res.redirect('/signup?error=true&nickname=' + encodeURIComponent(req.body.nickname));
          } else {
              //Assume successful PZH addition.
              req.user.hasPzh = true;
              req.user.nickname = msg.message.nickname;
              req.user.photoUrl = msg.message.photoUrl;
              res.redirect('/');
          }
        });
    });
};