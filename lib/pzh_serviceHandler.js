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
    var MessageHandler = wUtil.webinosMessaging.MessageHandler;
    var Discovery = wUtil.webinosServiceDisco.Service;
    var rpc = require ("webinos-jsonrpc2");
    var RPCHandler = rpc.RPCHandler;
    var Registry = rpc.Registry;
    var registry, rpcHandler, listenerMap = {};   // holds listeners/callbacks, mostly for pzh internal api
    PzhObject.discovery = [];
    PzhObject.messageHandler=[];
    var ownModules;

    /**
     * Initialize RPC to enable discovery and rpcHandler
     */
    function initializeRPC() {
        try {
            registry   = new Registry ();
            rpcHandler = new RPCHandler (undefined, registry); // Handler for remote method calls.
            rpcHandler.setSessionId (PzhObject.getSessionId());
            PzhObject.discovery = new Discovery (rpcHandler, [registry]);
            registry.registerObject(PzhObject.discovery);
            PzhObject.initializeSyncManager();
            ownModules = wUtil.webinosService.checkForWebinosModules(require("path").join(__dirname, "../node_modules"), require("path").join(PzhObject.getMetaData("webinosRoot"), "userData"));
            for (var i =0 ; i < ownModules.length; i = i + 1){
                if (ownModules[i].name === 'webinos-api-test'){
                    ownModules[i].instances[0].params.num = '42';
                }
            }
            wUtil.webinosService.loadServiceModules(ownModules, registry, rpcHandler); // load specified modules
        } catch(err){
            logger.error(err);
        }


    }

    PzhObject.getServices= function() {
        return PzhObject.discovery.getRegisteredServices();
    };

    PzhObject.loadModule = function(name){
        wUtil.webinosService.loadServiceModules(name, registry, rpcHandler); // load specified modules
    };

    /**
     * Send services to other connected pzh
     * @param validMsgObj
     */
    this.sendFoundServices = function (validMsgObj) {
        function checkIfConnectedPzh(id){
            id = id.split("/");
            return (id && PzhObject.getConnectedPzh(id[0]));
        }
        logger.log ("trying to send webinos services from this RPC handler to " + validMsgObj.from + "...");
        var services = PzhObject.getServiceCache();//PzhObject.discovery.getAllServices(validMsgObj.from);
        var acc = [];
        for (var i = 0 ; i < services.length; i = i + 1){
            if(PzhObject.checkConnectedPzp(services[i].serviceAddress) ||
               PzhObject.checkConnectedPzh(services[i].serviceAddress) ||
               (services[i].serviceAddress === PzhObject.getSessionId()) ||
                PzhObject.checkConnectedDevices(services[i].serviceAddress) ||
                checkIfConnectedPzh(services[i].serviceAddress)){
                acc.push(services[i]);
            }
        }
        var msg = PzhObject.prepMsg(validMsgObj.from, "foundServices", acc);
        msg.payload.id = validMsgObj.payload.message.id;
        if (PzhObject.checkConnectedPzh(validMsgObj.from) || PzhObject.checkConnectedPzp(validMsgObj.from))
            PzhObject.sendMessage (msg, validMsgObj.from);
        else{
            var id = validMsgObj.from && validMsgObj.from.split("/");
            PzhObject.sendMessage (msg, id[0]);
        }
        logger.log ("sent " + (acc && acc.length) || 0 );
        logger.log(" Webinos Services from this rpc handler. to "+validMsgObj.from);
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
        if(!logger.id) logger.addId(PzhObject.getSessionId());
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
    PzhObject.addRemoteServices = function(services){
        PzhObject.discovery.addRemoteServiceObjects(services);
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
