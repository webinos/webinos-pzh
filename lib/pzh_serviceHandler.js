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
var PzhServiceHandler = function(){
    "use strict";
    var PzhObject = this;
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging(__filename);
    var MessageHandler = require("webinos-messaging").MessageHandler;
    var Discovery = require("webinos-api-serviceDiscovery").Service;
    var rpc = require ("webinos-jsonrpc2");
    var RPCHandler = rpc.RPCHandler;
    var Registry = rpc.Registry;
    var registry, rpcHandler, listenerMap = {};   // holds listeners/callbacks, mostly for pzh internal api
    PzhObject.discovery = [];
    PzhObject.messageHandler=[];

    /**
     * Initialize RPC to enable discovery and rpcHandler
     */
    function initializeRPC() {
        registry   = new Registry ();
        rpcHandler = new RPCHandler (undefined, registry); // Handler for remote method calls.
        rpcHandler.setSessionId (PzhObject.getSessionId());
        PzhObject.discovery = new Discovery (rpcHandler, [registry]);
        registry.registerObject(PzhObject.discovery);
        var serviceCache = wUtil.webinosService.checkForWebinosModules(require("path").join(__dirname, "../node_modules"));
        if (serviceCache !== []) PzhObject.storeServiceCache(serviceCache);
        var syncManager = require("webinos-synchronization");
        if (syncManager) {
            PzhObject.syncInstance = new syncManager.sync();
        }
        wUtil.webinosService.loadServiceModules(PzhObject.getServiceCache(), registry, rpcHandler); // load specified modules
    }

    PzhObject.loadModule = function(name){
        wUtil.webinosService.loadServiceModules(name, registry, rpcHandler); // load specified modules
    };


    /*function updateServiceCache (msg, remove) {
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

        if (PzhObject.checkServiceCache(name)) {
            PzhObject.deleteServiceCache(name);
            return;
        }

        if (!remove) {
            PzhObject.addServiceCache(name);
        }
    }*/
    /**
     * Send services to other connected pzh
     * @param validMsgObj
     */
    this.sendFoundServices = function (validMsgObj) {
        logger.log ("trying to send webinos services from this RPC handler to " + validMsgObj.from + "...");
        var services = PzhObject.discovery.getAllServices(validMsgObj.from);
        var msg = PzhObject.prepMsg(validMsgObj.from, "foundServices", services);
        msg.payload.id = validMsgObj.payload.message.id;
        PzhObject.sendMessage (msg, validMsgObj.from);
        logger.log ("sent " + (services && services.length) || 0 + " Webinos Services from this rpc handler.");
    };

    /**
     * Unregister services
     * @param validMsgObj
     */
    this.unregisteredServices = function (validMsgObj) {
        logger.log ("unregister service");
        if (!validMsgObj.payload.message.id) {
            logger.error ("cannot find callback");
            return;
        }
        listenerMap[validMsgObj.payload.message.id] (validMsgObj.payload.message);
        delete listenerMap[validMsgObj.payload.message.id];
    };

    this.unregisterService = function(validMsgObj) {
        registry.unregisterObject ({id:validMsgObj.payload.message.svId, api:validMsgObj.payload.message.svAPI});
    };

    /**
     *
     */
    this.setMessageHandler_RPC = function () {
        initializeRPC ();
        PzhObject.messageHandler = new MessageHandler (rpcHandler);// handler of all things message
        var messageHandlerSend = function (message, address) {
            "use strict";
            PzhObject.sendMessage (message, address);
        };
        // Setting message handler to work with pzh instance
        PzhObject.messageHandler.setOwnSessionId (PzhObject.getSessionId());
        PzhObject.messageHandler.setSendMessage (messageHandlerSend);
        PzhObject.messageHandler.setSeparator ("/");
    };

    /* Register current services with other PZH
     */
    this.registerServices = function (pzhId) {
        var localServices = PzhObject.discovery.getAllServices(pzhId);
        var msg = PzhObject.prepMsg(pzhId, "registerServices", {services:localServices,from:PzhObject.getSessionId()})
        PzhObject.sendMessage(msg, pzhId);
        logger.log ("sent " + (localServices && localServices.length) || 0 + " webinos services to " + pzhId);
    };


    this.addMsgListener = function (callback) {
        var id = (parseInt ((1 + Math.random ()) * 0x10000)).toString (16).substr (1);
        listenerMap[id] = callback;
        return id;
    };
    /* When new service are registered PZH update other pzh's about update
     */
    this.sendUpdateServiceToAllPzh = function(from) {
        var localServices = PzhObject.discovery.getAllServices(), filteredService=[], key, msg;
        for (key in localServices){
            if(localServices.hasOwnProperty(key) && PzhObject.checkConnectedPzh(localServices[key].serviceAddress)) {
                // Do not sent pzh details to another pzh
            } else {
                filteredService.concat(localServices[key]);
            }
        }
        if(Object.keys(filteredService).length > 0){
            for (key in _parent.pzh_state.connectedPzh) {
                if (key !== from && PzhObject.getConnectedPzh(key)) {
                    msg = PzhObject.prepMsg(key, "registerServices", {services:filteredService,"from":PzhObject.getSessionId()});
                    PzhObject.sendMessage (msg, key);
                    logger.log ("sent " + (filteredService && filteredService.length) || 0 + " webinos services to " + key);
                }
            }
        }
    }
};

module.exports = PzhServiceHandler;