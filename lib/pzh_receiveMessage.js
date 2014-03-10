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
var PzhReceiveMessage = function(){
    var PzhObject = this;
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging(__filename);

    function checkPzhPzpTrusted(from){
        var splicedAddress= from.split("/");
        if(splicedAddress && splicedAddress.length >= 2){ // Check if PZP is trusted or if . Required as message is from Application address
            return (PzhObject.checkTrustedList(splicedAddress[0]+"/"+splicedAddress[1]) || PzhObject.checkTrustedList(splicedAddress[0]));
        } else {
            return false;
        }
    }

    /**
     * Calls process message to handle incoming message to PZH. This is called by PZH provider
     * @param {Object} conn - Socket connection details of client socket ..
     * @param {Buffer} buffer - Incoming data received from other PZH or PZP
     */
    this.handleData = function (conn, buffer) {
        try {
            if(!logger.id) logger.addId(PzhObject.getSessionId());
            conn.pause ();
            wUtil.webinosMsgProcessing.readJson (PzhObject.getSessionId(), buffer, function (obj) {
                wUtil.webinosMsgProcessing.processedMsg (PzhObject, obj, function (validMsgObj) {
                    logger.log ("received message from " +validMsgObj.from + " msg: "+JSON.stringify(validMsgObj));
                    if ((PzhObject.checkConnectedPzh(validMsgObj.to) || PzhObject.checkConnectedPzp(validMsgObj.to) || (PzhObject.getSessionId() === validMsgObj.to)) ) {
                        if (validMsgObj.type === "prop") {
                            switch (validMsgObj.payload.status) {
                                case "registerServices":
                                    PzhObject.discovery.addRemoteServiceObjects (validMsgObj.payload.message);
                                    break;
                                case "foundServices":
                                    if (PzhObject.checkConnectedPzp(validMsgObj.to)) {
                                        PzhObject.sendMessage (validMsgObj, validMsgObj.to);
                                    }
                                    break;
                                case "findServices":
                                    PzhObject.sendFoundServices (validMsgObj);
                                    break;
                                case "unregServicesReply":
                                    PzhObject.unregisteredServices (validMsgObj);
                                    break;
                                case "syncHash":
                                    PzhObject.synchronization_compareHash(validMsgObj.from, validMsgObj.payload.message);
                                    break;
                                case "syncCompare":
                                    PzhObject.synchronization_findDifference(validMsgObj.from, validMsgObj.payload.message);
                                    break;
                                case "syncPzh":
                                    PzhObject.syncPzp(validMsgObj.from, validMsgObj.payload.message);
                                    break;
                                case "syncPeerPzh":
                                    PzhObject.syncPzh(validMsgObj.from, validMsgObj.payload.message);
                                    break;
                                case "syncRemove":
                                    // New action(s) received from remote entity.
                                    PzhObject.removeItems(validMsgObj.from, validMsgObj.payload.message);
                                    break;
                                case "fetchJS":
                                case "clientJS":
                                    PzhObject.sendMessage(validMsgObj, validMsgObj.to);
                                    break;
                                case "unregisterService":
                                    PzhObject.unregisterService(validMsgObj.payload.message.svId, validMsgObj.payload.message.svAPI);
                                    PzhObject.sendUpdateServiceToAllPzh();
                                    break;
                                case "zoneConnectionAccepted":
                                    PzhObject.notificationManager.addNotification(PzhObject.notificationManager.notifyType.zoneConnectionAccepted, validMsgObj.payload.message);
                                    break;
                                case "permissionRequestResponse":
                                    break;
                                case "actionAck":
                                    // Action(s) have been processed by remote entity.
                                    // Update cache to indicate remote entity has processed these actions.
                                    PzhObject.actionsAcknowledged(validMsgObj);
                                    break;
                                case "actionsReceivePending":
                                    // New action(s) received from remote entity.
                                    PzhObject.receivePendingActions(validMsgObj);
                                    break;

                            }
                        } else {
                            PzhObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
                        }
                    } else {
                        try {
                            function checkIfPzh(id){
                                var breakup = id && id.split("/");
                                return ((breakup.length === 1 && (id === PzhObject.getSessionId())) ? true: false);

                            }
                            function checkIfSameZone(id){
                                var breakup = id && id.split("/");
                                var to = id;
                                if (breakup && breakup.length >= 2){
                                    to = breakup[0]+"/"+breakup[1];
                                }
                                return (breakup && (breakup[0] === PzhObject.getSessionId()) &&
                                       (typeof PzhObject.getConnectedPzp(to)!=="undefined"));
                            }
                            function checkIfOtherZonePzhOrPzp(id){
                                var breakup = id && id.split("/");
                                return (breakup && !PzhObject.checkConnectedPzh(breakup[0]) &&
                                       (breakup[0] !== PzhObject.getSessionId()));
                            }

                            function checkIfToSendPeerPzh(id){
                                var breakup = id && id.split("/");
                                return (breakup && PzhObject.checkConnectedPzh(breakup[0]));
                            }

                            if (checkIfPzh(validMsgObj.to) || checkIfSameZone(validMsgObj.to)) {
                                PzhObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
                            } else if (checkIfOtherZonePzhOrPzp(validMsgObj.to)) {
                                logger.log("Peer PZH detected"+validMsgObj.to)
                                var breakup = validMsgObj.to && validMsgObj.to.split("/");
                                if (PzhObject.checkExternalCertificate(breakup[0])) {// PZH
                                    logger.log("Connection towards PZH "+ breakup[0]+" initiated");
                                    PzhObject.connectOtherPZH(breakup[0], PzhObject.setConnParam());
                                    PzhObject.sendOnConnection("EXTERNAL_HUB_CONNECTED", validMsgObj, breakup[0]);
                                }
                            } else if (checkIfToSendPeerPzh(validMsgObj.to)) {
                                var breakup = validMsgObj.to && validMsgObj.to.split("/");
                                if (breakup)  PzhObject.sendMessage(validMsgObj, breakup[0]);
                            } else {
                                var breakup = validMsgObj && validMsgObj.from && validMsgObj.from.split("/");
                                if (breakup && breakup.length > 0){
                                    var id = breakup[0]
                                    if (breakup && breakup.length >= 2)
                                        id = id + "/"+breakup[1];
                                    var msgid;
                                    if (validMsgObj && validMsgObj.payload && validMsgObj.payload.message)
                                        msgid = validMsgObj.payload.message.id ;
                                    else
                                        msgid = validMsgObj.payload.id ;
                                    var msg = {"type"        :"JSONRPC",
                                               "from"        :PzhObject.getSessionId(),
                                               "to"          :validMsgObj && validMsgObj.resp_to,
                                               "resp_to"     :PzhObject.getSessionId(),
                                               "payload":{"jsonrpc":"2.0",
                                                           "id":msgid,
                                                          "error":{name: "NetworkError",
                                                                   "code":19 ,
                                                                   "message":"Host is unreachable"}}
                                    };
                                    PzhObject.sendMessage(msg, id);
                                }
                            }
                        } catch(err){
                            logger.error(err);
                        }
                    }
                });
            });
        } catch (err) {
            logger.error ("exception in processing received message " + err);
            conn.resume();
        } finally {
            conn.resume ();
        }
    };
};

module.exports = PzhReceiveMessage;
