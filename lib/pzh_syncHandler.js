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
    PzhObject.syncAllPzh = function(msgType, id, list){
        try {
            if (syncInstance) {
                var address, i, msg;
                var hashList, connectedPzh = PzhObject.getConnectedPzh();
                if (list==="{}")  list = preparePzhSyncList();
                if (msgType === "syncHash")
                    hashList = syncInstance.getObjectHash(list);
                else
                    hashList = list;
                for (i = 0; i < connectedPzh.length; i = i + 1) {
                    address = connectedPzh[i];
                    if (id !== address) {
                        msg =  PzhObject.prepMsg(address, msgType, hashList);
                        PzhObject.sendMessage(msg, address);
                    }
                }
            }
        } catch(err){
            logger.error(err);
        }
    };
    PzhObject.syncAllPzp = function(msgType, id, list){
        try{
            if (syncInstance) {
                var address, msg;
                var hashList, connectedPzp = PzhObject.getConnectedPzp();
                if (!list || list==="{}") list = prepareSyncList();

                if (msgType === "syncHash")
                     hashList = syncInstance.getObjectHash(list);
                else
                    hashList = list;
                for (var i = 0; i < connectedPzp.length; i = i + 1) {
                    address = connectedPzp[i];
                    if (id !== address) {
                        msg = PzhObject.prepMsg(address, msgType, hashList);
                        PzhObject.sendMessage(msg, address);
                    }
                }
            }
        } catch(err){
            logger.error(err);
        }
    }
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
               var msg, list = (PzhObject.getConnectedPzh(id) ?  preparePzhSyncList(): prepareSyncList());
               var contents = syncInstance.sendObjectContents(list, msgReceived);
               if (Object.keys(contents).length !== 0)  {
                   if (PzhObject.checkConnectedPzh(id)) {
                       msg = PzhObject.prepMsg (id, "syncPeerPzh", contents);
                       PzhObject.sendMessage(msg, id);
                   } else {
                       msg = PzhObject.prepMsg (id, "syncPzp", contents);
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
                var list =prepareSyncList();
                var beforeList = syncInstance.getObjectHash(list);
                syncInstance.applyObjectContents(list, receivedMsg);

                //Here list is concatenated with both received and local values
                var checkChanges =  syncInstance.getObjectHash(list);
                var inNeedOfPzhSync = 0, inNeedOfPzpSync = 0;
                var text = "";

                for ( key in list){
                    if (list.hasOwnProperty(key) && checkChanges[key] !== beforeList[key]){
                        if (key === "policy" ) {
                            text += " policy,";
                            PzhObject.updatePolicy(list[key]);
                        } else if (key === "serviceCache" && (JSON.stringify(list[key])!== JSON.stringify(PzhObject.getServiceCache()))){
                            text += " service cache,";
                            PzhObject.storeServiceCache(list[key]);
                        } else if (key === "trustedList" && (JSON.stringify(list[key]) !== JSON.stringify(PzhObject.getTrustedList()))) { // Between PZH and PZH
                            text += " trusted list,";
                            PzhObject.updateTrustedList(list[key]);
                        } else if (key === "connectedDevices" && (JSON.stringify(list["connectedDevices"])!== JSON.stringify(PzhObject.getConnectedDevices()))){
                            text += " connected devices,";
                            PzhObject.setConnectedDevices(list["connectedDevices"]);
                        }
                        // NO Cert and CRL Sync up, as PZH is the one that sends to the PZP
                    }
                }
                if (text!==""){
                    logger.log ("Synchronised with the " + id + " for items "+ text);
                }
                // PZH has been update by PZP, send updates to all....
                var key, newPzpList={},newPzhList={};
                for ( key in list ){
                    if (list.hasOwnProperty(key)){
                        if (( key === "trustedList" || key == "serviceCache" || key === "connectedDevices") &&
                            checkChanges[key]!== beforeList[key]){
                            newPzpList[key] = list[key];
                            inNeedOfPzpSync = 1;
                        }
                        if ((key=== "trustedList" || key === "serviceCache" || key === "connectedDevices") &&
                            checkChanges[key]!== beforeList[key]){
                            if (key === "trustedList" || key === "connectedDevices"){
                                newPzhList[key]= {pzp:list[key].pzp};
                            } else {
                                newPzhList[key] = list[key];
                            }
                            inNeedOfPzhSync = 1;

                        }
                        // NO Cert and CRL Sync up, as PZH is the one that sends to the PZP
                    }
                }

                if (inNeedOfPzhSync == 1){
                    PzhObject.syncAllPzh("syncHash", id, newPzhList);
                }
                if (inNeedOfPzpSync == 1){
                    PzhObject.syncAllPzp("syncHash", id, newPzpList);
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
                var list = {
                    trustedList : PzhObject.getTrustedList(),
                    serviceCache: PzhObject.getServiceCache(),// Send all service cache of the PZH to the PZP...
                    connectedDevices: PzhObject.getConnectedDevices()
                };
                var beforeList = syncInstance.getObjectHash(preparePzhSyncList());
                syncInstance.applyObjectContents(list, receivedMsg);
                var afterList = syncInstance.getObjectHash(list);

                var key, text = "", inNeedOfSync = 0;
                for (key in list){
                    if (list.hasOwnProperty(key) && afterList[key] !== beforeList[key]){
                        if (key == "trustedList" && (JSON.stringify(list[key].pzp)!== JSON.stringify(PzhObject.getTrustedList("pzp")))){
                            text += " pzp trusted list;";

                            PzhObject.updatePzhTrustedList(list["trustedList"]);
                        } else if (key == "serviceCache" && (JSON.stringify(list[key])!== JSON.stringify(PzhObject.getPzhServiceCache()))){
                            text += " pzp service cache;";
                            PzhObject.storeServiceCache(list["serviceCache"]);
                        } else if (key == "connectedDevices"&& (JSON.stringify(list[key].pzp)!== JSON.stringify(PzhObject.getConnectedDevices("pzp")))){
                            text += " pzp online;";
                            PzhObject.setConnectedDevices(list["connectedDevices"], "pzp");
                        }
                    }
                }
                if (text !== "") {
                    logger.log ("Synchronised with the " + id + " for items "+ text);
                }

                // PZH has been update by PZP, send updates to all....
                var newList={};
                for ( key in beforeList ){
                    if (beforeList.hasOwnProperty(key)){
                        if ((key=== "trustedList" || key === "serviceCache" || key === "connectedDevices")
                            && afterList[key]!== beforeList[key]){
                            if (key === "trustedList" || key === "connectedDevices"){
                                newList[key]= {pzp:list[key].pzp};
                            } else {
                                newList[key] = list[key];
                            }
                            inNeedOfSync = 1;
                        }
                    }
                }
                if (inNeedOfSync === 1){
                    PzhObject.syncAllPzh("syncHash", id, newList);
                    PzhObject.syncAllPzp("syncHash", id, list);
                }
                // No active PZP on the PZH that could use this connection, close the connection
                //PzhObject.checkWhetherToKeepConnectionAlive(id);

            }
        } catch(err){
            logger.error("failed syncing "+err + "\nError Stack: "+ new Error().stack);
        }

    }


   this.removeItems = function(id, msg){
       if (msg["connectedDevices"]) {
           var connDevices = PzhObject.getConnectedDevices();
           if (msg["connectedDevices"].pzp)
               connDevices.pzp = msg["connectedDevices"].pzp;
           PzhObject.syncAllPzp("syncRemove", undefined, {"connectedDevices": connDevices});
           PzhObject.setConnectedDevices(connDevices);
       }
   }
};

module.exports = Pzh_Synchronization;
