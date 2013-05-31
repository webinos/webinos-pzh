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
var Pzh_RPC = function (_parent) {
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging (__filename) || console;
    var MessageHandler = require("webinos-messaging").MessageHandler;
    var Discovery = require("webinos-api-serviceDiscovery").Service;
    var rpc = require ("webinos-jsonrpc2");
    var RPCHandler = rpc.RPCHandler;
    var Registry = rpc.Registry;
    var path = require ("path");
    var sync;
    this.messageHandler;
    this.listenerMap = {}; // holds listeners/callbacks, mostly for pzh internal api
    this.discovery;
    this.registry;
    this.rpcHandler;
    this.modules;         // holds startup modules
    var self = this;
    try {
        if(require.resolve("webinos-synchronization")){
            sync = require("webinos-synchronization");
        }
    } catch(err){
        logger.log("webinos synchronization module is missing");
    }

    /* When new service are registered PZH update other pzh's about update
     */
    function sendUpdateServiceToAllPzh (from) {
        var localServices = self.discovery.getAllServices(), filteredService=[], key, msg;
        for (key in localServices){
            if(localServices.hasOwnProperty(key) &&
            _parent.pzh_state.connectedPzh.hasOwnProperty(localServices[key].serviceAddress)) {
               // Do not sent pzh details to another pzh
            } else {
               filteredService.concat(localServices[key]);
            }
         }
        if(Object.keys(filteredService).length > 0){
            for (key in _parent.pzh_state.connectedPzh) {
                if (key !== from && _parent.pzh_state.connectedPzh.hasOwnProperty (key)) {
                    msg = _parent.prepMsg(key, "registerServices", {services:filteredService,"from":_parent.pzh_state.sessionId});
                    _parent.sendMessage (msg, key);
                    _parent.pzh_state.logger.log ("sent " + (filteredService && filteredService.length) || 0 + " webinos services to " + key);
                }
            }
        }
    }

    function updateDeviceInfo(validMsgObj) {
        function updateCheckFN(connList, from, fn) {
            for (var key in connList) {
                if (connList.hasOwnProperty(key) && connList[key].friendlyName === fn && key !== from) {
                    // Update PZP that your friendly name is duplicate in PZ.
                    logger.log("sending pzp " + key + " to change friendlyName")
                    fn = fn + "#" + Math.round(Math.random()*100);
                    var msg = _parent.prepMsg(validMsgObj.from, "changeFriendlyName", fn);
                    _parent.sendMessage (msg, validMsgObj.from);
                } else {
                    continue;
                }
            }
            connList[from].friendlyName = fn;
        }
        var i, fn = validMsgObj.payload.message.friendlyName;
        if (_parent.pzh_state.connectedPzh[validMsgObj.from]) {
             updateCheckFN(_parent.pzh_state.connectedPzh, validMsgObj.from, fn);

        } else if (_parent.pzh_state.connectedPzp[validMsgObj.from]) {
            updateCheckFN(_parent.pzh_state.connectedPzp, validMsgObj.from, fn);
        }
        // These are friendlyName... Just for display purpose
        for (i = 0; i < validMsgObj.payload.message.connectedPzp.length; i = i + 1) {
            if(!_parent.pzh_state.connectedPzp.hasOwnProperty(validMsgObj.payload.message.connectedPzp[i].key)) {
                _parent.pzh_state.connectedDevicesToOtherPzh.pzp[validMsgObj.payload.message.connectedPzp[i].key] =
                    validMsgObj.payload.message.connectedPzp[i].friendlyName || undefined;
            }
        }
        for (i = 0; i < validMsgObj.payload.message.connectedPzh.length; i = i + 1) {
            if(!_parent.pzh_state.connectedPzh.hasOwnProperty(validMsgObj.payload.message.connectedPzh[i].key) &&
                validMsgObj.payload.message.connectedPzh[i].key !== _parent.pzh_state.sessionId ) {
                _parent.pzh_state.connectedDevicesToOtherPzh.pzh[validMsgObj.payload.message.connectedPzh[i].key] =
                    validMsgObj.payload.message.connectedPzh[i].friendlyName || undefined;
            }
        }

        _parent.sendUpdateToAll(validMsgObj.from);

    }
    /**
     * Initialize RPC to enable discovery and rpcHandler
     */
    this.initializeRPC = function () {
        self.registry = new Registry ();
        self.rpcHandler = new RPCHandler (undefined, self.registry); // Handler for remote method calls.
        self.rpcHandler.setSessionId (_parent.pzh_state.sessionId);
        self.discovery = new Discovery (self.rpcHandler, [self.registry]);
        self.registry.registerObject (self.discovery);
        var serviceCache = wUtil.webinosService.checkForWebinosModules(path.join(__dirname, "../node_modules"));
        if (serviceCache !== []) {
            _parent.config.serviceCache = serviceCache;
            _parent.config.storeDetails("userData", "serviceCache", _parent.config.serviceCache);
        }
        wUtil.webinosService.loadServiceModules(_parent.config.serviceCache, self.registry, self.rpcHandler); // load specified modules
    };

    /**
     * Send services to other connected pzh
     * @param validMsgObj
     */
    this.sendFoundServices = function (validMsgObj) {
        _parent.pzh_state.logger.log ("trying to send webinos services from this RPC handler to " + validMsgObj.from + "...");
        var services = self.discovery.getAllServices(validMsgObj.from);
        var msg = _parent.prepMsg(validMsgObj.from, "foundServices", services);
        msg.payload.id = validMsgObj.payload.message.id;
        _parent.sendMessage (msg, validMsgObj.from);
        _parent.pzh_state.logger.log ("sent " + (services && services.length) || 0 + " Webinos Services from this rpc handler.");
    };

    /**
     * Unregister services
     * @param validMsgObj
     */
    this.unregisteredServices = function (validMsgObj) {
        _parent.pzh_state.logger.log ("unregister service");
        if (!validMsgObj.payload.message.id) {
            _parent.pzh_state.logger.error ("cannot find callback");
            return;
        }
        self.listenerMap[validMsgObj.payload.message.id] (validMsgObj.payload.message);
        delete self.listenerMap[validMsgObj.payload.message.id];
    };

    /**
     *
     */
    this.setMessageHandler_RPC = function () {
        self.initializeRPC ();
        self.messageHandler = new MessageHandler (self.rpcHandler);// handler of all things message
        var messageHandlerSend = function (message, address) {
            "use strict";
            _parent.sendMessage (message, address);
        };
        // Setting message handler to work with pzh instance
        self.messageHandler.setOwnSessionId (_parent.pzh_state.sessionId);
        self.messageHandler.setSendMessage (messageHandlerSend);
        self.messageHandler.setSeparator ("/");
    };

    /* Register current services with other PZH
     */
    this.registerServices = function (pzhId) {
        var localServices = self.discovery.getAllServices(pzhId);
        var msg = _parent.prepMsg(pzhId, "registerServices", {services:localServices,from:_parent.pzh_state.sessionId})
        _parent.sendMessage(msg, pzhId);
        _parent.pzh_state.logger.log ("sent " + (localServices && localServices.length) || 0 + " webinos services to " + pzhId);
    };


    this.addMsgListener = function (callback) {
        var id = (parseInt ((1 + Math.random ()) * 0x10000)).toString (16).substr (1);
        this.listenerMap[id] = callback;
        return id;
    };

    this.syncStart = function (_pzpId) {
         if (sync) {
            var policy, policyPath, list, result, myKey, msg;
            policyPath = path.join (_parent.config.metaData.webinosRoot, "policies", "policy.xml");
            sync.parseXMLFile (policyPath, function (value) {
                list = {trustedList:_parent.config.trustedList,
                    crl:_parent.config.crl.value,
                    cert:_parent.config.cert.external,
                    policy:value};
                result = sync.getFileHash (list);

                for (myKey in _parent.pzh_state.connectedPzp) {
                    if (_parent.pzh_state.connectedPzp.hasOwnProperty (myKey)) { // Sync with everyone.
                        msg = _parent.prepMsg (myKey, "sync_hash", result);
                        _parent.sendMessage (msg, myKey);
                    }
                }
            });
        }
    };

    this.syncUpdateHash = function (_pzpId, receivedMsg) {
        if(sync) {
            var result = sync.syncFileMissing (receivedMsg);
            if (Object.keys (result).length >= 1) {
                if (result["trustedList"]) {
                    _parent.config.metaData.trustedList = result["trustedList"];
                    _parent.config.storeDetails(null, "trustedList",_parent.config.metaData.trustedList);
                }
                if (result["crl"]) {
                    _parent.config.crl.value = receivedMsg[msg];
                    _parent.config.storeDetails(null, "crl", _parent.config.crl);
                }
                if (result["cert"]) {
                    //_parent.config.cert.external = receivedMsg[msg];
                    //_parent.config.storeCertificate(_parent.config.cert.external, "external");
                }
                var msg = _parent.prepMsg (_pzpId, "update_hash", result);
                _parent.sendMessage (msg, _pzpId);
            }
            else {
                logger.log ("Nothing to synchronize with the PZP " + _pzpId)
            }
        }
    };

    /**
     * Process incoming messages, message of type prop are only received while session is established. Rest of the time it
     * is usually RPC messages
     * @param {Object} msgObj - A message object received from other PZH or PZP.
     */
    this.processMsg = function (msgObj) {
        try {
            wUtil.webinosMsgProcessing.processedMsg (this, msgObj, function (validMsgObj) {
                _parent.pzh_state.logger.log ("received message" + JSON.stringify (validMsgObj));
                if (validMsgObj.type === "prop") {
                    switch (validMsgObj.payload.status) {
                        case "registerServices":
                            self.discovery.addRemoteServiceObjects (validMsgObj.payload.message);
                            sendUpdateServiceToAllPzh(validMsgObj.from);
                            break;
                        case "findServices":
                            self.sendFoundServices (validMsgObj);
                            break;
                        case "unregServicesReply":
                            self.unregisteredServices (validMsgObj);
                            break;
                        case "sync_compare":
                            self.syncUpdateHash (validMsgObj.from, validMsgObj.payload.message);
                            break;
                        case "unregisterService":
                            self.registry.unregisterObject ({id:validMsgObj.payload.message.svId, api:validMsgObj.payload.message.svAPI});
                            sendUpdateServiceToAllPzh ();
                            break;
                        case "update":
                            updateDeviceInfo(validMsgObj);
                            break;
                    }
                } else {
                    try {
                        self.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
                    } catch (err2) {
                        _parent.pzh_state.logger.error ("error processing message in messaging manager - " + err2.message);
                    }
                }
            });
        } catch(err){
            logger.error(err);
        }
    }
};

module.exports = Pzh_RPC;
