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
    var  syncInstance;
    this.messageHandler;
    this.listenerMap = {}; // holds listeners/callbacks, mostly for pzh internal api
    this.discovery;
    this.registry;
    this.rpcHandler;
    this.modules;         // holds startup modules
    var self = this;

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
        var serviceCache = wUtil.webinosService.checkForWebinosModules();
        if (serviceCache !== []) {
            _parent.config.serviceCache = serviceCache;
            _parent.config.storeDetails("userData", "serviceCache", _parent.config.serviceCache);
        }
        var syncManager = require("webinos-synchronization");
        if (syncManager) {
            syncInstance = new syncManager.sync();
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

    // Triggered after PZP connection
    this.synchronizationStart = function(id){
        if (syncInstance) {
            prepareSyncList(function(list){
                var syncList = syncInstance.getObjectHash(list);
                for (var key in _parent.pzh_state.connectedPzp){ // Send update to every connected PZP
                    var msg = _parent.prepMsg (key, "syncHash", syncList);
                    _parent.sendMessage (msg, key);
                }
            });
        }
    };

    function synchronization_findDifference(id, msgReceived) {
        if (syncInstance && msgReceived) {
            prepareSyncList(function(list) {
                var msg = _parent.prepMsg (id, "updateHash", syncInstance.sendObjectContents(list, msgReceived));
                _parent.sendMessage (msg, id);
                synchronization_UpdateHash(list);
            });
        }
    }

    function synchronization_UpdateHash(receivedMsg) {
        if(syncInstance) {
            prepareSyncList(function(list) {
                var result = syncInstance.applyObjectContents(list, receivedMsg);
                if (result){
                    for (var key in receivedMsg){
                        if (receivedMsg.hasOwnProperty(key)){
                            if (key === "policy") {
                                logger.log("During synchronization, PZP updated PZH with new policy changes");
                                _parent.config.storeDetails(path.join("policies", "policy", list[key]));
                            } else if (key === "serviceCache"){
                                logger.log("During synchronization, PZP updated PZH with new serviceCache");
                                self.discovery.addRemoteServiceObjects(list[key]);
                                _parent.config.storeDetails(path.join("userData", "serviceCache", list[key]));
                            }
                            // NO Cert and CRL Sync up, as PZH is the one that
                        }
                    }
                    logger.log ("Files Synchronised with the PZH");
                }
            });
        }
    }

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
                        case "syncCompare":
                            synchronization_findDifference(validMsgObj.from, validMsgObj.payload.message);
                            break;
                        case "syncUpdate":
                            synchronization_UpdateHash(validMsgObj.payload.message);
                            break;
                        case "unregisterService":
                            self.registry.unregisterObject ({id:validMsgObj.payload.message.svId, api:validMsgObj.payload.message.svAPI});
                            sendUpdateServiceToAllPzh ();
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
    };

    function prepareSyncList(callback) {
        if (syncInstance) {
            var list = {
                trustedList : _parent.config.trustedList,
                crl         : _parent.config.cert.crl.value,
                certificates:_parent.config.cert.external,
                serviceCache:self.discovery.getAllServices()  // Send all service cache of the PZH to the PZP...
            };
            var existsSync = require("fs").existsSync || path.existsSync;
            // TODO: Temp disabled policy sync as I do not know whether/what policies are present at PZH and what to Sync with PZP
            if(existsSync(path.join (_parent.config.metaData.webinosRoot, "policies", "policy.xml"))){
                var policyFile = require("fs").readFileSync(path.join (_parent.config.metaData.webinosRoot, "policies", "policy.xml"));
                require("webinos-synchronization").parseXML (policyFile.toString(), function (JSONPolicies) {
                    list["policy"] = JSONPolicies["policy"];
                    callback(list);
                });
            } else {
                callback(list);
            }
        }
    }

};

module.exports = Pzh_RPC;
