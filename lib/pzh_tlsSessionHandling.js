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
/**
 * Creates a new Pzh object
 * @constructor
 */
var Pzh = function () {
    "use strict";
    PzhReceiveMessage.call(this);
    PzhSendMessage.call(this);
    PzhEnrollPzp.call(this);
    PzhRevokePzp.call(this);
    PzhCleanUp.call(this);
    PzhConnectPzh.call(this);
    PzhSyncHandler.call(this);
    PzhServiceHandler.call(this);
    var wUtil = require("webinos-utilities");
    var certificateHandler = require("webinos-certificateHandler");
    var logger = wUtil.webinosLogging(__filename);

    var PzhObject = this;
    var config = {};// Holds PZH Configuration, it is persistent data
    var pzh_state = {
        sessionId   :"", // Holds PZH Session Id
        connectedPzp:{}, // Holds connected PZP information such as IP address and socket connection
        connectedPzh:{},
        connectedDevicesToOtherPzh: {pzh:{}, pzp:{}}
    };
    PzhObject.getMasterCertificate= function(){ return config.cert.internal.master.cert; };
    PzhObject.getCRL           = function()   { return config.cert.crl.value; };
    PzhObject.getWebinosRoot   = function()   { return config.metaData.webinosRoot; };
    PzhObject.getEmailId       = function()   { return config.userData.email[0].value; };
    PzhObject.getSessionId     = function()   { return pzh_state.sessionId; };
    PzhObject.getFriendlyName  = function(name){
        return (name ? (config.trustedList.pzh && config.trustedList.pzh[name] &&config.trustedList.pzh[name].friendlyName ||
            config.trustedList.pzp && config.trustedList.pzp[name].friendlyName): config.metaData.friendlyName); };
    PzhObject.getSignedCert    = function(id)  { console.log(id, config.cert.internal.signedCert); return (id? config.cert.internal.signedCert[id]: Object.keys(config.cert.internal.signedCert));};
    PzhObject.getRevokedCert   = function(id)  { return (id? config.cert.internal.revokedCert[id]: Object.keys(config.cert.internal.revokedCert));};
    PzhObject.getExternalCertificate= function(to){return (to?  config.cert.external[to] : Object.keys(config.cert.external));   };
    PzhObject.getWebinosPorts  = function(id) { return (id? config.userPef[id]: config.userPref); };
    PzhObject.getUserData      = function(name){ return (name? config.userData[name]: config.userData);};
    PzhObject.getMetaData      = function(name){ return (name? config.metaData[name]: config.metaData);};

    PzhObject.getServiceCache  = function()   {return config.serviceCache;};
    PzhObject.storeServiceCache= function(serviceCache) {
        config.serviceCache = serviceCache;
        config.storeDetails("userData", "serviceCache", config.serviceCache);
    };
    PzhObject.checkServiceCache= function(id) {return (config.serviceCache.indexOf(id) !== -1)}; // If present true else false
    PzhObject.getTrustedList   = function(type){return  ((type === "pzh")? (Object.keys(config.trustedList.pzh)): ((type === "pzp") ? Object.keys(config.trustedList.pzp): config.trustedList));};
    PzhObject.getConnectedPzh  = function(id) { return (id? pzh_state.connectedPzh[id]: Object.keys(pzh_state.connectedPzh)); };
    PzhObject.getConnectedPzp  = function(id) { return (id? pzh_state.connectedPzp[id]: Object.keys(pzh_state.connectedPzp)); };
    PzhObject.getUntrustedList = function(id) { return (id? config.untrustedCert[id]: Object.keys(config.untrustedCert)); };
    PzhObject.checkTrustedList = function(id) { return (config.trustedList.pzh.hasOwnProperty(id) ||config.trustedList.pzp.hasOwnProperty(id)); };
    PzhObject.checkConnectedPzh= function(id) { return pzh_state.connectedPzh.hasOwnProperty(id); };
    PzhObject.checkConnectedPzp= function(id) { return pzh_state.connectedPzp.hasOwnProperty(id); };
    PzhObject.checkExternalCertificate=function(id){return config.cert.external.hasOwnProperty(id);};
    PzhObject.checkRevokedCert = function(id) { return config.cert.internal.revokedCert.hasOwnProperty(id);};
    PzhObject.checkUntrustedList=function(id){return config.untrustedCert.hasOwnProperty(id);};
    PzhObject.removeTrustedList = function(name) {
        if (PzhObject.checkTrustedList(name)) {
            delete config.trustedList.pzh[name];
            config.storeDetails("trustedList", config.trustedList);
        }
    };
    PzhObject.setPzhTrustedList   = function(name, friendlyName){
        if (!PzhObject.checkTrustedList(name)) {
            config.trustedList.pzh[name] = {friendlyName: friendlyName};
            config.storeDetails( "trustedList", config.trustedList);
        }
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
    PzhObject.setExternalCertificate=function(name, configuration){
        if (!PzhObject.checkExternalCertificate(name)) {
            config.cert.external[name] = configuration;
            config.storeDetails(require("path").join("certificate","external"), "certificates", config.cert.external);
        }
    };
    PzhObject.removeExternalCertificate=function(name){
        if (PzhObject.checkExternalCertificate(name)) {
            delete config.cert.external[name];
            config.storeDetails(require("path").join("certificate","external"), "certificates", config.cert.external);
        }
    };
    PzhObject.revokeClientCert = function(id) {
        var crl = config.cert.revokeClientCert(id);
        config.cert.crl.value = crl;
        delete config.cert.internal.signedCert[id];
        delete config.trustedList.pzp[id];
        config.cert.internal.revokedCert[id] = crl;
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
    PzhObject.signStorePzpCertificate = function(id, friendlyName, csr) {
        if(config.cert.internal.signedCert[id] = config.cert.generateSignedCertificate(csr)) {
            config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
            if (!config.trustedList.pzp.hasOwnProperty(id)) {// update configuration with signed certificate details ..
                config.trustedList.pzp[id] = {"friendlyName": config.metaData.friendlyName+ " " + friendlyName};
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
                PzhObject.synchronizationStart();
                PzhObject.sendUpdateAboutConnectedDevices(pzpId);
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
    this.handlePzhAuthorization = function (pzhId, conn) {
        var otherPzh = [], msg, localServices;
        if (pzhId) {
            if (!PzhObject.getConnectedPzh().hasOwnProperty (pzhId)) {
                logger.log ("pzh " + pzhId + " connected");
                pzh_state.connectedPzh[pzhId] = conn;
                conn.id = pzhId;
                msg = PzhObject.messageHandler.createRegisterMessage(pzhId, config.metaData.serverName);
                PzhObject.messageHandler.onMessageReceived(msg, msg.to);
                PzhObject.registerServices(pzhId);
                PzhObject.synchronizationStart(); // Need to sync here too
                PzhObject.sendUpdateAboutConnectedDevices(pzhId);

            } else {
                logger.log ("pzh -" + pzhId + " already connected");
            }
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

        if (conn.authorized) {// PZP/PZH connecting with proper certificate at both ends
            var cn, name;
            logger.log ("connection authorised at pzh");
            try {
                cn = decodeURIComponent (conn.getPeerCertificate ().subject.CN);// Get peer common name from the certificate
                cn = cn.split (":");
            } catch (err) {
                logger.error ("exception in reading common name of peer pzh certificate " + err);
                return;
            }

            if (cn[0] === "Pzh") {
                cn = conn.getPeerCertificate() &&
                    conn.getPeerCertificate().subjectaltname &&
                    conn.getPeerCertificate().subjectaltname.split (":");
                if (cn.length > 2) {
                    name = cn[1] + ":" + cn[2];
                } else {
                    name = cn [1];
                }
                PzhObject.handlePzhAuthorization (name, conn);
            } else if (cn[0] === "Pzp") {
                handlePzpAuthorization (cn[1], conn);
            }
        }
    };

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
            var caList = [], crlList = [], key;
            caList.push (config.cert.internal.master.cert);
            crlList.push (config.cert.crl.value);

            for (key in config.cert.internal.signedCert) {
                if (config.cert.internal.signedCert.hasOwnProperty (key)) {
                    caList.push(config.cert.internal.signedCert[key]);
                }
            }
            for (key in config.cert.external) {
                if (config.cert.external.hasOwnProperty (key)) {
                    caList.push (config.cert.external[key].externalCerts);
                    crlList.push (config.cert.external[key].externalCrl);
                }
            }
            // Certificate parameters that will be added in SNI context of farm
            return  {
                key               :privateKey,
                cert              :config.cert.internal.conn.cert,
                ca                :caList,
                //crl               :crlList,
                requestCert       :true,
                rejectUnauthorized:true
            };
        }
    };

    function createPzhCertificatesConfig(user) {
        if(config.createDefaultDirectories()) {
            var PzpDefaultConfig = require("../config.json");
            config.userPref.ports = PzpDefaultConfig.ports;
            config.storeDetails("userData", "userPref", config.userPref);
            config.userData.name = user.displayName;
            config.userData.email = user.emails;
            if (user.hasOwnProperty("photoUrl")) {
              config.userData.photoUrl = user.photoUrl;
            }
            config.userData.authenticator = user.from;
            config.userData.identifier = user.identifier;
            config.metaData.friendlyName = config.userData.name ;
            config.userData.nickname = user.nickname;
            config.storeDetails(null,"metaData", config.metaData);
            config.storeDetails("userData","userDetails", config.userData);
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
            if(!config.loadWebinosConfiguration()) {
                createPzhCertificatesConfig(user);
            }
            config.loadCertificates(config.cert);
            pzh_state.sessionId = uri;
            logger.addId (config.userData && config.userData.email && config.userData.email[0] && config.userData.email[0].value);
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
module.exports = Pzh;
