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
            expressValidator = require('express-validator'),
            securityheaders = require('./securityheaders.js'),
            wUtil = require('webinos-utilities');
            
    } catch (err) {
        console.log("missing modules in pzh webserver, please run npm install and try again");
    }

    var tlsConnectionAttempts = 0;

    var logger = wUtil.webinosLogging(__filename) || console,
        webTlsCommunicator = require('./pzhtlsconnection.js');
    
    // define the options for the SSL server
    function getSSLOptions(config) {
        "use strict";
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
        "use strict";
        return {
            key:  config.cert.keyStore.fetchKey(config.cert.internal.webclient.key_id),
            cert: config.cert.internal.webclient.cert,
            ca:   config.cert.internal.master.cert,
            requestCert: true,
            rejectUnauthorized: true //We're only prepared to talk to the TLS server.
        };
    }

    function createServer(port, host, address, config, next) {
        "use strict";
        var app, routes, server;

        //configure the authentication engine and user binding
        passportConfig.createPassport("https://" + address + ':' + port, 
                                      function(pp, authConfig, fileConfig) {
            passport = pp;
            //connect to the TLS Server
            makeTLSServerConnection(config, getTLSClientOptions(config), function (status, value) {
                if (status) {
                    //configure the express app middleware
                    if (!server) {
                        app = createApp(passport, fileConfig);
                        routes = setRoutes(app, address, port, authConfig, config);
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
        "use strict";
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
        "use strict";
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

    function getCspFromConfig(fileConfig) {
        "use strict";
        if (fileConfig) {
          if (fileConfig.hasOwnProperty('csp')) {
            return fileConfig.csp;
          } else {
            logger.log("CSP config not found, using default values");
            return null;
          }
        }
    }

    function createApp(passport, fileConfig) {
        "use strict";
        var app = express();
        var MemStore = express.session.MemoryStore;
        app.configure(function () {
            app.locals.pretty = true;
            app.set('views', __dirname + '/views');
            app.set('view engine', 'jade');
            //app.use(express.logger()); // turn on express logging for every page
            app.use(express.bodyParser());
            app.use(express.methodOverride());
            var sessionSecret = crypto.randomBytes(40).toString("base64");
            app.use(express.cookieParser(sessionSecret));
            app.use(expressValidator);
            app.use(express.session());
            app.use(passport.initialize());
            app.use(passport.session());
            app.use(express.csrf());
            app.use(securityheaders.setHSTS(15768000));
            app.use(securityheaders.setCSP(getCspFromConfig(fileConfig)));
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

    function setRoutes(app, address, port, authConfig, tlsServerConfig) {
        "use strict";
        var tlsServerPort = tlsServerConfig.userPref.ports.provider;
        var RouteUtilities = require('./routes/routeutils.js');
        var routeutil = new RouteUtilities(address, port, tlsServerPort, authConfig);

        var serverAddress = require('url').format({
            "protocol" : "https", 
            "hostname" : address, 
            "port"     : port
        });

        require('./routes')(app, address, port, routeutil);
        require('./routes/peerpzhauth.js')(app, authConfig, routeutil);
        require('./routes/auth.js')(app, authConfig, routeutil);
        require('./routes/invitations.js')(app, authConfig, routeutil, serverAddress);
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


