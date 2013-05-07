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

PzhAdaptor.fromWeb = function (user, body, cb, err) {
    // we've received a request from the web interface over XHR.
    // translate and send to the PZH TLS server
    if (typeof(body.payload) === 'undefined') {
        sendCommand(user, body.cmd, cb, err);
    } else {
        sendCommand(user, body.payload, cb, err);
    }
};

PzhAdaptor.fromWebUnauth = function (userEmail, body, cb, err) {
    // we've received a request from the web interface over XHR.
    // translate and send to the PZH TLS server
    //it's not necessarily from a trusted or authenticated user, it's a public
    //request for something.  E.g., for our certificates.
    
    // At the moment we only have one scenario for this.  Certificates.
    switch (body.type) {
        case "getCertificates":
            sendCommandEasy(userEmail, "getCertificates", {}, cb, err);
            break;
        default:
            responseHandler(cb,err).error({"error":"not valid message type"});
    }

};

function sendCommandEasy(user, command, options, cb, err) {
    if (options === null || options === undefined) { 
        var options = {};
    }
    options.status = command;
    sendCommand(user, options, cb, err);
}

function sendCommand(user, body, cb, err) {
    // this is where we adapt messages to what the PZH TLS Server expects to see.
    // it turns out we don't need to do this.
    body["type"] = body.status;
    delete body.status;
    
    //TODO: Turn this into a better piece of message input validation.
    
    // this now just serves as a filter.
    switch (body.type) {
        case 'addPzh':
        case 'approveFriend':
        case 'approveUser':
        case 'authCode':
        case 'checkPzh':
        case 'csrAuthCodeByPzp':
        case 'getAllPzh':
        case 'getCertificates':
        case 'getCrashLog':
        case 'getExpectedExternal':
        case 'getInfoLog':
        case 'getPzps':       
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
            pzhTLS.send(user, body, responseHandler(cb, err));
            break;
        default:
            responseHandler(cb,err).err({"error":"not valid message type - " + body.type});
            break;
    }
}

// This code takes a pair of response functions, and converts it into a 
// success/error object.
// you can also pass in an express 'res' object for handling server response,
// and it'll default to sending the response by json on that channel.
function responseHandler(cb, errcb) {
    return {
        err:function (err) {
            logger.log(err);
            if (typeof errcb === "function") {
              errcb(err);
            } if (typeof errcb !== "undefined") {
              errcb.status(500);
              errcb.json(err);
            }
        },
        success: function (val) {
            if (typeof cb === "function") {
                cb(val);
            } else {
                cb.json(val);
            }
        }
    }
}

/* The following are only convenience methods.  They call the 'sendCommandEasy'
 * function with pre-set message names.
 */

PzhAdaptor.getZoneStatus = function (user, cb, err) {
    sendCommandEasy(user, "getZoneStatus", {}, cb, err);
};

PzhAdaptor.approveFriend = function (user, externalEmail, cb, err) {
    sendCommandEasy(user, "approveFriend", {"externalEmail":externalEmail}, cb, err);
};

PzhAdaptor.rejectFriend = function (user, externalEmail, cb, err) {
    sendCommandEasy(user, "rejectFriend", {"externalEmail":externalEmail}, cb, err);
};

PzhAdaptor.getRequestingExternalUser = function (user, externalEmail, cb, err) {
    sendCommandEasy(user, "getExpectedExternal", {"externalEmail":externalEmail}, cb, err);
};

PzhAdaptor.storeExternalUserCert = function (user, externalEmail, externalPzh, externalCerts, cb, err) {
    sendCommandEasy(user, "storeExternalCert", 
        {"externalEmail":externalEmail, "externalPzh":externalPzh, "externalCerts":externalCerts}, cb, err);
};

PzhAdaptor.requestAddLocalFriend = function(user, externalEmail, cb, err) {
    sendCommandEasy(user, "requestAddLocalFriend", {"externalEmail":externalEmail}, cb, err);
};

PzhAdaptor.checkUserHasPzh = function(user, cb, err) {
    sendCommandEasy(user, "checkPzh", {"user":user}, cb, err);
};

PzhAdaptor.addPzh = function(user, cb, err) {
    sendCommandEasy(user, "addPzh", {"user":user}, cb, err);
};

PzhAdaptor.enrollPzpWithAuthCode = function(user,cb,err) {
    sendCommandEasy(user, "authCode", {}, cb, err);
};

PzhAdaptor.requestAddFriend = function (internaluser, externaluser, externalPzhDetails, cb, err) {
    //unauthenticated input
    sendCommandEasy(internaluser, "requestAddFriend", {externalUser:externaluser, externalPzh:externalPzhDetails}, cb, err);
};

