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
    logger  = wUtil.webinosLogging(__filename) || console,
    pzhproviderweb = require('./app.js'),
    certificateHandler = require("webinos-certificateHandler");

var starter = exports;


/* Generic "make me a certificate" function.
 * certName should be either "webssl" or "webclient"
 * certLabel should be either "PzhSSL" or "PzhWS"
 */
function loadWSCertificate(config, certName, certLabel) {
    var clientCert, csr;
    if (!config.cert.internal[certName] || !config.cert.internal[certName].cert) {
        var cn = certLabel + ":" + config.metaData.serverName;
        if((csr=config.cert.generateSelfSignedCertificate(certLabel, certLabel))) {
            if((clientCert= config.cert.generateSignedCertificate(csr))) {
                config.cert.internal[certName].cert = clientCert;
                config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    } else {
        return true;
    }
}

starter.startWS = function(hostname, friendlyName, userPref, callback) {
    wUtil.webinosHostname.getHostName(hostname, function (address) {
        var inputConfig = {
            "friendlyName": friendlyName,
            "sessionIdentity": address
        };
        var config = new wUtil.webinosConfiguration("PzhP", inputConfig);
        config.cert = new certificateHandler(config.metaData);
        config.userPref = userPref;
        if(config.loadWebinosConfiguration()){
            if(!config.loadCertificates(config.cert)) {
                logger.error("certificate not available");
                return callback(false);
            } else if(loadWSCertificate(config, "webssl", "PzhSSL") && loadWSCertificate(config, "webclient", "PzhWS")){

                logger.log("starting the web server on " + config.userPref.ports.provider_webServer);
                pzhproviderweb.startWebServer(hostname,
                address,
                config.userPref.ports.provider_webServer,
                config,
                function (status, value) {
                    if (status) {
                        logger.log("Personal zone provider web server started");
                        return callback(true);
                    } else {
                        logger.log("Personal zone provider web server failed to start on port " +
                            config.userPref.ports.provider_webServer + ", " + value);
                        return callback(false);
                    }
                });
            } else {
                logger.log("Failed to create web server certificates");
                callback(false);
                return;
            }
        } else{
            logger.log("first start PZH and then start PZH WebServer");
        }
    });
};
