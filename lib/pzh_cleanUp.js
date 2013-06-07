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
    /**
     * Removes PZH and PZP that has socket disconnect
     * @param id - sessionId
     */
    this.removeRoute = function (id) {
        if(id) {
            logger.log ("removing route for " + id);
            PzhObject.clearConnectedDevice(id);
            PzhObject.discovery.removeRemoteServiceObjects(id);
            PzhObject.startSynchronization();
        }
    };


    /**
     * Delete PZH from the trusted list
     * @param id
     */
    this.removePzh = function(id, refreshCert, callback) {
        // Disconnection is a special case if PZH is already connected..
        if (self.pzh_state.connectedPzh[id]) {
            self.pzh_state.connectedPzh[id].socket.end();
            self.pzh_state.logger.log("connection with "+id+" terminated as user wishes to remove this PZH");
            delete self.pzh_state.connectedPzh[id];
            refreshCert (self.config.metaData.serverName, self.setConnParam());
        }
        if (self.config.trustedList.pzh[id]) {
            delete self.config.trustedList.pzh[id];
            self.config.storeDetails(null, "trustedList", self.config.trustedList);
            //self.config.storeDetails(null, "trustedList", self.config.trustedList);
            self.pzh_state.logger.log("removed pzh "+ id+" from the trusted list ");
            if (self.config.cert.external[id]) {
                delete self.config.cert.external[id];
                self.config.storeDetails(require("path").join("certificates", "external"), "certificates",
                    self.config.cert.external);
                self.pzh_state.logger.log("removed pzh "+ id+" certificate details ");
            }
            for (var key in self.pzh_state.connectedPzp) {
                if (self.pzh_state.connectedPzp.hasOwnProperty(key)) {
                    self.pzh_otherManager.syncStart(key);
                }
            }
            callback(true);
        } else {
            callback(false);
        }
    };
};
module.exports = Pzh_CleanUp;