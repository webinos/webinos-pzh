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
        "setPhotoURL"           :setPhotoURL,
// Logging
        "getCrashLog"           :getCrashLog,
        "getInfoLog"            :getInfoLog,
// Revoke PZP
        "getPzps"               :getPZPs,
        "revokePzp"             :revokePzp,
//Enrollment
        "csrFromPzp"            :csrFromPzp,
// Service handling
        "listAllServices"       :listAllServices,
        "listUnregServices"     :listUnRegisterServices,
        "registerService"       :registerService,
        "unregisterService"     :unregisterService,
// Functionality of managing PZH
        "addPzh"                :addPzh,
        "removePzh"             :removePzh,
        "checkPzh"              :checkPzh,
// Managing invitation tokens
        "checkToken"            :checkToken,
        "deleteToken"           :deleteToken,
        "registerToken"         :registerToken,
// Certificate exchange
        "getAllPzh"             :getAllPzh,
        "getCertificates"       :getCertificates,
        "storeExternalCert"     :storeExternalCert,
        "requestAddFriend"      :requestAddFriend,
        "requestAddLocalFriend" :requestAddLocalFriend,
        "getRequestingExternalUser":getRequestingExternalUser,
        "rejectFriend"          :rejectFriend,
        "approveFriend"         :approveFriend
    };

    /**
     * Sends message to the PZH WebServer.
     * @param {object}user - User login details
     * @param {object}msg  - message to respond back to the PZH WebServer
     */
    function sendMsg (conn, user, msg) {
        var jsonString = JSON.stringify ({"user":user, "payload":msg});
        logger.log("TLS Server sending:\n" + jsonString);
        var buf = wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
        conn.write (buf);
    }

    // User Details
    function getUserDetails (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"getUserDetails", message: userObj.getUserDetails()});
    }
    // Current connection information
    function getZoneStatus (conn, obj, userObj) {
        var result = {pzps:[], pzhs:[]};
        var pzpList = userObj.getTrustedList("pzp");
        var pzhList = userObj.getTrustedList("pzh");
        Object.keys(pzpList).forEach(function(name){
            result.pzps.push ({id: userObj.getFriendlyName(name), url:name, isConnected:(userObj.checkConnectedPzp(name)||userObj.checkConnectedDevices(name))});
        });
        Object.keys(pzhList).forEach(function(name){
            if (name === userObj.getSessionId()) {
                result.pzhs.push ({id:userObj.getFriendlyName()+" (Your Pzh)", url:userObj.getSessionId(), isConnected:true});
            } else {
                result.pzhs.push ({id: userObj.getFriendlyName(name), url:name, isConnected:userObj.checkConnectedPzh(name)});
            }
        });
        sendMsg (conn, obj.user, { type:"getZoneStatus", message:result });
    }
    //
    function setPhotoURL(conn, obj, userObj) {
        userObj.setPhotoURL(obj.message.message);
        sendMsg (conn, obj.user,{ type:"setPhotoURL", message:true });
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
            logger.log("Printing PZP info for: " + name);
            result.signedCert.push({id: userObj.getFriendlyName(name), url:name, isConnected:userObj.checkConnectedPzp(name)});
        });
        userObj.getRevokedCert().forEach(function(name) {
            logger.log("Printing Revoked PZP info for: " + name);
            result.revokedCert.push({id:name, url:name, isConnected:false});
        });
        sendMsg (conn, obj.user, { type:"getPzps", message:result });
    }
    function revokePzp (conn, obj, userObj) {
        var result = userObj.revokeCert(obj.message.pzpid.url, pzhFunctions.refreshPzh);
        sendMsg (conn, obj.user, { type:"revokePzp", message:result });
    }
    // Enroll Pzp
    function csrFromPzp (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"csrFromPzp", message:userObj.addNewPZPCert(obj, pzhFunctions.refreshPzh) });
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
    function getAllPzh (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"getAllPzh", message:pzhFunctions.getAllPzh(userObj.getSessionId(), userObj) });
    }


    // add an external certificate to this pzh
    function addExternalCertificate(pzh, extName, extHost, extPort, extCerts, extCrl, photoUrl) {
        var extPzh = {
            id   : extName,
            host : extHost, 
            port : extPort,
            externalCerts : extCerts,
            externalCrl : extCrl,
            photoUrl  : photoUrl
        };
        logger.log("Adding external certificate to " + pzh.getFriendlyName() +"'s zone: " + util.inspect(extPzh));
        pzh.setExternalCertificate(extName, extPzh);

        pzh.notificationManager.addNotification(pzh.notificationManager.notifyType.trustedZone, { zone: extName });
    }

    function addUntrustedExternal(pzh, extName, extHost, extPort, extCerts, extCrl, extNickname, extEmail, extDisplayName, extFrom, extIdentifier, photoUrl) {
        var extPzh = {
            id           :extName,
            host         :extHost,
            port         :extPort,
            externalCerts:extCerts,
            externalCrl  :extCrl,
            displayName  :extDisplayName,
            from         :extFrom,
            identifier   :extIdentifier,
            email        :extEmail,
            nickname     :extNickname,
            photoUrl     :photoUrl
        };
        logger.log("Adding unauthorised PZH certificates details to " + pzh.getFriendlyName() +"'s zone: " + JSON.stringify(extPzh));
        pzh.setUntrustedList(extName, extPzh);

        pzh.notificationManager.addNotification(pzh.notificationManager.notifyType.untrustedZone, { zone: extName });
    }

    // First step in connect friend
    // The PZH we are trying to connect calls this to sends its certificate to connecting PZH
    function getCertificates (conn, obj, userObj) {
        var userDetails=userObj.getUserDetails();
        var result = {
            "provider"  :"provider-cert-data",
            "server"    :userObj.getMasterCertificate(),
            "crl"       :userObj.getCRL(),
            "serverPort":userObj.getWebinosPorts("provider"),
            "webAddress":userObj.getWebServerAddress(),
            "displayName":userDetails.friendlyName,
            "photoUrl"  :userDetails.photoUrl,
            "email"     :userDetails.email
        };
        //TODO: Re-enable CRL checks.
        sendMsg( conn, obj.user, { type:"getCertificates", message:result });
    }
    // Second step
    // Connecting PZH stores certificates retrieved from another PZH
    function storeExternalCert (conn, obj, userObj) {
        var url = require ("url").parse (obj.message.externalPzh);
        var name = pzhNicknameToUserId( url.auth, url.hostname, url.port);
        logger.log (obj.user.displayName + " is now expecting external connection from " + name);

        if (userObj.checkExternalCertificate(name) && userObj.checkTrustedList(name)) {
            sendMsg (conn, obj.user, { type:"storeExternalCert", message:false }); // PZH ALREADY ENROLLED
        } else {
            if (!userObj.checkExternalCertificate(name)) {
                var extCert = obj.message.externalCerts;
                addExternalCertificate(userObj, name, url.hostname, extCert.serverPort,
                    extCert.server, extCert.crl,
                    extCert.photoUrl);

                userObj.setPzhTrustedList(name, extCert.displayName, extCert.email, null, url.auth, null, extCert.photoUrl); // we don't have a friendly name.
                sendMsg( conn, obj.user, { type:"storeExternalCert", message:true });

                var pzhList = userObj.getTrustedList("pzh")[userObj.getSessionId()];
                var id = pzhNicknameToUserId(pzhList.nickname, hostname, serverPort);
                pzhFunctions.refreshPzh (id,  userObj.setConnParam());
                if (obj.message.connectImmediately) {
                    userObj.connectOtherPZH (name, userObj.setConnParam());
                }
           } 

        }
        // After this step OpenId authentication is triggered
    }
    // Third step
    // The PZH we are trying to connect calls this presumably this should return something unique
    function requestAddFriend (conn, obj, userObj) {
        var externalUrl  = require ("url").parse (obj.message.externalPzh.pzhAddress);
        var externalUser = obj.message.externalUser;
        var externalId   = pzhNicknameToUserId( externalUrl.auth,  externalUrl.hostname, externalUrl.port);
        //TODO: What if a malformed userId is given?
        addUntrustedExternal(userObj, externalId, externalUrl.hostname, obj.message.externalPzh.pzhCerts.serverPort, 
                            obj.message.externalPzh.pzhCerts.server, obj.message.externalPzh.pzhCerts.crl, externalUser.nickname, 
                            externalUser.emails[0].value, externalUser.displayName, externalUser.from, externalUser.identifier,
                            externalUser.photoUrl );
        sendMsg (conn, obj.user, { type:"requestAddFriend", message:true });
    }
    // Fourth Step
    // Connecting Pzh calls this to
    function getRequestingExternalUser (conn, obj, userObj) {
        var list = [];
        userObj.getUntrustedList().forEach(function(name){
            var external = userObj.getUntrustedList(name);
            list.push ({"id":name, "host":external.host, "email": external.email, "from": external.from,
                "displayName" : external.displayName, photoUrl: external.photoUrl});
        });
        sendMsg (conn, obj.user, { type:"getRequestingExternalUser", message:list });
    }
    // Sixth
    function approveFriend (conn, obj, userObj) {
        if (userObj.checkUntrustedList(obj.message.externalUserId)) {
            logger.log ("Approving friend request for " + obj.message.externalUserId + " by " + obj.user.emails[0].value);
            // Store Certificates
            var details = userObj.getUntrustedList(obj.message.externalUserId), name = obj.message.externalUserId;
            userObj.setPzhTrustedList(name, details.displayName, details.email, details.from, details.nickname, details.identifier,details.photoUrl);

            if (!userObj.checkExternalCertificate(name)) {
                addExternalCertificate(userObj, name, details.host, details.port, details.externalCerts, details.externalCrl);
                var pzhList = userObj.getTrustedList("pzh")[userObj.getSessionId()];
                var id = pzhNicknameToUserId(pzhList.nickname, hostname, serverPort);
                var certificateParam = userObj.setConnParam();
                pzhFunctions.refreshPzh (id, certificateParam);
                userObj.connectOtherPZH (name, certificateParam, function(connectedOK) {
                  if (connectedOK) {
                    userObj.sendMessage(userObj.prepMsg(name, "zoneConnectionAccepted", { zone: userObj.getSessionId() }) , name);
                  }
                });
            }
            userObj.removeUntrustedList(obj.message.externalUserId);
            sendMsg (conn, obj.user, { type:"approveFriend", message:true });
        } else {
            sendMsg (conn, obj.user, { type:"approveFriend", message:false });
        }

    }
    // Sixth
    function rejectFriend (conn, obj, userObj) {
        if (userObj.checkUntrustedList(obj.message.externalUserId)) {
            logger.log ("Rejecting friend request by " + obj.message.externalUserId + " for " + obj.user);
            userObj.removeUntrustedList(obj.message.externalUserId);
        }
    }
    /* In this alternative flow, we're adding an external user at the same
     * PZH provider as the current user, so it should be quick and easy.  Just
     * add each PZH's details to the trusted (for the current PZH) and untrusted
     * (for the local friend's PZH) lists.
     */
    function requestAddLocalFriend (conn, obj, userObj) {
        var friendpzh;
        if ((friendpzh = findExistingUserFromNickname(obj.message.externalNickname))) {
            // add the 'friend' to the current user's list of known people.
            var userDetails = userObj.getUserDetails();
            addExternalCertificate(userObj, friendpzh.getSessionId(), hostname, serverPort, friendpzh.getMasterCertificate(), friendpzh.getCRL(), userDetails.photoUrl);


            //update the actual list.
            var friendUserDetails = friendpzh.getUserDetails();
            userObj.setPzhTrustedList(friendpzh.getSessionId(), friendpzh.getFriendlyName(),
                friendUserDetails.email, friendUserDetails.authenticator, friendUserDetails.nickname,
                friendUserDetails.identifier, friendUserDetails.photoUrl);
            var id = pzhNicknameToUserId(userDetails.nickname, hostname, serverPort);
            pzhFunctions.refreshPzh (id, userObj.setConnParam()); // Refresh Certificate details in the SNI Context of the farm

            // add the current user to the friend's list of untrusted people.
            // the friend will later approve or reject the request.
            addUntrustedExternal(friendpzh, userObj.getSessionId(), hostname, serverPort, userObj.getMasterCertificate(), 
                userObj.getCRL(), userDetails.nickname, userDetails.email, userDetails.friendlyName,
                userDetails.authenticator, userDetails.identifier, userDetails.photoUrl);

            sendMsg(conn, obj.user, { type:"requestAddLocalFriend", message:true });
        } else {
            sendMsg(conn, obj.user, { type:"requestAddLocalFriend", message:false });
        }
    }

    function registerToken(conn, obj, userObj) {
        var crypto = require('crypto');
        var userDetails = userObj.getUserDetails();
        var token = {
            "nickname" : userDetails.nickname,
            "identifier" :  userDetails.identifier,
            "linkId" : (crypto.randomBytes(100).toString("Base64")),
            "expiryDate" : new Date( + new Date + 12096e5),
            "external" : obj.message.externalDetails
        }
        userObj.addInvitationToken(token);
        sendMsg(conn, obj.user, { type:"registerToken", message:token.linkId});
    }

    function checkToken(conn, obj, userObj) {
        if (userObj.checkInvitationToken(obj.message.token)) {
            var validToken = userObj.getInvitationToken(obj.message.token);
            sendMsg(conn, obj.user, { type:"checkToken", message: {result : true, tokenDetails : validToken } } );
        } else {
            logger.log("Invalid token: " + obj.message.token);
            sendMsg(conn, obj.user, { type:"checkToken", message: {result : false} } );
        }
    }

    function deleteToken(conn, obj, userObj) {
        if (userObj.checkInvitationToken(obj.message.token)) {
            userObj.removeInvitationToken(obj.message.token);
            sendMsg(conn, obj.user, { type:"deleteToken", message: {result : true, tokenDetails : obj.message.token } } );
        } else {
            sendMsg(conn, obj.user, { type:"deleteToken", message: {result : false } } );
        }
    }

    function addPzh(conn, obj, userObj) {
        logger.log("Request add PZH: \n" + util.inspect(obj) + "\nFrom user: \n" + util.inspect(obj.user));
        var nickname = obj.message.nickname;
        var id = createPzh(obj.user, obj, nickname);
        sendMsg(conn, obj.user, { "type": "addPzh", "message": { "id" : id , "nickname" : nickname, photoUrl: obj.user.photoUrl }});
    }

    function removePzh(conn, obj, userObj) {
        userObj.removePzh(obj.message.id, pzhFunctions.refreshPzh, function(status){
            sendMsg(conn, obj.user, { type:"removePzh", message:status });
        });
    }

    function checkPzh(conn, obj) {
        var id = obj.user.identifier;

        // TODO: Check that the ID is asserted from the same provider.
        // Potential vulnerability - if arbitrary OpenID providers are allowed, one could
        // assert that I was any ID, and then I'd be able to claim his
        // PZH.
        var user = findExistingUserFromId(id);
        var result = (user !== null);
        var userConfig = null;
        if (result) {
            userConfig = user && user.getTrustedList("pzh")[user.getSessionId()];
        }
        sendMsg(conn, obj.user, {
            "type"   : "checkPzh",
            "message": {
                "result": result,
                "user" : userConfig
            }
        });
    }
    /**
     *
     * @param obj
     * @param userId
     */
    function createPzh (userObj, obj, userId) {
        logger.log("Creating a user account for " + util.inspect( userId ) );
        if (typeof userId == 'undefined' || userId === null) {
          logger.log( "No userID found" );
          return null;
        }
        try {
            var pzh_session = require ("./pzh_tlsSessionHandling.js");
            var details, pzhId = pzhNicknameToUserId(userId, hostname, serverPort);
            if (pzhs[pzhId]) {
                logger.log( "Already had an ID, not creating a new PZH" );
                return null;
            } else {
                logger.log ("adding new zone hub - " + pzhId);
                pzhs[pzhId] = new pzh_session (hostname);
                obj.user.nickname = userId; // set the nickname field appropriately.
                //TODO: All providers should be possible to provide user photo. We should
                // check here the the selected authentication strategy and retrieve user image accordingly.
                if (!obj.user.hasOwnProperty("photoUrl")) // Facebook does provide that, don't replace it
                    obj.user.photoUrl = "images/userPlaceholder.png";
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
     * Return the pzh of the given user ID, unless that ID does not exist, in
     * which case return null.
     */
    function findExistingUserFromId(id) {
        for (var p in pzhs) {
            if (pzhs.hasOwnProperty(p)) {
                var userDetails = pzhs[p].getUserDetails();
                if (userDetails && userDetails.identifier === id) {
                    return pzhs[p];
                }
            }
        }
        return null;
    }

    /**
     *
     * @param nickname
     * @return {*}
     */
    function findExistingUserFromNickname(nickname) {
        for (var p in pzhs) {
            if (pzhs.hasOwnProperty (p)) {
                var userDetails = pzhs[p].getUserDetails();
                if (userDetails.nickname === nickname) {
                    return pzhs[p];
                }
            }
        }
        return null;
    }

    function pzhNicknameToUserId(nickname, host, port) {
        var res = nickname + "@" + host;
       /* if (typeof port !== 'undefined' && port !== null && port !== 443 && port !== "443") {
            res += ":" + port;
        }*/
        return res;
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
        logger.log("TLS Server receiving: \n" + JSON.stringify(message));
        if (validateMessage (message)) {
            if( message.message === "WEB SERVER INIT") {
                // Do nothing
            } else {
                if (message.message.type === "checkPzh" || message.message.type === "addPzh") {
                    // No PZH details needed
                    messageType[message.message.type].apply (this, [conn, message]);
                    return;
                } 
                // we'll search for the user based on their nickname or their identifier, we don't care (should we?)
                // TODO: Refactor to make this more sensible.  
                // Sometimes we don't have an authenticated user, we're only acting on their behalf, so Id doesn't work.
                var userObj = findExistingUserFromId (message.user.identifier);
                if (userObj === null) {
                    userObj = findExistingUserFromNickname(message.user.nickname);
                }
                if (userObj) {
                    messageType[message.message.type].apply(userObj, [conn, message, userObj]);
                } else {
                    logger.error ("error validating user");
                    sendMsg( conn, message.user, {type:"error", "message":"User " + JSON.stringify(message.user) + " didn't validate"});
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
            var id = conn.id;
            if (!id) {
                id = conn.address().address; // TODO good enough fallback?
                logger.log('missing connection id property, using address fallback: ' + id);
            }
            wUtil.webinosMsgProcessing.readJson (id, data, function (message) {
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
