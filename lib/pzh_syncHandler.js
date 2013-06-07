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
    var  syncInstance;
    var PzhObject = this;

    // Triggered after PZP connection
    this.synchronizationStart = function(){
        if (syncInstance) {
            prepareSyncList(function(list){
                 PzhObject.sendMessageToAllPzp("syncHash", syncInstance.getObjectHash(list));
            });
        }
    };

    this.synchronization_findDifference = function(id, msgReceived) {
        if (syncInstance && msgReceived) {
            prepareSyncList(function(list) {
                PzhObject.prepMsg (id, "updateHash", syncInstance.sendObjectContents(list, msgReceived));
                PzhObject.synchronization_UpdateHash(list);
            });
        }
    };

    this.synchronization_UpdateHash = function(receivedMsg) {
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
                                PzhObject.discovery.addRemoteServiceObjects(list[key]);
                                PzpObject.updateStoreServiceCache(list[key]);
                            }
                            // NO Cert and CRL Sync up, as PZH is the one that
                        }
                    }
                    logger.log ("Files Synchronised with the PZH");
                }
            });
        }
    };

    function prepareSyncList(callback) {
        if (syncInstance) {
            var list = {
                trustedList : PzhObject.getTrustedList(),
                crl         : PzhObject.getPzhCRL(),
                certificates: PzhObject.getExternalCertificate(),
                serviceCache:self.discovery.getAllServices()  // Send all service cache of the PZH to the PZP...
            };
            var existsSync = require("fs").existsSync || path.existsSync;
            // TODO: Temp disabled policy sync as I do not know whether/what policies are present at PZH and what to Sync with PZP
            if(existsSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"))){
                var policyFile = require("fs").readFileSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"));
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

module.exports = Pzh_Synchronization;
