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

    /**
     * Calls process message to handle incoming message to PZH. This is called by PZH provider
     * @param {Object} conn - Socket connection details of client socket ..
     * @param {Buffer} buffer - Incoming data received from other PZH or PZP
     */
    this.handleData = function (conn, buffer) {
        try {
            conn.pause ();
            wUtil.webinosMsgProcessing.readJson (PzhObject.getSessionId(), buffer, function (obj) {
                wUtil.webinosMsgProcessing.processedMsg (PzhObject, obj, function (validMsgObj) {
                    logger.log ("received message" + JSON.stringify (validMsgObj));
                    if (PzhObject.checkTrustedList(validMsgObj.from)) {
                        if (validMsgObj.type === "prop") {
                            switch (validMsgObj.payload.status) {
                                case "registerServices":
                                    PzhObject.discovery.addRemoteServiceObjects (validMsgObj.payload.message);
                                    break;
                                case "findServices":
                                    PzhObject.sendFoundServices (validMsgObj);
                                    break;
                                case "unregServicesReply":
                                    PzhObject.unregisteredServices (validMsgObj);
                                    break;
                                case "syncCompare":
                                    PzhObject.synchronization_findDifference(validMsgObj.from, validMsgObj.payload.message);
                                    break;
                                case "syncUpdate":
                                    PzhObject.synchronization_UpdateHash(validMsgObj.payload.message);
                                    break;
                                case "unregisterService":
                                    PzhObject.unregisterService(validMsgObj.payload.message.svId, validMsgObj.payload.message.svAPI);
                                    PzhObject.sendUpdateServiceToAllPzh();
                                    break;
                            }
                        } else {
                            PzhObject.messageHandler.onMessageReceived (validMsgObj, validMsgObj.to);
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
