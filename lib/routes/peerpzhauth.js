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
module.exports = function (app, address, port, authConfig) {
    var logger = require("webinos-utilities").webinosLogging(__filename) || console,
        pzhAdaptor = require('../pzhadaptor.js'),
        util = require("util"),
        helper = require('./helper.js');

    
   // This is the landing page for external users
   // They get redirected to authenticate, then land up here again
   // There should be plenty of data in the session about them, including:
   // req.session.externalCertUrl
   // req.session.externalPZHUrl
   // req.session.externalUserId
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

    function makeConnectionRequest(req,res) {   
        var nickname = req.session.nickname;
        logger.log("Successfully authenticated external user: " + req.user.emails[0].value +
                      " who wants to connect to " + nickname + 
                      " and who claims to have nickname: " + req.session.externalNickname + " and Cert URL: " + req.session.externalCertUrl +
                      " and PZH URL: " + req.session.externalPZHUrl);

        // we don't know the external nickname for sure, but we're willing to believe
        // what we're told at this stage...
        req.user.nickname = req.session.externalNickname;
        
        // Now, we need to get the certs of this external user
        helper.getCertsFromHostByUrl(req.session.externalCertUrl, function(certs) {
            var pzhData = {
                pzhCerts         : certs.message,
                externalCertUrl  : req.session.externalCertUrl,
                externalPZHUrl   : req.session.externalPZHUrl,
                externalNickname : req.session.externalNickname
            };
            pzhAdaptor.requestAddFriend(req.user, nickname, pzhData, function (status) {
                if (status.message) {
                    res.render("external-request-success",
                        { "externaluser" : req.user, 
                          "user" : nickname,
                          "externalPzhUrl" : req.session.externalPZHUrl
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
     * Expected query:
     * ?certUrl=...&pzhInfo?...&ownUserId?foo...
     * 
     */
    function recordVarsInSession(req, res) {
        if (!req.hasOwnProperty("query")) return false;
        if ((typeof req.query.certUrl !== 'undefined') &&
              (typeof req.query.pzhInfo !== 'undefined') &&
              (typeof req.query.ownUserId !== 'undefined') &&
              (typeof req.query.nickname !== 'undefined')) {
            req.session.externalCertUrl = req.query.certUrl;
            req.session.externalPZHUrl = req.query.pzhInfo;
            req.session.externalNickname = req.query.ownUserId;
            req.session.nickname = req.query.nickname;            
            return true;
        } else {
            return req.session.hasOwnProperty("externalCertUrl") && 
              req.session.hasOwnProperty("externalPZHUrl") && 
              req.session.hasOwnProperty("externalNickname") && 
              req.session.hasOwnProperty("nickname");
        }
    }

    // This is where we redirect if they are not authenticated.
    function redirectToLogin(req, res) {
        req.session.isExternal = true;          
        res.render('login', { auth:authConfig, "isPzp" : false, "isExternal" : true, "nickname":req.params.nickname});
    }
};
