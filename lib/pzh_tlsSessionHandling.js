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

var PzhReceiveMessage = require ("./pzh_receiveMessage.js");
var PzhSendMessage    = require ("./pzh_sendMessage.js");
var PzhEnrollPzp      = require ("./pzh_pzpEnrollment.js");
var PzhRevokePzp      = require ("./pzh_pzpRevoke.js");
var PzhCleanUp        = require ("./pzh_cleanUp.js");
var PzhConnectPzh     = require ("./pzh_connectPzh.js");
var PzhSyncHandler    = require("./pzh_syncHandler.js");
var PzhServiceHandler =  require("./pzh_serviceHandler.js");
var wUtil = require("webinos-utilities");

/**
 * Creates a new Pzh object
 * @constructor
 */
var Pzh = function (hostname) {
    "use strict";
    PzhReceiveMessage.call(this);
    PzhSendMessage.call(this);
    PzhEnrollPzp.call(this);
    PzhRevokePzp.call(this);
    PzhCleanUp.call(this);
    PzhConnectPzh.call(this);
    PzhSyncHandler.call(this);
    PzhServiceHandler.call(this);
    wUtil.webinosActions.ActionHandler.call(this);

    var certificateHandler = require("webinos-certificateHandler");
    var logger = wUtil.webinosLogging(__filename);

    var PzhObject = this;
    var config = {};// Holds PZH Configuration, it is persistent data
    var pzh_state = {
        sessionId   :"", // Holds PZH Session Id
        connectedPzp:{}, // Holds connected PZP information such as IP address and socket connection
        connectedPzh:{},
        connectedDevicesToOtherPzh: {pzh:[],pzp:[]}
    };

    PzhObject.notificationManager = new wUtil.webinosNotifications.NotificationManager(PzhObject);

    PzhObject.getMasterCertificate= function(){
        return config.cert.internal.master.cert;
    };
    PzhObject.getCRL           = function()   {
        return config.cert.crl.value;
    };
    PzhObject.getWebinosRoot   = function()   {
        return config.metaData.webinosRoot;
    };
    PzhObject.getSessionId     = function()   {
        return pzh_state.sessionId;
    };
    PzhObject.setPhotoURL = function(url) {
        config.trustedList.pzh[pzh_state.sessionId].photoUrl = url;
        config.storeDetails("trustedList", config.trustedList);
    };
    PzhObject.getFriendlyName  = function(name){
        if (!name) {
            name = PzhObject.getSessionId();
        }
        return ((config.trustedList.pzh && config.trustedList.pzh[name] && config.trustedList.pzh[name].friendlyName) ||
            (config.trustedList.pzp && config.trustedList.pzp[name] && config.trustedList.pzp[name].friendlyName));
    };
    PzhObject.checkFriendlyName  = function(name){
        for (var key in config.trustedList.pzh) {
            if (config.trustedList.pzh.hasOwnProperty(key) && config.trustedList.pzh[key].friendlyName === name) {
                return true;
            }
        }
        for (key in config.trustedList.pzp) {
            if (config.trustedList.pzp.hasOwnProperty(key) && config.trustedList.pzp[key].friendlyName === name) {
                return true;
            }
        }
        return false
    };

    /**
     *
     * @param [type] - pzh or pzp and is optional
     * @returns {*}
     */
    PzhObject.getConnectedDevices = function(type){
        var cDevices = {"pzh":{}, "pzp":{}};
        var i, pzhList = PzhObject.getConnectedPzh();
        for (i = 0 ; i < (pzh_state.connectedDevicesToOtherPzh && pzh_state.connectedDevicesToOtherPzh.pzh &&
                          pzh_state.connectedDevicesToOtherPzh.pzh.length); i++){
            if (pzhList.indexOf(pzh_state.connectedDevicesToOtherPzh.pzh[i]) === -1)
                pzhList.push(pzh_state.connectedDevicesToOtherPzh.pzh[i]);
        }
        //pzhList.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 : ((b.id) > (a.id)) ? -1 : 0);} );
        cDevices.pzh = pzhList;

        var pzpList = PzhObject.getConnectedPzp();
        for (i = 0 ; i < (pzh_state.connectedDevicesToOtherPzh && pzh_state.connectedDevicesToOtherPzh.pzp &&
            pzh_state.connectedDevicesToOtherPzh.pzp.length); i++){
            if (pzpList.indexOf(pzh_state.connectedDevicesToOtherPzh.pzp[i]) === -1)
                pzpList.push(pzh_state.connectedDevicesToOtherPzh.pzp[i]);

        }
        //pzpList.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 : ((b.id) > (a.id)) ? -1 : 0);} );
        cDevices.pzp = pzpList;

        return (type?cDevices[type]:cDevices);
    }
    PzhObject.setConnectedDevices = function(connectedDevices, id){
        pzh_state.connectedDevicesToOtherPzh.pzh=  PzhObject.getConnectedPzh();
        pzh_state.connectedDevicesToOtherPzh.pzp=  PzhObject.getConnectedPzp();
        var key;
        if (!id || id == "pzh") {
            for (key in connectedDevices.pzh) {
                if (connectedDevices.pzh.hasOwnProperty(key)){
                    if (pzh_state.connectedDevicesToOtherPzh.pzh.indexOf(connectedDevices.pzh[key]) === -1) {
                        pzh_state.connectedDevicesToOtherPzh.pzh.push(connectedDevices.pzh[key]);
                    }
                }
            }
        }
        if (!id || id == "pzp") {
            for (key in connectedDevices.pzp) {
                if (connectedDevices.pzp.hasOwnProperty(key)){
                    if (pzh_state.connectedDevicesToOtherPzh.pzp.indexOf(connectedDevices.pzp[key]) === -1) {
                        pzh_state.connectedDevicesToOtherPzh.pzp.push(connectedDevices.pzp[key]);
                    }
                }
            }
        }
       //pzh_state.connectedDevicesToOtherPzh.pzh.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 : ((b.id) > (a.id)) ? -1 : 0);} );
       //pzh_state.connectedDevicesToOtherPzh.pzp.sort(function(a,b) {return ((a.id)> ( b.id) ? 1 : ((b.id) > (a.id)) ? -1 : 0);} );
    };

    PzhObject.getSignedCert    = function(id)  {
        return (id? config.cert.internal.signedCert[id]: Object.keys(config.cert.internal.signedCert));
    };
    PzhObject.getRevokedCert   = function(id)  {
        return (id? config.cert.internal.revokedCert[id]: Object.keys(config.cert.internal.revokedCert));
    };
    PzhObject.getExternalCertificate= function(to){
        return (to?  config.cert.external[to] : Object.keys(config.cert.external));
    };
    PzhObject.getExternalCertificateObj     = function() {
        return config.cert.external;
    };
    PzhObject.getWebinosPorts  = function(id) {
        return (id? config.userPref.ports[id]: config.userPref.ports);
    };
    PzhObject.getMetaData      = function(name){
        return (name? config.metaData[name]: config.metaData);
    };
    PzhObject.getServiceCache  = function()   {
        var remoteCache = config.serviceCache;
        var ownServices = PzhObject.getServices();
        function contains(localArr, lname) {
            for (var i = 0 ; i < localArr.length; i = i + 1) {
                if (localArr[i].id === lname.id && localArr[i].serviceAddress == lname.serviceAddress) {
                    return true;
                }
            }
            return false;
        }
        for (var i = 0; i < ownServices.length; i = i + 1){
            if (!contains(remoteCache, ownServices[i])) {
                remoteCache.push(ownServices[i]);
            }
        }
        remoteCache.sort(function(a,b) {
            return ((a.displayName)> ( b.displayName) ? 1 : ((b.displayName) > (a.displayName)) ? -1 : 0);
        });
        return remoteCache;
    };
    PzhObject.getPzhServiceCache = function(){
        var remoteCache = config.serviceCache;
        var ownServices = PzhObject.getServices();
        function isSameZone(address){
            var breakup = address && address.split("/");
            return (breakup && breakup[0] === PzhObject.getSessionId());
        }
        function contains(localArr, lname) {
            for (var i = 0 ; i < localArr.length; i = i + 1) {
                if (localArr[i].id == lname.id && localArr[i].serviceAddress == lname.serviceAddress) {
                    return true;
                }
            }
            return false;
        }
        for (var i = 0; i < ownServices.length; i = i + 1){
            if (!contains(remoteCache, ownServices[i]) && ownServices[i].serviceAddress && isSameZone(ownServices[i].serviceAddress)) {
                remoteCache.push(ownServices[i]);
            }
        }
        remoteCache.sort(function(a,b) {return ((a.displayName)> ( b.displayName) ? 1 : ((b.displayName) > (a.displayName)) ? -1 : 0);} );
        return remoteCache;
    };
    PzhObject.storeServiceCache= function(serviceCache) {
        config.serviceCache = serviceCache;
        var extServ = [];
        config.storeDetails("userData", "serviceCache", serviceCache);
        serviceCache.forEach(function(service){
            if (service.serviceAddress !== pzh_state.sessionId) {
                extServ.push(service);// Only add service not in this device
            }
        });
        PzhObject.addRemoteServices(extServ);
    };
    PzhObject.getSignedCertificateObj = function(){
        return config.cert.internal.signedCert;
    };
    PzhObject.checkServiceCache= function(id) {
        return (config.serviceCache.indexOf(id) !== -1)
    }; // If present true else false
    PzhObject.getTrustedList   = function(type){
        return  ((type === "pzh")? (config.trustedList.pzh):
            ((type === "pzp") ? config.trustedList.pzp: config.trustedList));
    };
    PzhObject.getConnectedPzh  = function(id) {
        return (id? pzh_state.connectedPzh[id]: Object.keys(pzh_state.connectedPzh));
    };
    PzhObject.getConnectedPzp  = function(id) {
        var id1 =  (id? pzh_state.connectedPzp[id]: Object.keys(pzh_state.connectedPzp));
        return id1;
    };
    PzhObject.getUntrustedList = function(id) {
        return (id? config.untrustedCert[id]: Object.keys(config.untrustedCert));
    };
    PzhObject.checkTrustedList = function(id) {
        return ((config.trustedList && config.trustedList.pzh && config.trustedList.pzh.hasOwnProperty(id)) ||
                (config.trustedList && config.trustedList.pzp && config.trustedList.pzp.hasOwnProperty(id)));
    };
    PzhObject.checkConnectedPzh= function(id) {
        return pzh_state.connectedPzh.hasOwnProperty(id);
    };
    PzhObject.checkConnectedPzp= function(id) {
        return pzh_state.connectedPzp.hasOwnProperty(id);
    };
    PzhObject.checkExternalCertificate=function(id){
        return config.cert.external.hasOwnProperty(id);
    };
    PzhObject.checkRevokedCert = function(id) {
        return (config.cert.internal.revokedCert && config.cert.internal.revokedCert.hasOwnProperty(id));
    };
    PzhObject.checkUntrustedList=function(id){
        return config.untrustedCert.hasOwnProperty(id);
    };
    PzhObject.checkConnectedDevices= function(id) {
        return (pzh_state.connectedDevicesToOtherPzh.pzh.indexOf(id) !== -1 ||
                pzh_state.connectedDevicesToOtherPzh.pzp.indexOf(id) !== -1);
    };
    PzhObject.removeTrustedList = function(name) {
        if (PzhObject.checkTrustedList(name)) {
            if (config.trustedList.pzh[name]) delete config.trustedList.pzh[name];
            else if (config.trustedList.pzp[name]) delete config.trustedList.pzp[name];
            for (var key in config.trustedList.pzp){
                var address = key.split("/") && key.split("/")[0];
                if (name === address && address !== pzh_state.sessionId){
                    delete config.trustedList.pzp[name];
                }
            }
            config.storeDetails("trustedList", config.trustedList);        }

    };
    PzhObject.setPzhTrustedList   = function(name, friendlyName, email, authenticator, nickname, identifier, photoUrl){
        if (!PzhObject.checkTrustedList(name)) {
            if (typeof friendlyName == 'undefined' || friendlyName === null) {
                friendlyName = name;
            }
            config.trustedList.pzh[name] = {email: email,
                photoUrl: photoUrl,
                friendlyName: friendlyName,
                nickname: nickname,
                authenticator:authenticator,
                identifier:identifier};
            config.storeDetails("trustedList", config.trustedList);
        }
    };
    PzhObject.updateTrustedList   = function(obj){
        config.trustedList = obj;
        config.storeDetails("trustedList", config.trustedList);
    };
    PzhObject.updatePzhTrustedList   = function(obj){
        config.trustedList.pzp = obj.pzp;

        config.storeDetails("trustedList", config.trustedList);
    };
    PzhObject.removeUntrustedList=function(name) {
        if(PzhObject.checkUntrustedList(name)) delete config.untrustedCert[name];
        config.storeDetails( "untrustedList", config.untrustedCert);
    };
    PzhObject.setUntrustedList=function(name, configuration){
        if(!PzhObject.checkUntrustedList(name)){
            config.untrustedCert[name] = configuration;
            config.storeDetails( "untrustedList", config.untrustedCert);
        }
    };
    PzhObject.getWebServerAddress = function() {
        return require('url').format({
            protocol : "https",
            port : PzhObject.getWebinosPorts("provider_webServer"),
            hostname : hostname
        })
    }
    PzhObject.checkInvitationToken = function(id) {
        if (id === null || typeof id === 'undefined' || !config.invitationTokens.hasOwnProperty(id) ) return false;
        var expires = new Date(config.invitationTokens[id].expiryDate);
        return expires > new Date();
    };
    PzhObject.addInvitationToken = function(token) {
        config.invitationTokens[token.linkId] = token;
        config.storeDetails( "invitationTokens", config.invitationTokens);
        PzhObject.purgeOldInvitationTokens();
    };
    PzhObject.removeInvitationToken = function(id) {
        if (config.invitationTokens.hasOwnProperty(id)) {
            delete config.invitationTokens[id];
            config.storeDetails( "invitationTokens", config.invitationTokens);
        }
    };
    PzhObject.purgeOldInvitationTokens = function() {
        for (var tokenId in config.invitationTokens) {
            if (!PzhObject.checkInvitationToken(tokenId)) {
                PzhObject.removeInvitationToken(tokenId);
            }
        }
    }
    PzhObject.getInvitationToken = function(id) {
        if (config.invitationTokens.hasOwnProperty(id)) {
            return config.invitationTokens[id];
        }
    };
    PzhObject.setExternalCertificate=function(name, configuration){
        if (!PzhObject.checkExternalCertificate(name)) {
            config.cert.external[name] = configuration;
            config.storeDetails(require("path").join("certificates","external"), "certificates", config.cert.external);
        }
    };
    PzhObject.removeExternalCertificate=function(name){
        if (PzhObject.checkExternalCertificate(name)) {
            delete config.cert.external[name];
            config.storeDetails(require("path").join("certificates","external"), "certificates", config.cert.external);
        }
    };
    PzhObject.removeSignedCertificate=function(name){
        if (config.cert.internal.signedCert[name]) {
            delete config.cert.internal.signedCert[name];
            config.storeDetails(require("path").join("certificates","internal"), "certificates", config.cert.internal);
        }
    };
    PzhObject.getUserDetails = function(id){
        var pzhList = PzhObject.getTrustedList("pzh");
        var userDetails = pzhList[pzh_state.sessionId];
        return (id ? userDetails[id]: userDetails);
    };
    PzhObject.updatePolicy = function(updatedPolicy) {
       require("fs").writeFileSync(require("path").join(PzhObject.getWebinosRoot(), "policies", "policy.xml"), updatedPolicy);
    };
    PzhObject.revokeClientCert = function(id, pzpCert) {
        logger.log("Revoke Client Cert with id: " + id + " and cert: " + pzpCert);
        var crl = config.cert.revokeClientCert(pzpCert);
        config.cert.crl.value = crl;
        delete config.cert.internal.signedCert[id];
        delete config.trustedList.pzp[id];
        config.cert.internal.revokedCert[id] = crl;

        config.storeDetails("trustedList", config.trustedList);
        config.storeDetails("certificates/internal","certificates", config.cert.internal);
        if (pzh_state.connectedPzp.hasOwnProperty(id)) {
            pzh_state.connectedPzp[id].socket.end();
            delete pzh_state.connectedPzp[id];
        }
        return true;
    };
    PzhObject.clearConnectedDeviceDetails = function(id) {
       if(pzh_state.connectedPzh.hasOwnProperty(id)) {
           pzh_state.connectedPzh[id].socket.end();
           delete pzh_state.connectedPzh[id];
       }
       if(pzh_state.connectedPzp.hasOwnProperty(id)) {
           pzh_state.connectedPzp[id].socket.end();
           delete pzh_state.connectedPzp[id];
       }
       PzhObject.messageHandler.removeRoute(id, PzhObject.getSessionId());
    };
    PzhObject.signStorePzpCertificate = function(id, friendlyName, deviceType, csr) {
        var signedCert= config.cert.generateSignedCertificate(csr);
        if (signedCert) {
            config.cert.internal.signedCert[id] = signedCert;
            config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
            if (config.trustedList.pzp && !config.trustedList.pzp.hasOwnProperty(id)) {// update configuration with signed certificate details ..
                config.trustedList.pzp[id] = {"friendlyName": friendlyName, "deviceType": deviceType};
                config.storeDetails("trustedList", config.trustedList);
            }
            return true;
        } else {
            return false;
        }
    };

    /**
     * PZP once authorized, following steps are involved:
     * 1. Details are stored in connectedPZP
     * 2. registering with message handler
     * 3. Sending PZP and PZH update
     * 4. Synchronization of files
     * @param pzpId
     * @param conn
     */
    function handlePzpAuthorization (pzpId, conn) {
        try {
            var msg;
            pzpId = config.metaData.serverName +"/"+ pzpId;
            if (config.trustedList.pzp.hasOwnProperty (pzpId)) {
                logger.log ("pzp " + pzpId + "  connected");
                pzh_state.connectedPzp[pzpId] =conn;
                conn.id = pzpId;
                msg = PzhObject.messageHandler.createRegisterMessage(pzpId, PzhObject.getSessionId());
                PzhObject.messageHandler.onMessageReceived(msg, msg.to);
                PzhObject.synchronizationStart(pzpId);

//                for (var keys in pzh_state.connectedPzp){
//                    if (pzh_state.connectedPzp.hasOwnProperty(keys))
//                }

                PzhObject.syncAllPzp("syncHash",pzpId, {"connectedDevices": PzhObject.getConnectedDevices()});
                PzhObject.syncAllPzh("syncHash",undefined, {"connectedDevices": {pzp:PzhObject.getConnectedDevices("pzp")}});

                PzhObject.sendPendingActions({from: pzpId});
                PzhObject.emit("PZP_CONNECTED", pzpId);
            } else {
                logger.error ("unregistered pzp " + pzpId + " trying to connect");
                conn.socket.end();
            }
        } catch(err){
            logger.error(err);
        }
    }

    /**
     * This function is used both by PZH connecting and PZH acting as Server
     * PZH once authorized, following functionality are done
     * 1. Storing information in connectedPZH
     * 2. Registering with the message handler
     * 3. Sending connected PZH details across PZH
     * @param pzhId
     * @param conn
     */
    this.handlePzhAuthorization = function (pzhId, conn, client) {
        var msg;
        if (pzhId) {

            //if (!pzh_state.connectedPzh.hasOwnProperty(pzhId)) {
               logger.log ("PZH " + pzhId + " connected");
                pzh_state.connectedPzh[pzhId] = conn;
                conn.id = pzhId;
                msg = PzhObject.messageHandler.createRegisterMessage(pzhId, config.metaData.serverName);
                PzhObject.messageHandler.onMessageReceived(msg, msg.to);
               // PzhObject.registerServices(pzhId);

                /*if (client)*/ PzhObject.synchronizationStart(pzhId);
                PzhObject.syncAllPzp("syncHash",undefined, {"connectedDevices": PzhObject.getConnectedDevices()});
                PzhObject.syncAllPzh("syncHash",pzhId, {"connectedDevices": {pzp:PzhObject.getConnectedDevices("pzp")}});
                PzhObject.emit("EXTERNAL_HUB_CONNECTED", pzhId);
            /*} else {
                logger.log ("pzh -" + pzhId + " already connected");
                conn.socket.end();
            } */
        }
    };

    /**
     * Responsible for handling authorized pzh and pzp. The main part of this function are processing if the connection
     * is from a PZH or a PZP
     * @param {Object} conn - Connection object when any new connection is accepted.
     */
    this.handleConnectionAuthorization = function (conn) {
        if (conn.authorized === false) {// Allows PZP to connect if it has proper QRCode
            logger.log (" connection NOT authorised at pzh - " + conn.authorizationError);
            conn.socket.end ();
        }
        //conn.socket.pair._ssl.getPeerCertificate()
        var peerCert = conn.getPeerCertificate();
        if (conn.authorized && peerCert /*&& config.cert.validateConnection(peerCert.issuer.CN, getCAList())*/) {// PZP/PZH connecting with proper certificate at both ends
            var cn, name;
            logger.log ("connection authorised at pzh");
            try {
                cn = decodeURIComponent (peerCert.subject.CN);// Get peer common name from the certificate
                cn = cn.split (":");
            } catch (err) {
                logger.error ("exception in reading common name of peer pzh certificate " + err);
                 return;
            }
            if (cn[0] === "Pzh") {
                cn =peerCert.subjectaltname && peerCert.subjectaltname.split (":");
                name = (cn.length > 2) ? cn[1] + ":" + cn[2]:  cn [1];
                PzhObject.handlePzhAuthorization (name, conn, false);
            } else if (cn[0] === "Pzp") {
                handlePzpAuthorization (cn[1], conn);
            }
        }
    };

    function getCAList() {
        var caList = [], key;
        caList.push (config.cert.internal.master.cert);
        for (key in config.cert.internal.signedCert) {
            if (config.cert.internal.signedCert.hasOwnProperty (key)) {
                caList.push(config.cert.internal.signedCert[key]);
            }
        }
        for (key in config.cert.external) {
            if (config.cert.external.hasOwnProperty (key)) {
                caList.push (config.cert.external[key].externalCerts);
            }
        }
        return caList;
    }

    function getCRLList() {
        var crlList = [], key;
        crlList.push (config.cert.crl.value);
        for (key in config.cert.external) {
            if (config.cert.external.hasOwnProperty (key)) {
                crlList.push (config.cert.external[key].externalCrl);
            }
        }
        return crlList;
    }
    /**
     * Helper function is used by PZH connecting to other PZHs. It is also used
     * the PZH Server to set TLS configuration
     * It is very important function as TLS server is dictated via value set here
     * 1. It includes CRL list of all Trusted PZH
     * 2. It includes list of all CA certificates
     * 3. Request certificate enables mutual authentication
     * 4. Reject unauthorized disconnects any PZH which does not have proper certificate
     */
    this.setConnParam = function () {
        var privateKey;
        if ((privateKey=config.cert.keyStore.fetchKey (config.cert.internal.conn.key_id))) {
            // Certificate parameters that will be added in SNI context of farm
            return  {
                key               :privateKey,
                cert              :config.cert.internal.conn.cert,
                ca                :getCAList(),
                //crl               :getCRLList(),
                requestCert       :true,
                rejectUnauthorized:true
            };
        }
    };

    function createPzhCertificatesConfig(user) {
        if(config.createDefaultDirectories()) {
            config.trustedList.pzh[pzh_state.sessionId]= {
               email         : user.emails[0].value,
               photoUrl      : user.photoUrl,
               friendlyName  : user.displayName || user.nickname,
               nickname      : user.nickname,
               authenticator : user.from,
               identifier    : user.identifier
            };

            var signedCert, csr;
            var cn = config.metaData.webinosType + "CA:" + config.metaData.webinosName;
            if(config.cert.generateSelfSignedCertificate(config.metaData.webinosType+"CA", cn)) {
                logger.log ("*****"+config.metaData.webinosType+" Master Certificate Generated*****");
                cn = config.metaData.webinosType + ":" + config.metaData.webinosName;
                if((csr=config.cert.generateSelfSignedCertificate(config.metaData.webinosType,cn))) {
                    logger.log ("*****"+config.metaData.webinosType+" Connection Certificate Generated*****");
                    if((signedCert = config.cert.generateSignedCertificate(csr))) {
                        logger.log ("*****"+config.metaData.webinosType+" Connection Certificate Signed by Master Certificate*****");
                        config.cert.internal.conn.cert = signedCert;
                        config.storeDetails("certificates/internal","certificates", config.cert.internal);
                        config.storeDetails("crl", config.cert.crl);
                        config.storeDetails("trustedList", config.trustedList);
                        config.storeDetails("metaData", config.metaData);
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * ADDs PZH in a provider
     * @param friendlyName this name is used for creating configuration
     * @param uri pzh url you want to add, assumption it is of form bob@pzh.webinos.org
     * @param user details of the owner of the PZH
     */
    this.addLoadPzh = function (friendlyName, uri, user) {
        try {
            var inputConfig = {
                "friendlyName"   :friendlyName,
                "sessionIdentity":uri,
                "user"           :user
            };
            config = new wUtil.webinosConfiguration("Pzh", inputConfig);
            config.cert = new certificateHandler(config.metaData);
            pzh_state.sessionId = uri;
            config.userPref = require("../config.json");

            if(!config.loadWebinosConfiguration()) {
                createPzhCertificatesConfig(user);
            }
            config.loadCertificates(config.cert);

            logger.addId(uri && config.trustedList && config.trustedList.pzh[uri] && config.trustedList.pzh[uri].nickname);
            PzhObject.setMessageHandler_RPC ();
            return ({cert: PzhObject.setConnParam(), uri: uri});
        } catch (err) {
            logger.error(err);
        }
    };
};
require("util").inherits(Pzh, PzhReceiveMessage);
require("util").inherits(Pzh, PzhSendMessage);
require("util").inherits(Pzh, PzhEnrollPzp);
require("util").inherits(Pzh, PzhCleanUp);
require("util").inherits(Pzh, PzhConnectPzh);
require("util").inherits(Pzh, PzhSyncHandler);
require("util").inherits(Pzh, PzhServiceHandler);
require("util").inherits(Pzh, wUtil.webinosActions.ActionHandler);
Pzh.prototype.__proto__ = require("events").EventEmitter.prototype;
module.exports = Pzh;
