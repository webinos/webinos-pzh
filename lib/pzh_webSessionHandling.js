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
 * Author: Habib Virji (habib.virji@gmail.com)
 *******************************************************************************/
 
// The arguments are: a set of PZHs, the hostname of the PZH, the PZH Web Server
// port, the PZH TLS server port, then an object containing functions for 
// adding, refreshing and retrieving PZH details.
var pzhWI = function (conn, pzhs, hostname, port, serverPort, pzhFunctions) { 
    "use strict";
    var wUtil = require("webinos-utilities");
    var util = require("util");
    var logger = wUtil.webinosLogging (__filename) || console;

    var messageType = {
// Connection and user details
        "getUserDetails"        :getUserDetails,
        "getZoneStatus"         :getZoneStatus,
// Logging
        "getCrashLog"           :getCrashLog,
        "getInfoLog"            :getInfoLog,
// Revoke PZP
        "getPzps"               :getPZPs,
        "revokePzp"             :revokePzp,
//Enrollment
        "csrAuthCodeByPzp"      :csrAuthCodeByPzp,
// Service handling
        "listAllServices"       :listAllServices,
        "listUnregServices"     :listUnRegisterServices,
        "registerService"       :registerService,
        "unregisterService"     :unregisterService,
// Functionality of managing PZH
        "addPzh"                :addPzh,
        "removePzh"             :removePzh,
        "checkPzh"              :checkPzh,
// Certificate exchange
        "getAllPzh"             :getAllPzhList,
        "getCertificates"       :getCertificates,
        "storeExternalCert"     :storeExternalCert,
        "requestAddFriend"      :requestAddFriend,
        "requestAddLocalFriend" :requestAddLocalFriend,
        "getExpectedExternal"   :getExpectedExternal,
        "approveFriend"         :approveFriend,
        "rejectFriend"          :rejectFriend,
        "approveUser"           :approveUser
    };

    /**
     * Sends message to the PZH WebServer.
     * @param {object}user - User login details
     * @param {object}msg  - message to respond back to the PZH WebServer
     */
    function sendMsg (conn, user, msg) {
        var jsonString = JSON.stringify ({user:user, payload:msg});
        logger.log("Response " + jsonString);
        var buf = wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
        conn.write (buf);
    }
    /**
     * @requires webinos-api-notification - for sending notifications internally
     * @param pzh
     * @param notification
     * @param idcallback
     * @param resultcallback
     */
    function notifyUser(pzh, notification, idcallback, resultcallback) {
        if (require.resolve("webinos-api-notifications")) {
            logger.log("NotifyUser method with pzh id: " + pzh);
            var path = require("path");
            var Notifications = require(path.join(require.resolve("webinos-api-notifications"), "../", "notificationPzh.js"));
            Notifications.sendFromInternal(pzh, notification, idcallback, resultcallback);
        }
    }
    // User Details
    function getUserDetails (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"getUserDetails", message:userObj.getUserData() });
    }
    // Current connection information
    function getZoneStatus (conn, obj, userObj) {
        var result = {pzps:[], pzhs:[]};
        userObj.getTrustedList("pzp").forEach(function(name){
            result.pzps.push ({id: userObj.getFriendlyName(name), url:name, isConnected:userObj.checkConnectedPzp(name)});
        });
        userObj.getTrustedList("pzh").forEach(function(name){
            result.pzhs.push ({id: userObj.getFriendlyName(name), url:name, isConnected:userObj.checkConnectedPzh(name)});
        });
        result.pzhs.push ({id:userObj.getFriendlyName()+" (Your Pzh)", url:userObj.getSessionId(), isConnected:true});
        sendMsg (conn, obj.user, { type:"getZoneStatus", message:result });
    }
    // Logging
    function getCrashLog (conn, obj, userObj) {
        logger.fetchLog ("error", "Pzh", userObj.getFriendlyName(), function (data) {
            sendMsg (conn, obj.user, { type:"getCrashLog", message:data });
        });
    }
    function getInfoLog (conn, obj, userObj) {
        logger.fetchLog ("info", "Pzh", userObj.getFriendlyName(), function (data) {
            sendMsg (conn, obj.user, { type:"getInfoLog", message:data });
        });
    }
    // Revoke PZP
    function getPZPs (conn, obj, userObj) {
        var result = {signedCert:[], revokedCert:[]};
        userObj.getSignedCert().forEach(function(name){
            result.signedCert.push({id: userObj.getFriendlyName(name), url:name, isConnected:userObj.checkConnectedPzp(name)});
        });
        userObj.getRevokedCert().forEach(function(name) {
            result.revokedCert.push({id:userObj.getFriendlyName(name), url:name, isConnected:false});
        });
        sendMsg (conn, obj.user, { type:"getPzps", message:result });
    }
    function revokePzp (conn, obj, userObj) {
        var result = userObj.revokeCert(obj.message.pzpid, pzhFunctions.refreshPzh);
        sendMsg (conn, obj.user, { type:"revokePzp", message:result });
    }
    // Enroll Pzp
    function csrAuthCodeByPzp (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"csrAuthCodeByPzp", message:userObj.addNewPZPCert(obj, pzhFunctions.refreshPzh) });
    }
    // Service information
    function getServices(userObj) {
        var result = { pzEntityList:[] } ;
        result.pzEntityList.push({pzId:userObj.getSessionId()});
        userObj.getConnectedPzp().forEach(function(name){
            result.pzEntityList.push ({pzId:name});
        });
        result.services = userObj.discovery.getAllServices ();
        return result;
    }
    function listAllServices (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"listAllServices", message:getServices(userObj) });
    }
    function listUnRegisterServices(conn, obj, userObj) {
        if (userObj.getSessionId() !== obj.message.at) { // Different PZH
            var id = userObj.addMsgListener(function (modules) {
                sendMsg (conn, obj.user, { type:"listUnregServices",message:{"pzEntityId":obj.message.at, "modules":modules.services} });
            });
            var msg = userObj.prepMsg (obj.message.at, "listUnregServices", {listenerId:id});
            userObj.sendMessage (msg, obj.message.at);
        } else { // returns all the current serviceCache
            sendMsg (conn, obj.user, { type:"listUnregServices",message:{"pzEntityId":userObj.getSessionId(), "modules": userObj.getServiceCache()} }); // send default services...
        }
    }
    function registerService (conn, obj, userObj) {
        if (userObj.getSessionId() !== obj.message.at) {
            var msg = userObj.prepMsg(obj.message.at, "registerService", {name:obj.message.name, params:{}});
            userObj.sendMessage (msg, obj.message.at);
        } else if (!userObj.checkServiceCache(obj.message.name)){
           userObj.loadModule(obj.message);
        }
        sendMsg (conn, obj.user, { type:"registerService", message: getServices(userObj) });
    }
    function unregisterService (conn, obj, userObj) {
        if (userObj.getSessionId() !== obj.message.at) {
            var msg = userObj.prepMsg(obj.message.at, "unregisterService", {svId:obj.message.svId, svAPI:obj.message.svAPI})
            userObj.sendMessage (msg, obj.message.at);
        } else {
           userObj.unregisterService(obj.message.svId, obj.message.svAPI);
        }
        sendMsg (conn, obj.user, { type:"unregisterService", message:getServices(userObj) });
    }
    // Pzh-Pzh certificate exchange
    function getAllPzhList (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"getAllPzh", message:pzhFunctions.getAllPzh(userObj.getSessionId(), userObj) });
    }
    // First step in connect friend
    // The PZH we are trying to connect calls this to sends its certificate to connecting PZH
    function getCertificates (conn, obj, userObj) {
        var result = {
            "provider"  :"provider-cert-data",
            "server"    :userObj.getMasterCertificate(),
            "crl"       :userObj.getCRL(),
            "serverPort":userObj.getWebinosPorts("provider")
        };
        //TODO: Re-enable CRL checks.
        sendMsg( conn, obj.user, { type:"getCertificates", message:result });
    }
    // Second step
    // Connecting PZH stores certificates retrieved from another PZH
    function storeExternalCert (conn, obj, userObj) {
        logger.log (obj.user.displayName + " is now expecting external connection from " + obj.message.externalEmail);
        var url = require ("url").parse ("https://" + obj.message.externalPzh);
        var name = url.hostname + "_" + obj.message.externalEmail;
        if (url.port && parseInt (url.port) !== 443) {
            name = url.hostname + ":" + url.port + "_" + obj.message.externalEmail;
        }

        if (userObj.checkExternalCertificate(name) && userObj.checkTrustedList(name)) {
            sendMsg (conn, obj.user, { type:"storeExternalCert", message:false }); // PZH ALREADY ENROLLED
        } else {
            if (!userObj.checkExternalCertificate(name)) {
                var config = {
                    url          :"https://" + obj.message.externalPzh + "/main/" + obj.message.externalEmail + "/",
                    host         :url.hostname,
                    port         :url.port ? url.port : 443,
                    externalCerts:obj.message.externalCerts.server,
                    externalCrl  :obj.message.externalCerts.crl,
                    serverPort   :obj.message.externalCerts.serverPort
                };
                userObj.setExternalCertificate(name, config);
                var id = hostname + "_" + userObj.getEmailId();
                if (port !== 443) {
                    id = hostname + ":" + port + "_" + userObj.getEmailId();
                }
                pzhFunctions.refreshPzh (id,  userObj.setConnParam());

            }
            userObj.setTrustedList("pzh", name);
            sendMsg( conn, obj.user, { type:"storeExternalCert", message:true });
        }
        // After this step OpenId authentication is triggered
    }
    // Third step
    // The PZH we are trying to connect calls this presumably this should return something unique
    function requestAddFriend (conn, obj, userObj) {
        var externalEmail = obj.message.externalUser.emails[0].value;
        logger.log ("PZH TLS Server is now aware that the user " +
            externalEmail + " with PZH details : " + obj.message.externalPzh.externalPZHUrl +
            " has been authenticated and would like to be added to the list of trusted users to " +
            obj.user + "'s zone");

        // notify the user about it.  This may or may not be successful, it doesn't
        // really matter.  
        var approveURL = "https://" + hostname + "/main/" + 
                encodeURIComponent(userObj.getEmailId()) +
                "/approve-user/" + encodeURIComponent(externalEmail) + "/";
        notifyUser(
            userObj.getSessionId(),
            { "type" : "connection request",
              "url"  : approveURL,
              "user" : { "email" : externalEmail,
                         "displayName" : obj.message.externalUser.displayName
                       }
            },
            function(id) { /* don't care */ },
            function(id) { /* don't care */ }
        );

        var url = require ("url").parse (obj.message.externalPzh.externalPZHUrl);
        var config = {
            host         :url.hostname,
            port         :url.port ? url.port : 443,
            url          :obj.message.externalPzh.externalPZHUrl,
            externalCerts:obj.message.externalPzh.pzhCerts.server,
            externalCrl  :obj.message.externalPzh.pzhCerts.crl,
            serverPort   :obj.message.externalPzh.pzhCerts.serverPort};
        userObj.setUntrustedList(externalEmail, config);
        sendMsg (conn, obj.user, { type:"requestAddFriend", message:true });
    }
    // Fourth Step
    // Connecting Pzh calls this to
    function approveUser (conn, obj, userObj) {
        var list = [];
        userObj.getUntrustedList().forEach(function(name){
            list.push ({name:name, url:userObj.getUntrustedList(name).url});
        });
        sendMsg (conn, obj.user, { type:"approveUser", message:userList () });
    }
    // Fifth
    // The PZH Connecting calls this to get approval from other PZH
    function getExpectedExternal (conn, obj, userObj) {
        logger.log ("Is " + obj.user.emails[0].value + " expecting to be asked to approve access to " +
            obj.message.externalEmail + "? ... Yes");
        if (userObj.checkUntrustedList(obj.message.externalEmail)) {
            sendMsg (conn, obj.user, { type:"getExpectedExternal", message:true });
        } else {
            sendMsg (conn, obj.user, { type:"getExpectedExternal", message:false });
        }
    }
    // Sixth
    function approveFriend (conn, obj, userObj) {
        if (userObj.checkUntrustedList(obj.message.externalEmail)) {
            logger.log ("Approving friend request for " + obj.message.externalEmail + " by " + obj.user.emails[0].value);
            // Store Certificates
            var details = userObj.getUntrustedList(obj.message.externalEmail), name = details.host + "_" + obj.message.externalEmail;
            if (details.port && parseInt (details.port) !== 443) name = details.host + ":" + details.port + "_" + obj.message.externalEmail;
            userObj.setTrustedList(name);
            if (!userObj.checkExternalCertificate(name)) {
                userObj.setExternalCertificate(name, details);
                var id =  (port !== 443) ? (hostname + ":" + port + "_" + userObj.getEmailId()): hostname + "_" + userObj.getEmailId();
                pzhFunctions.refreshPzh (id, userObj.setConnParam());
                userObj.connectOtherPZH (name, userObj.setConnParam());
            }
            userObj.removeUntrustedList(obj.message.externalEmail);
            sendMsg (conn, obj.user, { type:"approveFriend", message:true });
        } else {
            sendMsg (conn, obj.user, { type:"approveFriend", message:false });
        }
    }
    // Sixth
    function rejectFriend (conn, obj, userObj) {
        if (userObj.checkUntrustedList(obj.message.externalEmail)) {
            logger.log ("Rejecting friend request by " + obj.message.externalEmail + " for " + obj.user);
            userObj.removeUntrustedList(obj.message.externalEmail);
        }
    }
    /* In this alternative flow, we're adding an external user at the same
     * PZH provider as the current user, so it should be quick and easy.  Just
     * add each PZH's details to the trusted (for the current PZH) and untrusted
     * (for the local friend's PZH) lists.
     */
    function requestAddLocalFriend (conn, obj, userObj) {
        var friendpzh;
        if ((friendpzh = findExistingUserFromEmail(obj.message.externalEmail))) {
            // add the 'friend' to the current user's list of known people.
            logger.log("Adding " + obj.message.externalEmail + " as an external user to " + userObj.getEmailId() + "'s zone");
            var config = {
                url          :"https://" + hostname + "/main/" + obj.message.externalEmail + "/",
                host         :hostname,
                port         :port,
                externalCerts:friendpzh.getMasterCertificate(),
                externalCrl  :friendpzh.getCRL(),
                serverPort   :serverPort // TODO
            };
            userObj.setExternalCertificate(friendpzh.getSessionId(), config);

            //update the actual list.
            userObj.setTrustedList("pzh", friendpzh.getSessionId(), friendPzh.getFriendlyName());

            var id =(port !== 443) ?(hostname + ":" + port + "_" + userObj.getEmailId()): (hostname + "_" + userObj.getEmailId());

            pzhFunctions.refreshPzh (id, userObj.setConnParam()); // Refresh Certificate details in the SNI Context of the farm

            // notify the user about it.  This may or may not be successful, it doesn't
            // really matter.
            var approveURL = "https://" + hostname + "/main/" +
                    encodeURIComponent(friendpzh.getEmailId()) +
                    "/approve-user/" + encodeURIComponent(userObj.getEmailId()) + "/";

            logger.log("User data:\n" + require('util').inspect(userObj.getUserData()));
            logger.log("Obj data:\n" + require('util').inspect(obj.message));

            notifyUser(
                friendpzh.getSessionId(),
                { "type" : "connection request",
                  "url"  : approveURL,
                  "user" : { "email" : userObj.getEmailId(),
                             "fullname" : userObj.getUserData("fullname"),
                             "nickname" : userObj.getUserData("nickname"),
                             "name" : userObj.getUserData("name"),
                             "image" : userObj.getUserData("image")
                           }
                },
                function(id) { /* don't care */ },
                function(id) { /* don't care */ }
            );

            // add the current user to the friend's list of untrusted people.
            // the friend will later approve or reject the request.
            logger.log("Adding " + userObj.getEmailId() + " as an external user to " + obj.message.externalEmail + "'s zone");
            config = {
                host         :hostname,
                port         :port,
                url          :"https://" + hostname + "/main/" + userObj.getEmailId() + "/",
                externalCerts:userObj.getMasterCertificate(),
                externalCrl  :userObj.getCRL(),
                serverPort   :serverPort // TODO
            };
            friendpzh.setUntrustedList(userObj.getEmailId(), config);
            sendMsg(conn, obj.user, { type:"requestAddLocalFriend", message:true });
        } else {
            sendMsg(conn, obj.user, { type:"requestAddLocalFriend", message:false });
        }
    }
    function addPzh(conn, obj, userObj) {
        var email = obj.user.emails[0].value || obj.user;
        var id = createPzh(obj, email);
        sendMsg(conn, obj.user, { "type": "addPzh", "message":id });
    }
    function removePzh(conn, obj, userObj) {
        userObj.removePzh(obj.message.id, pzhFunctions.refreshPzh, function(status){
            sendMsg(conn, obj.user, { type:"removePzh", message:status });
        });
    }
    function checkPzh(conn, obj) {
        /**
         * Return the pzh of the given user ID, unless that ID does not exist, in
         * which case return null.
         */
        var result;
        for (var p in pzhs) {
            if (pzhs.hasOwnProperty (p)) {
                if (pzhs[p].getUserData("identifier") === obj.user.identifier) {
                    result =  pzhs[p];
                }
            }
        }

        // TODO: Check that the ID is asserted from the same provider.
        // Potential vulnerability - if arbitrary OpenID providers are allowed, one could
        // assert that I was any ID, and then I'd be able to claim his
        // PZH.
        // Fix: Key on userID, not on user email address.  Require user ID not
        // user email
        sendMsg(conn, obj.user, { "type": "checkPzh", "message":result });
    }
    /**
     *
     * @param obj
     * @param userId
     */
    function createPzh (obj, userId) {
        logger.log("Creating a user account for " + util.inspect( userId ) );
        try {
            var pzh_session = require ("./pzh_tlsSessionHandling.js");
            var details, pzhId = hostname + "_" + userId;
            if (port !== 443) {
                pzhId = hostname + ":" + port + "_" + userId;
            }
            if (pzhs[pzhId]) {
                logger.log( "Already had an ID, not creating a new PZH" );
                return null;
            } else {
                logger.log ("adding new zone hub - " + pzhId);
                pzhs[pzhId] = new pzh_session ();
                if((details = pzhs[pzhId].addLoadPzh (userId, pzhId, obj.user))){
                    pzhFunctions.addPzh(details.uri, details.cert);
                    return pzhId;
                } else {
                    logger.log("Strange error adding PZH, it didn't work");
                    return null;
                }
            }
        } catch (err) {
            logger.log("An error occurred adding PZH");
            logger.log (err);
        }
        return null;
    }
    /**
     *
     * @param email
     * @return {*}
     */
    function findExistingUserFromEmail(email) {
        for (var p in pzhs) {
            if (pzhs.hasOwnProperty (p)) {
                if (pzhs[p].getEmailId() === email) {
                    return pzhs[p];
                }
            }
        }
        return null;
    }

    /**
     * Based on user email id finds user object.If user does not exists create a user.
     * @param obj -
     * @return {*}
     */
    function findUserFromEmail (obj) {
        var email = obj.user.emails || obj.user;
        for (var p in pzhs) {
            if (pzhs.hasOwnProperty (p)) {
                if (pzhs[p].getEmailId() === email[0].value) {
                    return pzhs[p];
                }
            }
        }
        return null;
    }

    /**
     * Validates message and responds true /false depending on valid message type
     * @param obj -
     * @return {Boolean}
     */
    function validateMessage (obj) {
        //quick check - TODO: integrate with proper schema checking.
        var valid = obj.hasOwnProperty ("user") && obj.hasOwnProperty ("message") && obj.message !== undefined && obj.message !== null;
        if (!valid) {
            logger.log ("No 'user' or 'message' field in message from web interface");
            return false;
        }
        if (obj.message !== "WEB SERVER INIT") { // Web server init
            valid = obj.message.hasOwnProperty ("type") && obj.message.type !== undefined && obj.message.type !== null &&
                ( messageType.hasOwnProperty (obj.message.type));
            if (!valid) {
                logger.log ("No valid type field in message: " + obj.message.type);
                return false;
            }
        }
        return true;
    }

    /**
     * Process message and check for validity of the message type
     * @param message - message payload
     */
    function processMsg (conn,message) {
        var userObj;
        if (validateMessage (message)) {
            if( message.message === "WEB SERVER INIT") {
                // Do nothing
            } else {
                if (message.message.type !== "checkPzh" && message.message.type !== "addPzh") {
                    if ((userObj = findUserFromEmail (message))){
                        if (userObj) {
                            messageType[message.message.type].apply(userObj, [conn, message, userObj]);
                        } else {
                            logger.error ("error validating user");
                        }
                    } else {
                        sendMsg( conn, message.user, {type:"error", "message":"User didn't validate"});
                    }
                } else {
                    messageType[message.message.type].apply (this, [conn, message]);
                }
            }
        } else {
            sendMsg(conn, message.user, {type:"error", "message":"not valid msg"});
        }
    }

    /**
     * Handles data from the WebServer to TLS Server
     * @param data - buffer of data
     */
    this.handleData = function (conn, data) {
        try {
            conn.pause ();
            wUtil.webinosMsgProcessing.readJson (this, data, function (message) {
                processMsg (conn, message);
            });
        } catch (err) {
            logger.error ("exception in processing received message " + err);
            logger.error(err.stack)
        } finally {
            conn.resume ();
        }
    };
};
module.exports = pzhWI
