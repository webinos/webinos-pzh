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
 * Copyright 2012 - 2013 University of Oxford
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
var wUtil = require("webinos-utilities"),
    logger = wUtil.webinosLogging(__filename) || console,
    util = require('util'),
    pzhTLS = require('./pzhtlsconnection.js');

var PzhAdaptor = exports;

/* There are two main exported functions in this module.  There's 
 *  - "fromWeb" : designed to take input from authenticated web requests and 
 *                forward them to the PZH TLS Server
 *  - "fromWebUnauth" : designed to take input from unauthenticated web requests 
 *                      and forward them to the PZH TLS Server 
 *
 * There are also some convenience functions.
 */

PzhAdaptor.fromWeb = function (user, command, body, cb, id, err) {
    // we've received a request from the web interface over XHR.
    // translate and send to the PZH TLS server
    sendCommand(user, command, body, cb, id, err);
};

PzhAdaptor.fromWebUnauth = function (userEmail, body, cb, err) {
    // we've received a request from the web interface over XHR.
    // translate and send to the PZH TLS server
    //it's not necessarily from a trusted or authenticated user, it's a public
    //request for something.  E.g., for our certificates.
    
    // At the moment we only have one scenario for this.  Certificates.
    switch (body.type) {
        case "getCertificates":
            sendCommand(userEmail, "getCertificates", {}, cb, -1, err);
            break;
        default:
            responseHandler(cb,err).error({"error":"not valid message type"});
    }

};
/**
 * Send a command straight to the PZH TLS server
 * command: command name
 * body: arguments
 * cb : a callback to invoke
 * id : a message ID
 * err : an error callback
 */
function sendCommand(user, command, body, cb, id, err) {
    // this is where we adapt messages to what the PZH TLS Server expects to see.
    // it turns out we don't need to do this.
    // console.log("SendCommand, command = " + util.inspect(command) + ", body = " + util.inspect(body) + ", id: " + util.inspect(id));
    
    if (!body) {
        body = {};
    }
    body["type"] = command;
    //TODO: Turn this into a better piece of message input validation.
    
    // this now just serves as a filter.
    switch (command) {
        case 'addPzh':
        case 'approveFriend':
        case 'authCode':
        case 'checkPzh':
        case 'csrAuthCodeByPzp':
        case 'getAllPzh':
        case 'getCertificates':
        case 'getCrashLog':
        case 'getInfoLog':
        case 'getPzps':       
        case 'getRequestingExternalUser':
        case 'getUserDetails':
        case 'getZoneStatus':
        case 'listAllServices':
        case 'listUnregServices':
        case 'login':
        case 'logout':
        case 'registerService':
        case 'rejectFriend':
        case 'removePzh':
        case 'requestAddFriend':
        case 'requestAddLocalFriend':
        case 'revokePzp':
        case 'storeExternalCert':
        case 'unregisterService':
            pzhTLS.send(user, body, responseHandler(cb, err, id));
            break;
        default:
            responseHandler(cb,err,id).err({"error":"not valid message type - " + command});
            break;
    }
}

// This code takes a pair of response functions, and converts it into a 
// success/error object.
// you can also pass in an express 'res' object for handling server response,
// and it'll default to sending the response by json on that channel.
function responseHandler(cb, errcb, msgid) {
    return {
        err:function (err) {
            logger.log(err);
            err.msgid = msgid;
            if (typeof errcb === "function") {
              errcb(err);
            } if (typeof errcb !== "undefined") {
              errcb.status(500);
              errcb.json(err);
            }
        },
        success: function (val) {
            val.msgid = msgid;
            if (typeof cb === "function") {
                cb(val);
            } else {
                cb.json(val);
            }
        }
    }
}

/* The following are only convenience methods.  They call the 'sendCommand'
 * function with pre-set message names.
 */ 
PzhAdaptor.approveFriendRequest = function (user, externalEmail, cb, err) {
    sendCommand(user, "approveFriend", {"externalEmail":externalEmail}, cb, -1, err);
};

PzhAdaptor.rejectFriendRequest = function (user, externalEmail, cb, err) {
    sendCommand(user, "rejectFriend", {"externalEmail":externalEmail}, cb, -1, err);
};

PzhAdaptor.storeExternalUserCert = function (user, externalEmail, externalPzh, externalCerts, cb, err) {
    sendCommand(user, "storeExternalCert", 
        {"externalEmail":externalEmail, "externalPzh":externalPzh, "externalCerts":externalCerts}, cb, -1, err);
};

PzhAdaptor.requestAddLocalFriend = function(user, externalEmail, cb, err) {
    sendCommand(user, "requestAddLocalFriend", {"externalEmail":externalEmail}, cb, -1, err);
};

PzhAdaptor.checkUserHasPzh = function(user, cb, err) {
    sendCommand(user, "checkPzh", {"user":user}, cb, -1, err);
};

PzhAdaptor.addPzh = function(user, cb, err) {
    sendCommand(user, "addPzh", {"user":user}, cb, -1, err);
};

PzhAdaptor.enrollPzpWithAuthCode = function(user,cb,err) {
    sendCommand(user, "authCode", {}, cb, -1, err);
};
