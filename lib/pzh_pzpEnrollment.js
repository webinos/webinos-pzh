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
var Pzh_pzpEnroll = function () {
    var PzhObject = this;
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging(__filename);
    /**
     * Adds new PZP certificate. This is triggered by client, which sends its csr certificate and PZH signs
     * certificate and return backs a signed PZP certificate.
     * @param {Object} messageReceived It its is an object holding received message.
     */
    this.addNewPZPCert = function (messageReceived, refreshCert) {
        try {
            var friendlyName;
            if(!logger.id) {
                logger.addId(PzhObject.getSessionId());
            }

            // 36 because id start with PZP:
            var pzpId = PzhObject.getSessionId() +"/"+ messageReceived.message.from, msg, randId;
            if (PzhObject.checkRevokedCert(pzpId)) {
                msg = PzhObject.prepMsg(pzpId, "error", "pzp was previously revoked");
                return msg;
            }

            if(!messageReceived.message.csr) {
                msg = PzhObject.prepMsg(messageReceived.message.from, "error", "message without certificate sign request from PZP.. cannot sign");
                return msg;
            }

            // TODO: If PZP length is greater than 34, then random generation should not increase the length... This could potentially create a loop
            if (PzhObject.checkTrustedList(pzpId)) {
                // Either PZP is already registered or else there is a name clash,,
                // Lets assume there is name clash
                randId = Math.round((Math.random() * 100));
                if (pzpId > 34) {
                    pzpId.substring(0, 34);
                }
                pzpId = pzpId + "_" +randId;
                if (PzhObject.checkTrustedList(pzpId)) {
                    return PzhObject.addNewPzpCert(messageReceived, refreshCert);
                } else {
                    msg = PzhObject.prepMsg(messageReceived.message.from, "pzpId_Update",
                                            messageReceived.message.from+"_"+randId);
                    return msg;
                }
            }

            var rFriendlyName= PzhObject.getFriendlyName() +" "+ messageReceived.message.friendlyName;
            friendlyName = (!PzhObject.checkFriendlyName(rFriendlyName)) ?rFriendlyName: (rFriendlyName+ (Math.round(Math.random()*100)));

            if(PzhObject.signStorePzpCertificate(pzpId, friendlyName, messageReceived.message.csr)){
                // Add PZP in list of master certificates as PZP will sign connection certificate at its end.
                refreshCert(PzhObject.getSessionId(), PzhObject.setConnParam());
                // Send signed certificate and master certificate to PZP
                var payload = {
                    "clientCert"  :PzhObject.getSignedCert(pzpId),
                    "masterCert"  :PzhObject.getMasterCertificate(),
                    "masterCrl"   :PzhObject.getCRL(),
                    "friendlyName":PzhObject.getFriendlyName(),
                    "pzpFriendlyName": friendlyName,
                    "serverPort"  :PzhObject.getWebinosPorts("provider"),
                    "webAddress"  :PzhObject.getWebServerAddress()
                };
                return PzhObject.prepMsg(pzpId,"signedCertByPzh", payload);

            } else {
                return PzhObject.prepMsg(messageReceived.message.from, "error", "failed signing client certificate");
            }
        } catch (err) {
            logger.error ("error signing client certificate" + err);
            return PzhObject.prepMsg(messageReceived.message.from, "error", err.message);
        }
    };
};

module.exports = Pzh_pzpEnroll;
