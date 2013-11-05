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
/**
 * Removes a PZP from the PZH
 */
var Pzh_PzpRevoke = function () {
    var PzhObject = this;
    var logger = require("webinos-utilities").webinosLogging(__filename);
    this.revokeCert = function (pzpId, refreshCert) {
        var pzpCert = PzhObject.getSignedCert(pzpId);
        if(PzhObject.revokeClientCert(pzpId, pzpCert)){
            logger.log ("revocation success! " + pzpId + " should not be able to connect anymore ");
            refreshCert (PzhObject.getSessionId(), PzhObject.setConnParam());
            PzhObject.clearConnectedDeviceDetails(pzpId);

            PzhObject.discovery.removeRemoteServiceObjects(pzpId);
            var connDevices = PzhObject.getConnectedDevices();
            if (connDevices.pzp.indexOf(pzpId) !== -1){
                connDevices.pzp.splice(connDevices.pzp.indexOf(pzpId), 1);
            }

            PzhObject.setConnectedDevices(connDevices);
            refreshCert (PzhObject.getSessionId(), PzhObject.setConnParam());
            logger.log("removed pzp "+ pzpId+" details ");
            PzhObject.syncAllPzp("syncRemove",undefined,
                {"trustedList":      PzhObject.getTrustedList(),
                 "crl"        :PzhObject.getCRL(),
                "signedCertificates":PzhObject.getSignedCertificateObj(),
                "serviceCache":PzhObject.getServiceCache(),
                "connectedDevices": connDevices});
            PzhObject.syncAllPzh("syncRemove",undefined,
                    {"trustedList":PzhObject.getTrustedList("pzp"),
                    "serviceCache":PzhObject.getPzhServiceCache(),
                    "connectedDevices": {pzp:connDevices.pzp}});
            return true;
        } else {
            return false;
        }

    };
};
module.exports = Pzh_PzpRevoke;
