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
/**
 * Defines the constructor for the provider  and initializes the provider functions
 * @param hostname -  hostname is specified if the pzh provider
 * @param friendlyName - friendly name of the provider
 * @constructor
 */
var Provider = function (hostname, friendlyName) {
    var wUtil = require("webinos-utilities");
    var certificateHandler = require("webinos-certificateHandler");
    var logger = wUtil.webinosLogging(__filename) || console;
    var pzh_tlsSession = require("./pzh_tlsSessionHandling.js");
    var pzh_webSession = require("./pzh_webSessionHandling.js");
    var path = require("path");
    var server = {}; // TLS server socket on which provider listens
    var pzhs = {}; // instances of the pzh currently loaded
    var address = "0.0.0.0";
    var config = {};
    var webInterface = null;

    /**
     *  PZH already registered, are reloaded in case Provider is restarted
     */
    function loadPzhs() {
        var myKey, nickname;
        try{
            for (myKey in config.trustedList.pzh) {
                if (config.trustedList.pzh.hasOwnProperty(myKey)) {
                    pzhs[myKey] = new pzh_tlsSession(hostname);
                    var userId = myKey.split("@")[0];
                    var details=  pzhs[myKey].addLoadPzh(userId, myKey, null);
                    if (details) {

                        var certificateParam = pzhs[myKey].setConnParam();
                        server.addContext(details.uri, certificateParam);
                       /*Enable this for auto-pzh connect
                        var keys = Object.keys(pzhs[myKey].getTrustedList("pzh"));
                        for (var i = 0; i < keys.length; i = i + 1){
                            if (keys[i]!== myKey){
                                pzhs[myKey].connectOtherPZH (keys[i], certificateParam);
                            }
                        }*/

                        logger.log("started zone hub " + details.uri);
                    } else {
                        logger.error("failed starting zone hub" + value);
                    }
                }
            }
        }catch(err){
            logger.error("failed starting up PZHs in the farm "+ err);
        }
    }

    /**
     * Sets TLS server connection parameters
     *
     */
    function setParam() {
        return {
            key : config.cert.keyStore.fetchKey(config.cert.internal.conn.key_id),
            cert:config.cert.internal.conn.cert,
            ca  :config.cert.internal.master.cert,
            requestCert:true,
            rejectUnauthorised:true

        }
    }

    function createPzhProvider(){
        if(config.createDefaultDirectories()) {
            var signedCert, csr, cn;
            config.storeDetails("metaData", config.metaData);
            cn = config.metaData.webinosType + "CA:" + config.metaData.webinosName;
            if(config.cert.generateSelfSignedCertificate(config.metaData.webinosType+"CA", cn)) {
                logger.log ("*****"+config.metaData.webinosType+" Master Certificate Generated*****");
                cn = config.metaData.webinosType + ":" + config.metaData.webinosName;
                if((csr=config.cert.generateSelfSignedCertificate(config.metaData.webinosType,cn))) { // Master Certificate
                    logger.log ("*****"+config.metaData.webinosType+" Connection Certificate Generated*****");
                    signedCert = config.cert.generateSignedCertificate(csr);
                    if(signedCert) {
                        logger.log ("*****"+config.metaData.webinosType+" Connection Certificate Signed by Master Certificate*****");
                        config.cert.internal.conn.cert = signedCert;
                        config.storeDetails(path.join("certificates", "internal"),"certificates", config.cert.internal);
                        config.storeDetails( "crl", config.cert.crl);
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * Loads provider session/certificate details and starts the TLS server
     * @param callback - If successful returns true or false uf server fails to start
     */
    function loadSession(callback) {
        var inputConfig = {
            "friendlyName":friendlyName,
            "sessionIdentity":hostname
        };
        config = new wUtil.webinosConfiguration("PzhP", inputConfig);
        config.cert = new certificateHandler(config.metaData);
        config.userPref = require("../config.json");
        if(!config.loadWebinosConfiguration() ){
            createPzhProvider();
        }
        if(!config.loadCertificates(config.cert) ){
            logger.error("certificate not available...");
            callback(false);
            return;
        }
        var certParam = setParam();
        server = require("tls").createServer(certParam, function (conn) {   // This is the main TLS server, pzh started are stored as SNIContext to this server
            handleConnection(conn);
        });
        server.on("error", function (error) {
            logger.error(error.message);
            if (error && error.code === "EACCES") {
                callback(false, "The personal zone provider service was " +
                    "denied permission to use port " + config.userPref.ports.provider + " or port " + config.userPref.ports.provider_webServer + "." +
                    "\nThis is usually because you either do not have super-user " +
                    "access rights (on Linux, run using 'sudo') or another " +
                    "process is using the same port.\n" +
                    "Make sure that no other web servers are running and you " +
                    "have super-user privileges and try again.");
                //could not start zone provider due to access restrictions, check your access rights or change your configuration");
            }
        });

        server.on("listening", function () {
            logger.log("initialized at " + address + " and port " + config.userPref.ports.provider);
            loadPzhs();
            return callback(true);
        });
        server.listen(config.userPref.ports.provider, address);
    }


    /**
     *
     * @param uri
     * @param options
     */
    function addPzhDetails(uri, options) {
        server.addContext(uri, options);
        config.trustedList.pzh[uri] = {"address":hostname};
        config.storeDetails("trustedList", config.trustedList);
    }

    /**
     *
     * @param userId
     * @param userObj
     * @return {Array}
     */
    function getAllPzhList(userId, userObj) {
        var myKey, list = [];
        for (myKey in config.trustedList.pzh) {
            if (config.trustedList.pzh.hasOwnProperty(myKey) && myKey !== userId
                && !userObj.getTrustedList("pzh").hasOwnProperty(myKey)) {
                var pzhList = pzhs[myKey].getTrustedList("pzh")[myKey];
                list.push({url:myKey,
                    username:pzhList.friendlyName,
                    email:pzhList.email,
                    nickname: pzhList.nickname });
            }
        }
        return list;
    }

    function hasPzh(userId) {
      return (config.trustList.pzh.hasOwnProperty(userId));
    }

    /**
     *
     * @param conn
     * @return {Boolean}
     */
    function isWebInterface(conn) {
        //TODO: Validate the certificate from the connection data.

        // This could do with being refactor.  In essence, this is the 
        // interface that the PZH exposes to the PZH web interface client.
        var pzhFunctions = {
            "addPzh" : addPzhDetails,
            "refreshPzh" : refreshCert,
            "getAllPzh" : getAllPzhList,
            "hasPzh" : hasPzh
        };
        
        
        if (webInterface === null) {
            webInterface = new pzh_webSession(conn, pzhs,
                hostname,
                config.userPref.ports.provider_webServer,
                config.userPref.ports.provider,
                pzhFunctions);
            conn.id = conn.getPeerCertificate().CN;
        }
        return !!(conn.getPeerCertificate() &&
            conn.getPeerCertificate().subject &&
            conn.getPeerCertificate().subject.CN.indexOf("PzhWS") !== -1 &&
            conn.getPeerCertificate().subjectaltname &&
            conn.getPeerCertificate().subjectaltname.split(":") &&
            conn.getPeerCertificate().subjectaltname.split(":")[1] === hostname); // Verifies if it is Web Interface Certificate
    }

    /**
     *  Server name matches with pzhId in the pzhs object, message will be routed to respective authorization function
     * @param conn
     */
    function handleConnectionAuthorization(conn) {
        if (conn.servername && pzhs[conn.servername]) {
            pzhs[conn.servername].handleConnectionAuthorization(conn);
        } else if (isWebInterface(conn)) {
            logger.log("web interface connected & authorized");
            // Here individual user is not known we have only generic certificate indicating web server
        } else {
            conn.socket.end();
            logger.error("pzh " + conn.servername + " is not registered in the provider");
        }
    }

    /**
     * Handle connection coming from pzh or pzp and forwards request to respective pzh.
     * The mechanism relies on "servername" received from the client.
     * @param conn - Socket information of the client connecting
     */
    function handleConnection(conn) {
        handleConnectionAuthorization(conn); // This is called only when new client connects
        conn.on("data", function (data) {
            if (conn.servername && pzhs[conn.servername]) { // forward message to respective PZH handleData function
                pzhs[conn.servername].handleData(conn, data);
            } else if (isWebInterface(conn)) { // Check is user exists and is currently logged in
                webInterface.handleData(conn, data);
            } else {
                logger.error("pzh  -  " + conn.servername + " is not registered in this provider");
                conn.socket.end();
            }

        });

        conn.on("end", function (err) {
            if (conn.id){
                logger.log(conn.id + " ended connection");
            }
        });

        conn.on("close", function () {
            if (conn.servername && pzhs[conn.servername]) {
                pzhs[conn.servername].removeRoute(conn.id);
            } else {
                logger.log("not registered entity ended connection");
            }
        });

        conn.on("error", function (err) {
            logger.error(conn.servername + " general error " + err.message);
        });
    }


    // Webinos provider APIs exposed to the Zone Web Server

    /**
     * FetchPzh is called from the WebServer to fetch information about Pzh instance
     * @param pzhId - pzhId of the entity connecting to the pzh web server
     * @return {*}: returns pzh instance
     */
    this.fetchPzh = function (pzhId) {
        return pzhs[pzhId];
    };
    /**
     * Refreshes the SNI context of the running PZH. Used during pzh-pzh connection and revoke certificate
     * @param serverName
     * @param options
     */
    function refreshCert(serverName, options) {
        server._contexts.some(function (elem) {
            if (serverName.match(elem[0]) !== null) {
                elem[1] = require("crypto").createCredentials(options).context;
            }
        });
    }

    /**
     *
     * @param callback
     */
    this.startProvider = function (callback) {
        "use strict";
        wUtil.webinosHostname.getHostName(hostname, function (_hostname) {
            hostname = _hostname;
            loadSession(function (status, value) {
                if (status) { // pzh provider TLS server started
                    logger.log("zone provider tls server started");
                    return callback(true, config.userPref);
                } else {
                    logger.error("The personal zone provider TLS server failed to start.  Reason: " + value);
                    return callback(false, value);
                }
            });
        });
    };

    // This keeps pzh running but you cannot find where error occurred
/*     process.on("uncaughtException", function(err) {
         logger.error("uncaught exception " + err.message);
     });*/
};
module.exports = Provider;
