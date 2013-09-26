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
    var syncList={};
    var notificationSyncInterval = 5000;

  function scheduleNotificationSync() {
    if (!PzhObject.notificationSyncPending) {
      PzhObject.notificationSyncPending = true;
      PzhObject.notificationSyncTimeout = setTimeout(function() {
        PzhObject.notificationSyncPending = false;
        var list = prepareSyncList();
        PzhObject.synchronizationStartAll("",list);
      }, notificationSyncInterval);
    }
  }

    PzhObject.initializeSyncManager = function(){
        if(!logger.id) logger.addId(PzhObject.getSessionId());
        var syncM = wUtil.webinosSync;
        if (syncM) {
           syncInstance = new syncM.sync();
          PzhObject.notificationSyncPending = false;
          PzhObject.notificationManager = new wUtil.webinosNotifications.NotificationManager(PzhObject);
          PzhObject.notificationManager.on(PzhObject.notificationManager.notifyType.all, function() {
            scheduleNotificationSync();
          });
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
                connectedDevices: {pzh: PzhObject.getConnectedPzh(), pzp : PzhObject.getConnectedPzp()}
            };
            /*var existsSync = require("fs").existsSync || path.existsSync;
            // TODO: Temp disabled policy sync as I do not know whether/what policies are present at PZH and what to Sync with PZP
            if(existsSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"))){
                var policyFile = require("fs").readFileSync(path.join (PzhObject.getWebinosRoot(), "policies", "policy.xml"));
                list["policy"] = policyFile.toString();
            }    */
            if (typeof PzhObject.notificationManager !== "undefined") {
              list["notifications"] = PzhObject.notificationManager.getNotificationsArray();
              list["notificationConfig"] = PzhObject.notificationManager.getConfig();
            }
        }
        return list;
    }

    function preparePzhSyncList(){
        return{"serviceCache":PzhObject.getPzhServiceCache(),
            "connectedDevices": {pzp: PzhObject.getConnectedPzp()}};
    }

    PzhObject.synchronizationStartDelayed = function() {
      scheduleNotificationSync();
    }
    // Triggered after PZP connection
    PzhObject.synchronizationStartAll = function(exceptionAddr, newList){
        if (syncInstance) {
            var connectedPzp = PzhObject.getConnectedPzp();
            for (var i = 0; i < connectedPzp.length; i = i + 1) {
                var address = connectedPzp[i];
                if (address !== exceptionAddr && (JSON.stringify(syncList[address]) !== JSON.stringify(newList))) {
                    PzhObject.sendMessage(PzhObject.prepMsg(address,"syncHash" , newList), address);
                }
            }

            /*var pzhList = {"trustedList":list["trustedList"], "serviceCache":list["serviceCache"]};
            PzhObject.sendMessageToAllPzh("syncHash", syncInstance.getObjectHash(pzhList));*/

        }
    };
    // Triggered after PZP connection
    PzhObject.synchronizationStart = function(to){
        try{
            if (syncInstance) {
                var list = prepareSyncList();
                if(PzhObject.getConnectedPzh(to)) list =  preparePzhSyncList();
                var hash = syncInstance.getObjectHash(list);
                PzhObject.sendMessage(PzhObject.prepMsg(to, "syncHash", hash ), to);
            }
        } catch(err){
            logger.error(err);
        }
    };
    PzhObject.synchronization_compareHash = function(id, receivedMsg) {
        try{
            if (syncInstance){
                var list = prepareSyncList();
                if(PzhObject.getConnectedPzh(id)) list =  preparePzhSyncList();
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
               var list=prepareSyncList();
               if(PzhObject.getConnectedPzh(id)) list =  preparePzhSyncList();
               var contents = syncInstance.sendObjectContents(list, msgReceived);
               if (Object.keys(contents).length !== 0)  {
                   var msg = PzhObject.prepMsg (id, "syncUpdate", contents);
                   PzhObject.sendMessage(msg, id);
               }
               PzhObject.synchronization_update(id, list);
           }
       }catch(err){
           logger.error(err);
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
                if(PzhObject.getConnectedPzh(id)) {
                    list = preparePzhSyncList();
                }
                syncInstance.applyObjectContents(list, receivedMsg);
                var cache =  {
                    trustedList : list.hasOwnProperty("trustedList") && list["trustedList"],
                    crl         : list.hasOwnProperty("crl") &&  list["crl"],
                    externalCertificates:  list.hasOwnProperty("externalCertificates") &&  list["externalCertificates"],
                    signedCertificates:  list.hasOwnProperty("signedCertificates") &&  list["signedCertificates"],
                    serviceCache: list.hasOwnProperty("serviceCache") &&  list["serviceCache"], // Send all service cache of the PZH to the PZP...;
                    connectedDevices: list.hasOwnProperty("connectedDevices") &&  list["connectedDevices"]/*,
                    policy : list.hasOwnProperty("policy") &&  list["policy"]*/
                    ,notifications: list.hasOwnProperty("notifications") && list["notifications"]
                };
                var afterList = syncInstance.getObjectHash(cache);
                for (var key in list){
                    if (list.hasOwnProperty(key) && afterList[key] !== beforeList[key]){
                        if (key === "policy" ) {
                            logger.log("During synchronization, updated with new policy changes");
                            PzhObject.updatePolicy(list[key]);
                            // updated = true; // TODO: Enable this once we can hold previous data...
                        } else if (key === "serviceCache" && JSON.stringify(list[key])!== JSON.stringify(PzhObject.getServiceCache())){
                            logger.log("During synchronization, updated  with new serviceCache");
                            PzhObject.storeServiceCache(list[key]);
                        } else if (key === "trustedList" && JSON.stringify(list[key]) !== JSON.stringify(PzhObject.getTrustedList())) { // Between PZH and PZH
                            logger.log("During synchronization, updated with new trustedList");
                            PzhObject.updateTrustedList(list[key]);
                        } else if (key === "notifications") {
                          if (PzhObject.notificationManager.updateAfterSync(list[key],false)) {
                            logger.log("During synchronization, PZP updated PZH with new notifications");
                          }
                        } else if (key === "notificationConfig") {
                          // Do nothing - PZH owns notification configuration, don't accept changes from PZPs.
                        }
                        // NO Cert and CRL Sync up, as PZH is the one that sends to the PZP
                    }
                }
                logger.log ("Files Synchronised with the " + id);
                // PZH has been update by PZP, send updates to all....
                PzhObject.synchronizationStartAll(id, afterList);
                syncList[id]= afterList;
                // No active PZP on the PZH that could use this connection, close the connection
                //PzhObject.checkWhetherToKeepConnectionAlive(id);
            }
        } catch(err){
            logger.error("failed syncing "+err + "\nError Stack: "+ new Error().stack);
        }

    }
};

module.exports = Pzh_Synchronization;
