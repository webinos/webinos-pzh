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
        if(id) {
            logger.log ("removing route for " + id);
            PzhObject.clearConnectedDeviceDetails(id);
            //PzhObject.synchronizationStartAll();
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
            PzhObject.removeRoute(id);
            refreshCert (PzhObject.getSessionId(), PzhObject.setConnParam());
            logger.log("removed pzh "+ id+" details ");
            callback(true);
        } else {
            callback(false);
        }
    };
};
module.exports = Pzh_CleanUp;