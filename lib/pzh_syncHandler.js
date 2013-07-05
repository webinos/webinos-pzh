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
        try {var syncM = require("webinos-synchronization"); } catch(err){logger.error("synchronization manager is missing, vital for trusted list to work")}
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
                certificates: PzhObject.getExternalCertificateObj(),
                serviceCache: PzhObject.getServiceCache()  // Send all service cache of the PZH to the PZP...
            };
            var existsSync = require("fs").existsSync || path.existsSync;
            // TODO: Temp disabled policy sync as I do not know whether/what policies are present at PZH and what to Sync with PZP
            if(existsSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"))){
                var policyFile = require("fs").readFileSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"));
                list["policy"] = policyFile.toString();
            }
        }
        return list;
    }

    // Triggered after PZP connection
    PzhObject.synchronizationStartAll = function(exceptionAddr){
        if (syncInstance) {
            var list = prepareSyncList();
            PzhObject.sendMessageToAllPzp("syncHash",syncInstance.getObjectHash(list) , exceptionAddr);
            /*var pzhList = {"trustedList":list["trustedList"], "serviceCache":list["serviceCache"]};
            PzhObject.sendMessageToAllPzh("syncHash", syncInstance.getObjectHash(pzhList));*/

        }
    };
    // Triggered after PZP connection
    PzhObject.synchronizationStart = function(to){
        if (syncInstance) {
            var list = prepareSyncList();
            if(PzhObject.getConnectedPzh(to)) list =  {"trustedList":list["trustedList"], "serviceCache":list["serviceCache"]};
            PzhObject.sendMessage(PzhObject.prepMsg(to, "syncHash",  syncInstance.getObjectHash(list)), to);
        }
    };
    PzhObject.synchronization_compareHash = function(id, receivedMsg) {
        try{
            if (syncInstance){
                var list = prepareSyncList();
                if(PzhObject.getConnectedPzh(id)) list =  {"trustedList":list["trustedList"], "serviceCache":list["serviceCache"]};
                var list_ = syncInstance.compareObjectHash(list, receivedMsg);
                if (list_.length !== 0) PzhObject.sendMessage(PzhObject.prepMsg(id, "syncCompare", list_), id);
            }
        } catch(err) {
            logger.error(err);
        }
    };

    PzhObject.synchronization_findDifference = function(id, msgReceived) {
        if (syncInstance && msgReceived) {
            var list=prepareSyncList();
            if(PzhObject.getConnectedPzh(id)) list =  {"trustedList":list["trustedList"], "serviceCache":list["serviceCache"]};
            var contents = syncInstance.sendObjectContents(list, msgReceived);
            if (Object.keys(contents).length !== 0)  PzhObject.sendMessage(PzhObject.prepMsg (id, "syncUpdate", contents), id);
            PzhObject.synchronization_update(id, list);
        }
    };
    PzhObject.synchronization_update = function(id, receivedMsg) {
        try {
            if (receivedMsg && receivedMsg.payload && receivedMsg.payload.message) {
                receivedMsg = receivedMsg.payload.message;
            }
            if(syncInstance && receivedMsg !== {}) {
                var list = prepareSyncList();
                var beforeList= syncInstance.getObjectHash(list);
                if(PzhObject.getConnectedPzh(id)) list =  {"trustedList":list["trustedList"], "serviceCache":list["serviceCache"]};
                syncInstance.applyObjectContents(list, receivedMsg);
                var cache =  {
                    trustedList : list.hasOwnProperty("trustedList") && list["trustedList"],
                    crl         : list.hasOwnProperty("crl") &&  list["crl"],
                    // certificates: PzhObject.getExternalCertificateObj(),
                    serviceCache: list.hasOwnProperty("serviceCache") &&  list["serviceCache"], // Send all service cache of the PZH to the PZP...;
                    policy : list.hasOwnProperty("policy") &&  list["policy"]
                };
                var afterList = syncInstance.getObjectHash(cache);
                var updated =false;
                for (var key in list){
                    if (list.hasOwnProperty(key) && afterList[key] !== beforeList[key]){
                        if (key === "policy" ) {
                            logger.log("During synchronization, PZP updated PZH with new policy changes");
                            PzhObject.updatePolicy(list[key]);
                            // updated = true; // TODO: Enable this once we can hold previous data...
                        } else if (key === "serviceCache" && JSON.stringify(list[key])!= JSON.stringify(PzhObject.getServiceCache())){
                            logger.log("During synchronization, PZP updated PZH with new serviceCache");
                            PzhObject.storeServiceCache(list[key]);
                            updated = true;
                        } else if (key === "trustedList" && JSON.stringify(list[key]) != JSON.stringify(PzhObject.getTrustedList())) { // Between PZH and PZH
                            logger.log("During synchronization, PZP updated PZH with new trustedList");
                            PzhObject.updateTrustedList(list[key]);
                            updated = true;
                        }
                        // NO Cert and CRL Sync up, as PZH is the one that sends to the PZP
                    }
                }
                logger.log ("Files Synchronised with the PZP " + id);
                // PZH has been update by PZP, send updates to all....
                if (updated) PzhObject.synchronizationStartAll(id);
                //console.log("PZH CACHE",syncInstance.getObjectHash(prepareSyncList()), PzhObject.getServiceCache());

            }
        } catch(err){
            logger.error("failed syncing "+err + "\nError Stack: "+ new Error().stack);
        }

    }
};

module.exports = Pzh_Synchronization;
