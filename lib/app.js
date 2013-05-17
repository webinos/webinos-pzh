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

/* This module initialises the PZH Web Server and triggers the connection
 * between the web server and the TLS server.  This module uses Express to 
 * run the web server and import the routes, views and static pages.
 * It also initialises passportjs, the authentication middleware.
 */

var PzhProviderWeb = exports;
PzhProviderWeb.startWebServer = function (host, address, port, config, cb) {
    "use strict";
       
    try {
        var express = require('express'),
            util = require('util'),
            path = require('path'),
            crypto = require('crypto'),
            https = require('https'),
            fs = require('fs'),
            passport = null,
            passportConfig = require('./passportconfig'),
            wUtil = require('webinos-utilities');
            
    } catch (err) {
        console.log("missing modules in pzh webserver, please run npm install and try again");
    }

    var tlsConnectionAttempts = 0;

    var logger = wUtil.webinosLogging(__filename) || console,
        webTlsCommunicator = require('./pzhtlsconnection.js');
    
    // define the options for the SSL server
    function getSSLOptions(config) {
        return {
            key:  config.cert.keyStore.fetchKey(config.cert.internal.webssl.key_id),
            cert: config.cert.internal.webssl.cert,
            ca:   config.cert.internal.webssl.intermediate,
            requestCert: false,
            rejectUnauthorized:false
        };
    }

    //define the options for the client connection to the PZH TLS Server
    function getTLSClientOptions(config) {
        return {
            key:  config.cert.keyStore.fetchKey(config.cert.internal.webclient.key_id),
            cert: config.cert.internal.webclient.cert,
            ca:   config.cert.internal.master.cert,
            requestCert: true,
            rejectUnauthorized: true //We're only prepared to talk to the TLS server.
        };
    }

    function createServer(port, host, address, config, next) {
        var app, routes, server;

        //configure the authentication engine and user binding
        passportConfig.createPassport("https://" + address + ':' + port, 
                                      function(pp, authConfig) {
            passport = pp;
            //connect to the TLS Server
            makeTLSServerConnection(config, getTLSClientOptions(config), function (status, value) {
                if (status) {
                    //configure the express app middleware
                    if (!server) {
                        app = createApp(passport);
                        routes = setRoutes(app, address, port, authConfig);
                        //actually start the server
                        server = https.createServer(getSSLOptions(config), app).listen(port);
                        handleAppStart(app, server, next);
                    } else {
                        next(value);
                    }
                } else {
                    logger.error("Failed to connect to the PZH Provider's TLS server");
                    handleAppStart(app, null, next);
                }
            });
            
        });
        
    }

    /* Long lasting connection: this will reconnect after any errors a maximum
     * of 10 times (ok, more like 8).
     */
    function makeTLSServerConnection(config, tlsClientOptions, cb) {
        webTlsCommunicator.init( config, tlsClientOptions,
            function (data) {
                cb(true, data);
            },
            onTLSConnectionFailure(config, tlsClientOptions, cb));
    }
    
    // This function returns another function which is used to retry connecting
    // to the PZH TLS server in case of any disconnection or error.
    // The callback is the function that needs to be invoked ONLY when
    // the TLS server is successfully connected for the first time
    // (not subsequent attempts)
    function onTLSConnectionFailure(config, tlsClientOptions, cb) {
        var tlsConnectionAttempts = 0;
        // this is the 'on error' function.
        return function(status, value) {
            if (status) {
                tlsConnectionAttempts++;
                webTlsCommunicator.send("NO USER", "WEB SERVER INIT", {
                    err:function (error) {
                        logger.error(error);
                    },
                    success:function () {
                        logger.log("Sent.");
                    }
                });
                if (tlsConnectionAttempts === 1) {
                    // don't bother with success callbacks if it works
                    // after the first time.
                    cb(status, value);
                }
                tlsConnectionAttempts = 1; //reset
            } else {
                tlsConnectionAttempts++;
                if (tlsConnectionAttempts < 10) {
                    setTimeout(function () {
                        makeTLSServerConnection(config, tlsClientOptions, cb);
                    }, 1000);
                } else {
                    cb(false, "Failed to reconnect to TLS server");
                }
            }
        }
    }


    function createApp(passport) {
        "use strict";
        var app = express();
        var MemStore = express.session.MemoryStore;
        app.configure(function () {
            app.set('views', __dirname + '/views');
            app.set('view engine', 'jade');
//      app.use(express.logger()); // turn on express logging for every page
            app.use(express.bodyParser());
            app.use(express.methodOverride());
            app.use(express.cookieParser());
            var sessionSecret = crypto.randomBytes(40).toString("base64");
            app.use(express.session({ secret:sessionSecret }));//, store: new MemStore({reapInterval: 6000 * 10})
            app.use(passport.initialize());
            app.use(passport.session());
            app.use(app.router);
            app.use(express.static(require('path').resolve(__dirname, '..', 'public')));
        });

        // An environment variable will switch between these two, but we don't yet.
        app.configure('development', function () {
            app.use(express.errorHandler({ dumpExceptions:true, showStack:true }));
        });

        app.configure('production', function () {
            app.use(express.errorHandler());
        });

        return app;
    }

    function setRoutes(app, address, port, authConfig) {
        "use strict";
        require('./routes')(app, address, port);
        require('./routes/peerpzhauth.js')(app, address, port, authConfig);
        require('./routes/auth.js')(app, address, port, authConfig);
    }

    function handleAppStart(app, server, next) {
        "use strict";
        if (server === undefined || server === null || server.address() === null) {
            var err = "ERROR! Failed to start PZH Provider web interface: " + util.inspect(server);
            logger.log(err);
            next(false, err);
        } else {
            logger.log("HTTPS PZH Provider Web server at address " + server.address().address + ", listening on port " + server.address().port);
            next(true, null);
        }
    }

    logger.log("Port:    " + port)
    logger.log("Host:    " + host)
    logger.log("Address: " + address)
    createServer(port, host, address, config, cb);
};


