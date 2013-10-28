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
var Pzh_Synchronization = function (_parent) {
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging (__filename) || console;
    var path = require("path");
    var syncInstance;
    var PzhObject = this;

    PzhObject.initializeSyncManager = function(){
        if(!logger.id) logger.addId(PzhObject.getSessionId());
        var syncM = wUtil.webinosSync;
        if (syncM) {
          syncInstance = new syncM.sync();
        }
    };

    function prepareSyncList() {
        var list = {};
        if (syncInstance) {
            list = {
                trustedList : PzhObject.getTrustedList(),
                crl         : PzhObject.getCRL(),
                externalCertificates: PzhObject.getExternalCertificateObj(),
                signedCertificates: PzhObject.getSignedCertificateObj(),
                serviceCache: PzhObject.getServiceCache(),// Send all service cache of the PZH to the PZP...
                connectedDevices: PzhObject.getConnectedDevices()
            };
            /*var existsSync = require("fs").existsSync || path.existsSync;
            // TODO: Temp disabled policy sync as I do not know whether/what policies are present at PZH and what to Sync with PZP
            if(existsSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"))){
                var policyFile = require("fs").readFileSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"));
                list["policy"] = policyFile.toString();
            }    */
             if (typeof PzhObject.notificationManager !== "undefined") {
               list["notificationConfig"] = PzhObject.notificationManager.getConfig();
             }
        }
        return list;
    }

    function preparePzhSyncList(){
       return{
            "trustedList" : {pzp:PzhObject.getTrustedList("pzp")},
            "serviceCache":PzhObject.getPzhServiceCache(),
            "connectedDevices": {pzp: PzhObject.getConnectedDevices("pzp")}};
    }

    // Triggered after PZP connection
    PzhObject.synchronizationStartAll = function(id){
        if (syncInstance) {
            var address;
            var connectedPzp = PzhObject.getConnectedPzp();
            var pzpList =  syncInstance.getObjectHash(prepareSyncList());
            for (var i = 0; i < connectedPzp.length; i = i + 1) {
                 address = connectedPzp[i];
                if (id !== address) {
                    PzhObject.sendMessage(PzhObject.prepMsg(address,"syncHash", pzpList), address);
                }
            }
            var connectedPzh = PzhObject.getConnectedPzh();
            var pzhList =  syncInstance.getObjectHash(preparePzhSyncList());
            for (i = 0; i < connectedPzh.length; i = i + 1) {
                address = connectedPzh[i];
                if (id !== address) {
                    PzhObject.sendMessage(PzhObject.prepMsg(address,"syncHash" , pzhList), address);
                }
            }
        }
    };
    // Triggered after PZP connection
    PzhObject.synchronizationStart = function(to){
        try{
            if (syncInstance) {
                var list = (PzhObject.getConnectedPzh(to) ?  preparePzhSyncList(): prepareSyncList());
                var hashList = syncInstance.getObjectHash(list) ;
                var msg = PzhObject.prepMsg(to, "syncHash", hashList);
                PzhObject.sendMessage(msg, msg.to);
            }
        } catch(err){
            logger.error(err);
        }
    };
   PzhObject.synchronization_compareHash = function(id, receivedMsg) {
        try{
            if (syncInstance){
                var list = (PzhObject.getConnectedPzh(id) ?  preparePzhSyncList(): prepareSyncList());
                var list_ = syncInstance.compareObjectHash(list, receivedMsg);
                var msg = PzhObject.prepMsg(id, "syncCompare", list_);
                if (list_.length !== 0) PzhObject.sendMessage(msg, id);
            }
        } catch(err) {
            logger.error(err);
        }
    };

    PzhObject.synchronization_findDifference = function(id, msgReceived) {
       try{
           if (syncInstance && msgReceived) {
               var list = (PzhObject.getConnectedPzh(id) ?  preparePzhSyncList(): prepareSyncList());
               var contents = syncInstance.sendObjectContents(list, msgReceived);
               if (Object.keys(contents).length !== 0)  {
                   if (PzhObject.checkConnectedPzh(id)) {
                       var msg = PzhObject.prepMsg (id, "syncPeerPzh", contents);
                       PzhObject.sendMessage(msg, id);
                   } else {
                       var msg = PzhObject.prepMsg (id, "syncPzp", contents);
                       PzhObject.sendMessage(msg, id);
                   }
               }
           }
       }catch(err){
           logger.error(err);
       }
    };
    PzhObject.syncPzp = function(id, receivedMsg) {
        try {
            if (receivedMsg && receivedMsg.payload && receivedMsg.payload.message) {
                receivedMsg = receivedMsg.payload.message;
            }
            if(syncInstance && receivedMsg !== {}) {
                var list = PzhObject.getConnectedPzh(id)? preparePzhSyncList():prepareSyncList();
                var beforeList = syncInstance.getObjectHash(list);
                syncInstance.applyObjectContents(list, receivedMsg);
                var inNeedOfSync = 0;
                var cache =  {
                    trustedList : list.hasOwnProperty("trustedList") && list["trustedList"],
                    crl         : list.hasOwnProperty("crl") &&  list["crl"],
                    externalCertificates:  list.hasOwnProperty("externalCertificates") &&  list["externalCertificates"],
                    signedCertificates:  list.hasOwnProperty("signedCertificates") &&  list["signedCertificates"],
                    serviceCache: list.hasOwnProperty("serviceCache") &&  list["serviceCache"], // Send all service cache of the PZH to the PZP...;
                    connectedDevices: list.hasOwnProperty("connectedDevices") &&  list["connectedDevices"]/*,
                    policy : list.hasOwnProperty("policy") &&  list["policy"]*/
                };

                var afterList = syncInstance.getObjectHash(cache);
                var text = "";

                for ( key in list){
                    if (list.hasOwnProperty(key) && afterList[key] !== beforeList[key]){
                        if (key === "policy" ) {
                            text += " policy,";
                            PzhObject.updatePolicy(list[key]);
                            inNeedOfSync = 1;
                            // updated = true; // TODO: Enable this once we can hold previous data...
                        } else if (key === "serviceCache" && JSON.stringify(list[key])!== JSON.stringify(PzhObject.getServiceCache())){
                            text += " service cache,";
                            PzhObject.storeServiceCache(list[key]);
                            inNeedOfSync = 1;
                        } else if (key === "trustedList" && JSON.stringify(list[key]) !== JSON.stringify(PzhObject.getTrustedList())) { // Between PZH and PZH
                            text += " trusted list,";
                            PzhObject.updateTrustedList(list[key]);
                            inNeedOfSync = 1;
                        } else if (JSON.stringify(list["connectedDevices"])!== JSON.stringify(PzhObject.getConnectedDevices())){
                            text += " connected devices,";
                            PzhObject.setConnectedDevices(list["connectedDevices"]);
                            inNeedOfSync = 1;
                        }
                        // NO Cert and CRL Sync up, as PZH is the one that sends to the PZP
                    }
                }


                logger.log ("Synchronised with the " + id + " for items "+ text);
                // PZH has been update by PZP, send updates to all....
                if (inNeedOfSync === 1){
                    PzhObject.synchronizationStartAll(id);
                }
                // No active PZP on the PZH that could use this connection, close the connection
                //PzhObject.checkWhetherToKeepConnectionAlive(id);

            }
        } catch(err){
            logger.error("failed syncing "+err + "\nError Stack: "+ new Error().stack);
        }

    }

    PzhObject.syncPzh = function(id, receivedMsg) {
        try {
            if (receivedMsg && receivedMsg.payload && receivedMsg.payload.message) {
                receivedMsg = receivedMsg.payload.message;
            }
            if(syncInstance && receivedMsg !== {}) {
                var list = PzhObject.getConnectedPzh(id)? preparePzhSyncList():prepareSyncList();
                var beforeList = syncInstance.getObjectHash(list);
                syncInstance.applyObjectContents(list, receivedMsg);
                var inNeedOfSync = 0, key;
                var cache = {
                    trustedList : list.hasOwnProperty("trustedList") && list["trustedList"],
                    serviceCache: list.hasOwnProperty("serviceCache") &&  list["serviceCache"], // Send all service cache of the PZH to the PZP...;
                    connectedDevices: list.hasOwnProperty("connectedDevices") &&  list["connectedDevices"]
                };
                var afterList = syncInstance.getObjectHash(cache);
                var text = "";
                for (key in list){
                    if (list.hasOwnProperty(key) && afterList[key] !== beforeList[key]){
                        if (key == "trustedList" && (JSON.stringify(list[key].pzp)!== JSON.stringify(PzhObject.getTrustedList("pzp")))){
                            text += " pzp trusted list;";
                            PzhObject.updatePzhTrustedList(list["trustedList"].pzp);
                            inNeedOfSync = 1;
                        } else if (key == "serviceCache" && (JSON.stringify(list[key])!== JSON.stringify(PzhObject.getPzhServiceCache()))){
                            text += "pzp service cache;";
                            PzhObject.storeServiceCache(list["serviceCache"]);
                            inNeedOfSync = 1;
                        } else if (key == "connectedDevices"&& (JSON.stringify(list[key].pzp)!== JSON.stringify(PzhObject.getConnectedDevices("pzp")))){
                            text += " pzp online;";
                            PzhObject.setConnectedDevices(list["connectedDevices"].pzp, "pzp");
                            inNeedOfSync = 1;
                        }
                    }
                }
                logger.log ("Synchronised with the " + id + " for items "+ text);
                // PZH has been update by PZP, send updates to all....
                if (inNeedOfSync === 1){
                    PzhObject.synchronizationStartAll(id);
                }
                // No active PZP on the PZH that could use this connection, close the connection
                //PzhObject.checkWhetherToKeepConnectionAlive(id);

            }
        } catch(err){
            logger.error("failed syncing "+err + "\nError Stack: "+ new Error().stack);
        }

    }
};

module.exports = Pzh_Synchronization;
