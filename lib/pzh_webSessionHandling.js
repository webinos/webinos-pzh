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
    var wUtil = require("webinos-utilities")
    var util = require("util");
    var logger = wUtil.webinosLogging (__filename) || console;
    var lock = true;
    var messageType = {
        "addPzh"                    :addPzh,
        "approveFriend"             :approveFriend,
        "checkPzh"                  :checkPzh,
        "checkToken"                :checkToken,
        "csrFromPzp"                :csrFromPzp,
        "deleteToken"               :deleteToken,
        "getUserDetails"            :getUserDetails,
        "getZoneStatus"             :getZoneStatus,
        "getCrashLog"               :getCrashLog,
        "getInfoLog"                :getInfoLog,
        "getPzps"                   :getPZPs,
        "getAllPzh"                 :getAllPzh,
        "getRequestingExternalUser" :getRequestingExternalUser,
        "getCertificates"           :getCertificates,
        "listAllServices"           :listAllServices,
        "listUnregServices"         :listUnRegisterServices,
        "requestAddFriend"          :requestAddFriend,
        "requestAddLocalFriend"     :requestAddLocalFriend,
        "rejectFriend"              :rejectFriend,
        "registerService"           :registerService,
        "registerToken"             :registerToken,
        "removePzh"                 :removePzh,
        "revokePzp"                 :revokePzp,
        "storeExternalCert"         :storeExternalCert,        
        "unregisterService"         :unregisterService    
    };

    /**
     * A locking code while creating a PZH.. Any request is blocked based on lock variable value
     * @return {Boolean}
     */
    function getLock () {
        return lock;
    }

    function setLock () {
        lock = false;
    }

    function releaseLock () {
        lock = true;
    }

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

    // HELPER FUNCTIONS
    /**
     * Based on PZH instance fetches the connected pzp details
     * @param _instance of the PZH
     * @return {Array} with connected PZP details
     */
    function getConnectedPzp (_instance) {
        var i, pzps = [], isConnected, id;
        if(_instance.config.trustedList.pzp) {
            var list = Object.keys(_instance.config.trustedList.pzp);
            for (i = 0; i < list.length; i = i + 1) {
                isConnected = !!(_instance.pzh_state.connectedPzp.hasOwnProperty (list[i]));
                id = (_instance.pzh_state.connectedPzp[list[i]] && _instance.pzh_state.connectedPzp[list[i]].friendlyName) || list[i];
                pzps.push ({id: id, url:list[i], isConnected:isConnected});
            }
        }
        for (i in _instance.pzh_state.connectedDevicesToOtherPzh.pzp) {
            if (_instance.pzh_state.connectedDevicesToOtherPzh.pzp.hasOwnProperty(i)) {
                pzps.push ({id: _instance.pzh_state.connectedDevicesToOtherPzh.pzp[i] || i,
                url:i, isConnected:true});
            }
        }
        return pzps;
    }

    /**
     * Based on PZH instance fetches the connected pzh details
     * @param _instance of the PZH
     * @return {Array} with connected PZH details
     */
    function getConnectedPzh (_instance) {
        var pzhs = [], i, isConnected, id;
        if(_instance.config.trustedList.pzh) {
            var list = Object.keys (_instance.config.trustedList.pzh);
            for (i = 0; i < list.length; i = i + 1) {
                isConnected = !!(_instance.pzh_state.connectedPzh.hasOwnProperty (list[i]));
                id =  (_instance.pzh_state.connectedPzh[list[i]] && _instance.pzh_state.connectedPzh[list[i]].friendlyName) || list[i];
                pzhs.push ({id: id, url:list[i], isConnected:isConnected});
            }
            for (i in _instance.pzh_state.connectedDevicesToOtherPzh.pzh) {
                if (_instance.pzh_state.connectedDevicesToOtherPzh.pzh.hasOwnProperty(i)) {
                    pzhs.push ({id: _instance.pzh_state.connectedDevicesToOtherPzh.pzh[i]|| i,
                        url:i, isConnected:true});
                }
            }
        }
        pzhs.push ({id:_instance.config.metaData.friendlyName+" (Your Pzh)", url:_instance.config.metaData.serverName, isConnected:true});
        return pzhs;
    }

    /**
     * List of revoked certificates at the PZH
     * @param _instance - PZH instance
     * @return {Array} - list of all revoked certificates
     */
    function getRevokedCert (_instance) {
        var revokedCert = [], myKey;
        for (myKey in _instance.config.cert.internal.revokedCert) {
            if (_instance.config.cert.internal.revokedCert.hasOwnProperty (myKey)) {
                revokedCert.push ({id:myKey, url:myKey, isConnected:false});
            }
        }
        return revokedCert;
    }

    function getAllPzh (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"getAllPzh", message:pzhFunctions.getAllPzh (userObj.pzh_state.sessionId, userObj) });
    }

    /**
     * Fetch user details
     * @param obj
     * @param userObj
     */
    function getUserDetails (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"getUserDetails", message:userObj.config.userData });
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
          userConfig = user.config.metaData;
        }
        sendMsg(conn, obj.user, { 
          "type"   : "checkPzh", 
          "message": { 
              "result" : result, 
              "user" : userConfig
          } 
        });
    }
    
    /** 
     * Return the pzh of the given user ID, unless that ID does not exist, in
     * which case return null.
     */
    function findExistingUserFromId(id) {
        for (var p in pzhs) {
            if (pzhs.hasOwnProperty (p)) {
                if (pzhs[p].config.userData.identifier === id) {
                    return pzhs[p];
                }
            }
        }
        return null;
    }
    
    function addPzh(conn, obj) {
        logger.log("Request add PZH: \n" + util.inspect(obj) + "\nFrom user: \n" + util.inspect(obj.user));
        var nickname = obj.message.nickname;
        var id = createPzh(obj.user, obj, nickname);
        sendMsg(conn, obj.user, { "type": "addPzh", "message": { "id" : id , "nickname" : nickname }});
    }
    

    /**
     * @requires webinos-api-notificationa - for sending notifications internally
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

    function getZoneStatus (conn, obj, userObj) {
        var result = {pzps:[], pzhs:[]};
        result.pzps = getConnectedPzp (userObj);
        result.pzhs = getConnectedPzh (userObj);
        sendMsg (conn, obj.user, { type:"getZoneStatus", message:result });
    }

    function getCrashLog (conn, obj, userObj) {
        logger.fetchLog ("error", "Pzh", userObj.config.metaData.friendlyName, function (data) {
            sendMsg (conn, obj.user, { type:"getCrashLog", message:data });
        });
    }

    function getInfoLog (conn, obj, userObj) {
        logger.fetchLog ("info", "Pzh", userObj.config.metaData.friendlyName, function (data) {
            sendMsg (conn, obj.user, { type:"getInfoLog", message:data });
        });
    }

    function getPZPs (conn, obj, userObj) {
        var result = {signedCert:[], revokedCert:[]}, myKey;
        result.signedCert = getConnectedPzp (userObj);
        result.revokedCert = getRevokedCert (userObj);
        sendMsg (conn, obj.user, { type:"getPzps", message:result });
    }

    function revokePzp (conn, obj, userObj) {
        userObj.revoke.revokeCert (obj.message.pzpid, pzhFunctions.refreshPzh, function (result) {
            sendMsg (conn, obj.user, { type:"revokePzp", message:result });
        });
    }

    /**
     *
     * @param userObj
     * @return {Object}
     */
    function getServices (userObj) {
        var result = { pzEntityList:[] }, connectedPzp = getConnectedPzp (userObj), key;
        result.pzEntityList.push ({pzId:userObj.pzh_state.sessionId});
        for (key = 0; key < connectedPzp.length; key = key + 1) {
            result.pzEntityList.push ({pzId:connectedPzp[key].url});
        }
        result.services = userObj.pzh_otherManager.discovery.getAllServices ();
        return result;
    }

    function listAllServices (conn, obj, userObj) {
        sendMsg (conn, obj.user, { type:"listAllServices", message:getServices (userObj) });
    }

    /**
     *
     * @param userObj
     * @param msg
     * @param remove
     */
    function updateServiceCache (userObj, msg, remove) {
        var name, url;
        if (remove) {
            url = require ("url").parse (msg.svAPI);
            if (url.slashes) {
                if (url.host === "webinos.org") {
                    name = url.pathname.split ("/")[2];
                } else if (url.host === "www.w3.org") {
                    name = url.pathname.split ("/")[3];
                } else {
                    name = msg.svAPI;
                }
            }
        } else {
            name = msg.name;
        }
        for (var i = 0; i < userObj.config.serviceCache.length; i = i + 1) {
            if (userObj.config.serviceCache[i].name === name) {
                userObj.config.serviceCache.splice (i, 1);
                userObj.config.storeDetails("userData", "serviceCache", userObj.config.serviceCache);
                return;
            }
        }
        if (!remove) {
            userObj.config.serviceCache.splice (i, 0, {"name":name, "params":{} });
            userObj.config.storeDetails("userData", "serviceCache", userObj.config.serviceCache);
        }
    }

    function listUnRegisterServices (conn, obj, userObj) {
        if (userObj.pzh_state.sessionId !== obj.message.at) { // Different PZH
            var id = userObj.pzh_otherManager.addMsgListener (function (modules) {
                sendMsg (conn, obj.user, { type:"listUnregServices",
                    message                    :{"pzEntityId":obj.message.at, "modules":modules.services} });
            });
            var msg = userObj.prepMsg (obj.message.at, "listUnregServices", {listenerId:id});
            userObj.sendMessage (msg, obj.message.at);
        } else { // returns all the current serviceCache
            var data = require ("fs").readFileSync ("./webinos_config.json");
            var c = JSON.parse (data.toString ());
            sendMsg (conn, obj.user, { type:"listUnregServices",
                message:{"pzEntityId":userObj.pzh_state.sessionId, "modules":c.pzhDefaultServices} }); // send default services...
        }
    }

    function registerService (conn, obj, userObj) {
        if (userObj.pzh_state.sessionId !== obj.message.at) {
            var msg = userObj.prepMsg (obj.message.at, "registerService",
                {name:obj.message.name, params:{}});
            userObj.sendMessage (msg, obj.message.at);
        } else {
            util.webinosService.loadServiceModule (
                {"name":obj.message.name, "params":{}},
                userObj.pzh_otherManager.registry,
                userObj.pzh_otherManager.rpcHandler);
            updateServiceCache (userObj, obj.message, false);
        }

        sendMsg (conn, obj.user, { type:"registerService", message:getServices (userObj) });
    }

    function unregisterService (conn, obj, userObj) {
        if (userObj.pzh_state.sessionId !== obj.message.at) {
            var msg = userObj.prepMsg (obj.message.at, "unregisterService",
                {svId:obj.message.svId, svAPI:obj.message.svAPI})
            userObj.sendMessage (msg, obj.message.at);
        } else {
            userObj.pzh_otherManager.registry.unregisterObject ({id:obj.message.svId, api:obj.message.svAPI});
            updateServiceCache (userObj, obj.message, true);
        }
        sendMsg (conn, obj.user, { type:"unregisterService", message:getServices (userObj) });
    }

    // First step in connect friend
    // The PZH we are trying to connect calls this to sends its certificate to connecting PZH
    function getCertificates (conn, obj, userObj) {
        var result = {
            "provider"  :"provider-cert-data",
            "server"    :userObj.config.cert.internal.master.cert,
            "crl"       :userObj.config.cert.crl.value,
            "serverPort":userObj.config.userPref.ports.provider
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

        if (userObj.config.cert.external.hasOwnProperty (name) && userObj.config.trustedList.pzh.hasOwnProperty (name)) {
            sendMsg (conn, obj.user, { type:"storeExternalCert", message:false }); // PZH ALREADY ENROLLED
        } else {
            if (!userObj.config.cert.external.hasOwnProperty (name)) {
                userObj.config.cert.external[name] = {
                    id           :name,
                    host         :url.hostname,
                    port         :url.port ? url.port : 443,
                    externalCerts:obj.message.externalCerts.server,
                    externalCrl  :obj.message.externalCerts.crl,
                    serverPort   :obj.message.externalCerts.serverPort
                };
                userObj.config.storeDetails(require("path").join("certificates", "external"),"certificates", userObj.config.cert.external);
                var id = pzhNicknameToUserId( userObj.config.userData.nickname, hostname, serverPort);
                pzhFunctions.refreshPzh (id,  userObj.setConnParam());

            }
            if (!userObj.config.trustedList.pzh.hasOwnProperty (name)) {
                userObj.config.trustedList.pzh[name] = {};
                userObj.config.storeDetails(null, "trustedList", userObj.config.trustedList);
            }
            sendMsg( conn, obj.user, { type:"storeExternalCert", message:true });
        }
        // After this step OpenId authentication is triggered
    }

    // Third step
    // The PZH we are trying to connect calls this presumably this should return something unique
    function requestAddFriend (conn, obj, userObj) {
        
        var internalUser = userObj;
        var externalUrl  = require ("url").parse (obj.message.externalPzh.pzhAddress);
        var externalUser = obj.message.externalUser;
        var externalId   = pzhNicknameToUserId( externalUrl.auth,  externalUrl.hostname, externalUrl.port);
       
        //TODO: What if a malformed userId is given?
        logger.log ("PZH TLS Server is now aware that the user " + externalUser.displayName + "(" + obj.message.externalPzh.externalNickname + ")"
             + " with PZH details : " + obj.message.externalPzh.externalPZHUrl +
            " has been authenticated and would like to be added to the list of trusted users to " +
            userObj.config.userData.name + "'s zone");

        userObj.config.untrustedCert[externalId] = {
            email        :externalUser.emails[0].value,
            displayName  :externalUser.displayName,
            from         :externalUser.from,
            identifier   :externalUser.identifier,
            host         :externalUrl.hostname,
            nickname     :obj.message.externalPzh.externalNickname,
            port         :externalUrl.port ? externalUrl.port : 443,
            externalCerts:obj.message.externalPzh.pzhCerts.server,
            externalCrl  :obj.message.externalPzh.pzhCerts.crl,
            serverPort   :obj.message.externalPzh.pzhCerts.serverPort};
        userObj.config.storeDetails(null, "untrustedList", userObj.config.untrustedCert);
        sendMsg (conn, obj.user, { type:"requestAddFriend", message:true });
    }

    // Fourth Step
    // Connecting Pzh calls this to
    function getRequestingExternalUser (conn, obj, userObj) {
        function userList () {
            var list = [];
            for (var item in userObj.config.untrustedCert) {
                if (userObj.config.untrustedCert.hasOwnProperty (item)) {
                    var external = userObj.config.untrustedCert[item];
                    list.push ({"id":item, "host":external.host, "email": external.email, "from": external.from, "displayName" : external.displayName});
                }
            }
            return list;
        }

        sendMsg (conn, obj.user, { type:"getRequestingExternalUser", message:userList () });
    }

    function pzhNicknameToUserId(nickname, host, port) {
        var res = nickname + "@" + host;
        if (typeof port !== 'undefined' && port !== null && port !== 443 && port !== "443") {
            res += ":" + port;
        }
        return res;
    }

    // Sixth
    function approveFriend (conn, obj, userObj) {
        if (userObj.config.untrustedCert.hasOwnProperty (obj.message.externalUserId)) {
            logger.log ("Approving friend request for " + obj.message.externalUserId + " by " + obj.user.emails[0].value);
            // Store Certificates
            var details = userObj.config.untrustedCert[obj.message.externalUserId], name = obj.message.externalUserId;
            if (!userObj.config.cert.external.hasOwnProperty (name)) {
                userObj.config.cert.external[name] = details;
                userObj.config.storeDetails(require("path").join("certificates", "external"), "certificates", userObj.config.cert.external);
                var id = pzhNicknameToUserId(userObj.config.userData.nickname, hostname, serverPort);
                var certificateParam = userObj.setConnParam();
                pzhFunctions.refreshPzh (id, certificateParam);
                userObj.pzh_pzh.connectOtherPZH (name, certificateParam);
            }
            if (!userObj.config.trustedList.pzh.hasOwnProperty (name)) {
                userObj.config.trustedList.pzh[name] = {};
                userObj.config.storeDetails(null, "trustedList", userObj.config.trustedList);
            }
            delete userObj.config.untrustedCert[obj.message.externalUserId];
            userObj.config.storeDetails(null, "untrustedList", userObj.config.untrustedCert);
        }
    }

    // Sixth
    function rejectFriend (conn, obj, userObj) {
        if (userObj.config.untrustedCert.hasOwnProperty (obj.message.externalUserId)) {
            logger.log ("Rejecting friend request by " + obj.message.externalUserId + " for " + obj.user);
            delete userObj.config.untrustedCert[obj.message.externalUserId];
            userObj.config.storeUntrustedCert(userObj.config.untrustedCert);
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
            logger.log("Adding " + obj.message.externalNickname + " as an external user to " + userObj.config.metaData.webinosName + "'s zone");
            userObj.config.cert.external[friendpzh.config.metaData.serverName] = {
                id           :friendpzh.config.metaData.serverName,
                port         :port,
                externalCerts:friendpzh.config.cert.internal.master.cert,
                externalCrl  :friendpzh.config.crl,
                serverPort   :serverPort // TODO
            };
            userObj.config.storeDetails(require("path").join("certificates", "external"), "certificates", userObj.config.cert.external);

            //update the actual list.
            if (!userObj.config.trustedList.pzh.hasOwnProperty (friendpzh.config.metaData.serverName)) {
                userObj.config.trustedList.pzh[friendpzh.config.metaData.serverName] = {};
                userObj.config.storeDetails(null, "trustedList", userObj.config.trustedList);
            }

            var id = pzhNicknameToUserId( userObj.config.userData.nickname, hostname, serverPort);
            pzhFunctions.refreshPzh (id, userObj.setConnParam()); // Refresh Certificate details in the SNI Context of the farm

            // add the current user to the friend's list of untrusted people.
            // the friend will later approve or reject the request.
            logger.log("Adding " + userObj.config.metaData.webinosName + " as an external user to " + obj.message.externalNickname + "'s zone");
            friendpzh.config.untrustedCert[userObj.config.metaData.serverName] = {
                email        :userObj.config.userData.email[0].value,
                displayName  :userObj.config.userData.name,
                from         :userObj.config.userData.authenticator,
                identifier   :userObj.config.userData.identifier,                
                host         :hostname,
                port         :port,
                name         :userObj.config.metaData.serverName,
                externalCerts:userObj.config.cert.internal.master.cert,
                externalCrl  :userObj.config.crl,
                serverPort   :serverPort // TODO
            };
            userObj.config.storeDetails(null, "untrustedList", userObj.config.untrustedCert);
            sendMsg(conn, obj.user, { type:"requestAddLocalFriend", message:true });
            return;
        } else {
            sendMsg(conn, obj.user, { type:"requestAddLocalFriend", message:false });
            return;
        }
    }


    function csrFromPzp (conn, obj, userObj) {
        var payload = userObj.enroll.addNewPZPCert (obj, pzhFunctions.refreshPzh);
        sendMsg (conn, obj.user, { type:"csrFromPzp", message:payload });
    }

    function removePzh(conn, obj, userObj) {
        userObj.removePzh(obj.message.id, pzhFunctions.refreshPzh, function(status){
            sendMsg(conn, obj.user, { type:"removePzh", message:status });
        });
    }

    function registerToken(conn, obj, userObj) {
        var crypto = require('crypto');
        var linkObject = {
            "nickname" : userObj.config.userData.nickname,
            "identifier" : userObj.config.userData.identifier,
            "serverName" : userObj.config.metaData.serverName,
            "linkId" : (crypto.randomBytes(100).toString("Base64")),
            "expiryDate" : new Date( + new Date + 12096e5),
            "external" : obj.message.externalDetails
        }
        //TODO: Save link object
        console.log("Saving token: " + util.inspect(linkObject));
        //userObj.config.inviteLinks[linkObject.linkId] = linkObject;
        //userObj.config.storeDetails(null, "inviteLinks", userObj.config.inviteLinks);
        if (!userObj.hasOwnProperty("inviteTokens") || userObj.inviteTokens === null) {
            userObj.inviteTokens = {};
        }
        userObj.inviteTokens[linkObject.linkId] = linkObject;

        sendMsg(conn, obj.user, { type:"registerToken", message:linkObject.linkId});
    }

    function isValidToken(token, userObj) {
        var tokens = userObj.inviteTokens;
        if (token === null || typeof token === 'undefined' || typeof tokens === 'undefined' || tokens === null) {
            console.log("Not a valid token");
            return false;
        }

        console.log("All tokens: " + require('util').inspect(tokens));

        return tokens.hasOwnProperty(token) && tokens[token].expiryDate > new Date();
    }

    function checkToken(conn, obj, userObj) {
        if (isValidToken(obj.message.token, userObj)) {
            var validToken = userObj.inviteTokens[obj.message.token];
            sendMsg(conn, obj.user, { type:"checkToken", message: {result : true, tokenDetails : validToken } } );
        } else {
            console.log("Invalid token: " + obj.message.token);
            sendMsg(conn, obj.user, { type:"checkToken", message: {result : false} } );
        }
    }

    function deleteToken(conn, obj, userObj) {
        if (isValidToken(obj.message.token, userObj)) {
            delete userObj.inviteTokens[obj.message.token];
        }
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
                pzhs[pzhId] = new pzh_session ();
                obj.user.nickname = userId; // set the nickname field appropriately.
                if((details = pzhs[pzhId].addLoadPzh (userId, pzhId, obj.user))){
                    pzhFunctions.addPzh(details.uri, details.cert);
                    releaseLock ();
                    return pzhId;
                } else {
                    logger.log("Strange error adding PZH, it didn't work");
                    return null;
                }
            }
        } catch (err) {
            logger.log (err);
            logger.log("An error occurred adding PZH");
            return null;
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
                var i;
                for (i = 0; i < pzhs[p].config.userData.email.length; i = i + 1) {
                    if (pzhs[p].config.userData.email[i].value === email) {
                        return pzhs[p];
                    }
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
                if (pzhs[p].config.userData.nickname === nickname) {
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
            wUtil.webinosMsgProcessing.readJson (this, data, function (message) {
                processMsg (conn, message);
            });
        } catch (err) {
            logger.error ("exception in processing received message " + err);
            console.log(err.stack)
        } finally {
            conn.resume ();
        }
    };
};
module.exports = pzhWI
