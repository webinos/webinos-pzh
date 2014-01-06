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

var Pzh_CleanUp = function() {
    "use strict";
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging(__filename);
    var PzhObject = this;

    PzhObject.checkWhetherToKeepConnectionAlive = function(id){
      if (Object.keys(PzhObject.getConnectedPzp()).length === 0){  // no pzps are currently available, disconnect the connection
          PzhObject.removeRoute(id);
      }
    };
    /**
     * Removes PZH and PZP that has socket disconnect
     * @param id - sessionId
     */
    this.removeRoute = function (id) {
        if(id && (PzhObject.checkConnectedPzh(id) || PzhObject.checkConnectedPzp(id))) {
            logger.log ("removing route for " + id);
            PzhObject.clearConnectedDeviceDetails(id);
            PzhObject.discovery.removeRemoteServiceObjects(id);
            var connDevices = PzhObject.getConnectedDevices();
            if (connDevices.pzh.indexOf(id) !== -1){
                connDevices.pzh.splice(connDevices.pzh.indexOf(id), 1);
                for(var i=0; i < connDevices.pzp.length; i++){
                    var device = connDevices.pzp[i] && connDevices.pzp[i].split("/");
                    if (id == device[0]){
                        connDevices.pzp.splice(i, 1);
                    }

                }
            }
            if (connDevices.pzp.indexOf(id) !== -1){
                connDevices.pzp.splice(connDevices.pzp.indexOf(id), 1);
            }

            PzhObject.syncAllPzp("syncRemove",undefined, {"connectedDevices": connDevices});
            PzhObject.syncAllPzh("syncRemove",undefined, {"connectedDevices": {pzp:connDevices.pzp}});
            PzhObject.setConnectedDevices(connDevices);
        }
    };


    /**
     * Delete PZH from the trusted list
     * @param id
     */
    this.removePzh = function(id, refreshCert, callback) {
        if(id){
            // Disconnection is a special case if PZH is already connected..
            logger.log("connection with "+id+" terminated as user wishes to remove this PZH");
            PzhObject.removeTrustedList(id);
            PzhObject.removeExternalCertificate(id);
            PzhObject.clearConnectedDeviceDetails(id);
            PzhObject.discovery.removeRemoteServiceObjects(id);
            PzhObject.storeServiceCache(PzhObject.discovery.getAllServices());
            var connDevices = PzhObject.getConnectedDevices();
            if (connDevices.pzh.indexOf(id) !== -1){
                connDevices.pzh.splice(connDevices.pzh.indexOf(id), 1);
                for(var i=0; i < connDevices.pzp.length; i++){
                    var device = connDevices.pzp[i] && connDevices.pzp[i].split("/");
                    if (id == device[0]){
                        connDevices.pzp.splice(i, 1);
                    }

                }
            }
            PzhObject.setConnectedDevices(connDevices);
            refreshCert (PzhObject.getSessionId(), PzhObject.setConnParam());
            logger.log("removed pzh "+ id+" details ");
            PzhObject.syncAllPzp("syncRemove",undefined,
                                {"trustedList": PzhObject.getTrustedList(),
                                 "externalCertificates":PzhObject.getExternalCertificateObj(),
                                 "serviceCache":PzhObject.getServiceCache(),
                                 "connectedDevices": connDevices});
            callback(true);
        } else {
            callback(false);
        }
    };
    /**
     * Delete PZH from the trusted list
     * @param id
     */
    this.removePzp = function(id, refreshCert, callback) {
        if(id){
            // Disconnection is a special case if PZH is already connected..
            logger.log("connection with "+id+" terminated as user wishes to remove this PZP");
            PzhObject.removeTrustedList(id);
            PzhObject.removeSignedCertificate(id);
            PzhObject.clearConnectedDeviceDetails(id);
            PzhObject.discovery.removeRemoteServiceObjects(id);
            PzhObject.storeServiceCache(PzhObject.discovery.getAllServices());
            var connDevices = PzhObject.getConnectedDevices();
            if (connDevices.pzh.indexOf(id) !== -1){
                connDevices.pzh.splice(connDevices.pzh.indexOf(id), 1);
                for(var i=0; i < connDevices.pzp.length; i++){
                    var device = connDevices.pzp[i] && connDevices.pzp[i].split("/");
                    if (id == device[0]){
                        connDevices.pzp.splice(i, 1);
                    }

                }
            }
            PzhObject.setConnectedDevices(connDevices);
            refreshCert (PzhObject.getSessionId(), PzhObject.setConnParam());
            logger.log("removed pzp "+ id+" details ");
            PzhObject.syncAllPzp("syncRemove",undefined,
                     {"trustedList": PzhObject.getTrustedList(),
                    "externalCertificates":PzhObject.getExternalCertificateObj(),
                    "serviceCache":PzhObject.getServiceCache(),
                    "connectedDevices": connDevices});
            callback(true);
        } else {
            callback(false);
        }
    };
};
module.exports = Pzh_CleanUp;
