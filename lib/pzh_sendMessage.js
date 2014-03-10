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
        var payload = {connectedPzp: PzhObject.getConnectedPzp(),
                       connectedPzh: PzhObject.getConnectedPzh()};
        PzhObject.sendMessageToAllPzh("connectedDevices", payload);
        PzhObject.sendMessageToAllPzp("connectedDevices", payload);
    };

    this.sendMessageToAllPzh = function(type, payload) {
        PzhObject.getConnectedPzh().forEach(function(name){
            PzhObject.sendMessage(PzhObject.prepMsg(name, type, payload), name);
        });
    };
    this.sendMessageToAllPzp = function(type, payload, exceptionAddr) {
        PzhObject.getConnectedPzp().forEach(function(name){
            if (name !== exceptionAddr) PzhObject.sendMessage(PzhObject.prepMsg(name, type, payload), name);
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
        return {"type":"prop",
            "from"    :PzhObject.getSessionId(),
            "to"      :to,
            "payload" :{"status":status, "message":message}
        };
    };

    this.isConnected = function(address){
        return (PzhObject.checkConnectedPzh(address) || PzhObject.checkConnectedPzp(address))
    }
    function isSameZonePzp(address){
        var pzpId = address.split("/");
        return (pzpId ? (pzpId[0] === PzhObject.getSessionId()) : false);
    }

    this.sendOnConnection = function(connectionType, message, address) {
      var connectionHandler = function(zoneId) {
        if (zoneId === address) {
          PzhObject.sendMessage(message, address);
          PzhObject.removeListener(connectionType, connectionHandler);
        }
      };
      PzhObject.on(connectionType, connectionHandler);
    }

    /**
     * Sends the message over socket to connected endpoints
     * @param message [mandatory]- JSON-RPC message or PROP message send to the PZH/P
     * @param address [mandatory]- SessionId of the connected endpoints
     */
    this.sendMessage = function (message, address) {
        try {
            if(!logger.id) logger.addId(PzhObject.getSessionId());
            if (message && address) {
                var jsonString = JSON.stringify (message);
                var buf = wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
                if (this.isConnected(address)) {
                    if (PzhObject.checkConnectedPzh(address)) {// If it is connected to pzh it will land here
                        try {
                            PzhObject.getConnectedPzh(address).pause ();
                            PzhObject.getConnectedPzh(address).write (buf);
                        } catch (err) {
                            logger.error ("exception in sending message to pzh -" + err);
                        } finally {
                            logger.log ("send to pzh - " + address + "  - Msg: "+jsonString);// + " message " + jsonString);
                            PzhObject.getConnectedPzh(address).resume ();
                        }
                    } else if (PzhObject.checkConnectedPzp(address)) {
                        try {
                            PzhObject.getConnectedPzp(address).pause ();
                            PzhObject.getConnectedPzp(address).write (buf);
                        } catch (err) {
                            logger.error ("exception in sending message to pzp " + err);
                        } finally {
                            logger.log ("send to pzp - " + address + " - Msg: "+jsonString);// + " message " + jsonString);
                            PzhObject.getConnectedPzp(address).resume ();
                        }
                    }
                } else {// It is similar to PZP connecting to PZH but instead it is PZH to PZH connection
                   if (PzhObject.getExternalCertificate(address)){// PZH
                       PzhObject.connectOtherPZH(address, PzhObject.setConnParam());
                       PzhObject.sendOnConnection("EXTERNAL_HUB_CONNECTED",message, address);
                   } else if (isSameZonePzp(address)) {
                       // Try DNS lookup i.e. search PZP is in same network
                       var to = address.split("/");
                       require("dns").lookup(to[1], function(err, address){
                           if (err){ // connect at last IP address
                               var details = PzhObject.getTrustedList(address);
                               require("http").get("http://"+details.remoteAddress+":8080/connectPzh", function(res){
                                   if (res.statusCode === 200) {
                                       logger.log("Message sent to the PZP");
                                   }
                               }).on("error", function(err){
                                    logger.error(err); // To use ICE
                               });
                           } else {// Obtained address
                               require("http").get("http://"+address+":8080/connectPzh", function(res){
                                   if (res.statusCode === 200) {
                                       logger.log("Message sent to the PZP");
                                   }
                               }).on("error", function(err){
                                   details = PzhObject.getTrustedList(address);
                                   require("http").get("http://"+details.remoteAddress+":8080/connectPzh", function(res){
                                       if (res.statusCode === 200) {
                                           logger.log("Message sent to the PZP");
                                       }
                                   }).on("error", function(err){
                                       logger.error("Device is Offline");
                                        // TODO: Send API message failed
                                   });
                               });
                           }
                       });
                       PzhObject.sendOnConnection("PZP_CONNECTED",message, address);
                   }
                }
            } else {
                logger.error ("sendMessage called without proper parameters, message will not be sent " + new Error().stack);
                logger.error(message);
                logger.error(address);
            }
        } catch(err) {
            logger.error("failed sending message " + err.stack)
        }

    };
}
module.exports = Pzh_SendMessage;
