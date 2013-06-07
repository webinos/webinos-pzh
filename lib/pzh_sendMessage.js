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
var Pzh_SendMessage = function() {
    "use strict";
    var PzhObject = this;
    var wUtil = require("webinos-utilities");
    var logger = wUtil.webinosLogging(__filename);
    /**
     *
     * @param from
     */
    this.sendUpdateAboutConnectedDevices = function(from) {
        var payload = {connectedPzp: Object.keys(PzhObject.getConnectedPzp()),
                       connectedPzh: Object.keys(PzhObject.getConnectedPzh())};
        PzhObject.sendMessageToAllPzh("connectedDevices", payload);
        PzhObject.sendMessageToAllPzp("connectedDevices", payload);
    };

    this.sendMessageToAllPzh = function(type, payload) {
        var connectedPzh = Object.keys(PzhObject.getConnectedPzh());
        connectedPzh.forEach(function(name){
            PzhObject.prepMsg(name, type, payload)
        });
    };
    this.sendMessageToAllPzp = function(type, payload) {
        var connectedPzp = Object.keys(PzhObject.getConnectedPzp());
        connectedPzp.forEach(function(name){
            PzhObject.prepMsg(name, type, payload)
        });
    };
    /**
     * Helper function - prepares prop message to send between entities in webinos framework
     * @param to - Session id of the entity that message is destined to
     * @param status - Webinos command that other end can interpret
     * @param message - Message payload
     * @return {Object} - Message represented in format other end can interpret
     */
    this.prepMsg = function (to, status, message) {
        var msg = {"type":"prop",
            "from"    :PzhObject.getSessionId(),
            "to"      :to,
            "payload" :{"status":status, "message":message}
        };
        PzhObject.sendMessage(msg);
    };

    /**
     * Sends the message over socket to connected endpoints
     * @param message [mandatory]- JSON-RPC message or PROP message send to the PZH/P
     * @param address [mandatory]- SessionId of the connected endpoints
     */
    this.sendMessage = function (message, address) {
        try {
            if (message && address) {
                var jsonString = JSON.stringify (message);
                var buf = wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
                if (PzhObject.checkConnectedPzh(address)) {// If it is connected to pzh it will land here
                    try {
                        PzhObject.getConnectedPzh()[address].pause ();
                        PzhObject.getConnectedPzh()[address].write (buf);
                    } catch (err) {
                        logger.error ("exception in sending message to pzh -" + err);
                    } finally {
                        logger.log ("send to pzh - " + address + " message " + jsonString);
                        PzhObject.getConnectedPzh()[address].resume ();
                    }
                } else if (PzhObject.checkConnectedPzp(address)) {
                    try {
                        PzhObject.getConnectedPzp()[address].pause ();
                        PzhObject.getConnectedPzp()[address].write (buf);
                    } catch (err) {
                        logger.error ("exception in sending message to pzp " + err);
                    } finally {
                        logger.log ("send to pzp - " + address + " message " + jsonString);
                        PzhObject.getConnectedPzp()[address].resume ();
                    }
                } else {// It is similar to PZP connecting to PZH but instead it is PZH to PZH connection
                    logger.log (address + " is not connected either as pzh or pzp");
                }
            } else {
                logger.error ("sendMessage called without proper parameters, message will not be sent");
            }
        } catch(err) {
            logger.error("failed sending message " + err.stack)
        }

    };
}
module.exports = Pzh_SendMessage;
