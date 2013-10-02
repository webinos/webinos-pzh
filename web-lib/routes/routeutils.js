/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use RouteUtils.prototype. file except in compliance with the License.
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
 * Author: Habib Virji (habib.virji@samsung.com) and 
 *         John Lyle (john.lyle@cs.ox.ac.uk)
 *******************************************************************************/

var RouteUtils = function(address, port, tlsServerPort, authConfig) { 
	var url = require('url');
	var util = require('util');
	 
	 // Simple route middleware to ensure user is authenticated.
	//   Use RouteUtils.prototype. route middleware on any resource that needs to be protected.  If
	//   the request is authenticated (typically via a persistent login session),
	//   the request will proceed.  Otherwise, the user will be redirected to the
	//   login page.
	RouteUtils.prototype.ensureAuthenticated = function(req, res, next) {
	    RouteUtils.prototype.saveRequestInfo(req,res) 
	    if (req.isAuthenticated()) {
	        return next();
	    } else {
	    	res.redirect('/login');
		}
	}

	RouteUtils.prototype.ensureHasPzh = function(req, res, next) {
		RouteUtils.prototype.saveRequestInfo(req,res) 
		RouteUtils.prototype.hasPZHSelector(req, function(foundUser) {
	        next();
	    }, function() {
	        res.redirect('/login');
	    });
	}

	// must be called after ensureAuthenticated or ensureHasPzh
	RouteUtils.prototype.hasTwitter = function(req,res,next) {
	    if (req.user.provider === "twitter") {
	        return next();
	    } else {
	        res.redirect('/login');
	    }
	}

	// in some cases, when we get redirected to login we'll want to immediate go back to the right place again
	// this means saving the query and params.
	RouteUtils.prototype.saveRequestInfo = function(req,res) {
		if (req.path !== null) {
			if (req.path === RouteUtils.prototype.getPathForConfirmTokenInvite()) {
				req.session.shouldRedirect = true;
				req.session.originalUrl = req.originalUrl;
				console.log("Saving into session: " + req.session.originalUrl);
			} else {
				req.session.shouldRedirect = false;
				req.session.originalUrl = null;
			}
		}
	}

	RouteUtils.prototype.doPostLoginRedirect= function(req, res) {
		if (req.session.shouldRedirect) {
			req.session.shouldRedirect = false;
	    	var redirectUrl = req.session.originalUrl;
	    	req.session.originalUrl = null;
	    	res.redirect(redirectUrl);
	    	
	    } else {
	    	res.redirect('/');
		}
	}

	// Use RouteUtils.prototype. to check that the user has a PZH, as well as being authenticated.
	RouteUtils.prototype.hasPZHSelector = function(req, yesFn, noFn) {
	    if (req.isAuthenticated() && req.user.hasPzh) {
	        yesFn();
	    } else {
	        noFn(); 
	    };
	}
	RouteUtils.prototype.getUserPath = function(user) {
	    return encodeURIComponent(user.emails[0].value);
	}

	RouteUtils.prototype.checkCSRF = function(req, res) {
	    // check to see whether there is a valid csrf token in the body of the 
	    // request, compared with req.session._csrf
	    // we're only checking the body, nowhere else.
	    if (typeof req.session._csrf === undefined || req.session._csrf === "" || req.session._csrf === null) {
	        return RouteUtils.prototype.doError(res, "Failed to find a valid CSRF token in the session data");
	    }
	    if (typeof req.body._csrf === undefined || req.body._csrf === null) {
	        return RouteUtils.prototype.doError(res, "Failed to find a valid CSRF token in request body");
	    }
	    if (req.body._csrf !== req.session._csrf) {
	        return RouteUtils.prototype.doError(res, "CSRF token does not match the expected value");
	    }
	    return true;
	}

	RouteUtils.prototype.isValid = function(req,res) {
	    var errors = req.validationErrors(true);
	    if (errors) {
	        res.send('There have been validation errors: ' + util.inspect(errors), 500);
	    }
	    return !errors;
	}    

	RouteUtils.prototype.getFullExternalPzhAddress = function(domain, port, nickname) {
	    return url.format({
	        protocol : "https:",
	        hostname : domain,
	        port     : port,
	        auth     : nickname
	    });		
	}

	RouteUtils.prototype.getFullPzhAddress = function(nickname) {
	    return RouteUtils.prototype.getFullExternalPzhAddress(address, tlsServerPort, nickname);
	}

	RouteUtils.prototype.getPzhServerDomain = function() {
	    return address + ":" + tlsServerPort;
	}

	RouteUtils.prototype.getExternalPzhCertificatesUrl = function(domain, port, nickname) {
	    var certUrl = url.parse(RouteUtils.prototype.getExternalPzhWebServerUrl(domain, port));
	    certUrl.pathname = "/certificates/" + encodeURIComponent(nickname);
	    return url.format(certUrl);
	}

	RouteUtils.prototype.getPzhCertificatesUrl = function(nickname) {
		return RouteUtils.prototype.getExternalPzhCertificatesUrl(address, port, nickname);
	}

	RouteUtils.prototype.getExternalPzhWebServerUrl = function(domain, webport) {
	    return url.format({
	        protocol : "https:",
	        hostname : domain,
	        port     : webport
	    });
	}

	RouteUtils.prototype.getPzhWebServerUrl = function() {
	    return RouteUtils.prototype.getExternalPzhWebServerUrl( address, port );
	}

	RouteUtils.prototype.getGenericPzhUrl = function() {
	    return url.format({
	        protocol : "https:",
	        hostname : "192.168.20.42",
	        port     : "6443"
	    });
	}


	function getBasicRedirect(targetWebServer, nickname) {
	    var serverUrlObj = url.parse(targetWebServer);
	    serverUrlObj.query = {
	        "pzhCertUrl"  : RouteUtils.prototype.getPzhCertificatesUrl(nickname),
	        "pzhAddress"  : RouteUtils.prototype.getFullPzhAddress(nickname)
	    }
	    return serverUrlObj;
	}

	RouteUtils.prototype.getUrlForConfirmTokenInvite = function(targetWebServer, nickname, token) {
	    var serverUrlObj = getBasicRedirect(targetWebServer, nickname);
	    serverUrlObj.pathname = RouteUtils.prototype.getPathForConfirmTokenInvite();
	    serverUrlObj.query["token"] = token;
	    return url.format(serverUrlObj);
	}

	RouteUtils.prototype.getUrlForInviteRedirect = function(nickname, token) {
		var baseUrl = url.parse(RouteUtils.prototype.getPzhWebServerUrl());
		baseUrl.pathname = "/inviteRedirect/" + encodeURIComponent(nickname) + "/" + encodeURIComponent(token);
		return url.format(baseUrl);
	}

	RouteUtils.prototype.getPathForRequestAccessLogin = function() {
		return "/external/request-access-login";
	}

	RouteUtils.prototype.getPathForConfirmTokenInvite = function() {
		return "/confirmTokenInvite";
	}

	RouteUtils.prototype.getUrlForExternalRequestAccessLogin = function(targetWebServer, nickname, targetNickname) {
	    var serverUrlObj = getBasicRedirect(targetWebServer, nickname);
	    serverUrlObj.pathname = RouteUtils.prototype.getPathForRequestAccessLogin();
	    serverUrlObj.query["targetNickname"] = targetNickname;
	    return url.format(serverUrlObj);
	}

	RouteUtils.prototype.getUrlForAddUserByToken = function(targetWebServer, nickname, token, targetNickname) {
	    var serverUrlObj = getBasicRedirect(targetWebServer, nickname);
	    serverUrlObj.pathname = "/external/request-access-with-token";
	    serverUrlObj.query["token"] = token;
	    serverUrlObj.query["targetNickname"] = targetNickname;
	    return url.format(serverUrlObj);
	}

	RouteUtils.prototype.doError = function(res, msg) {
	    res.writeHead(500);
	    res.end(msg);
	    return false;
	}

	RouteUtils.prototype.getJsonFromHostDirect = function(options, successCB, errorCB) {
	    var innerReq = require("https").request(options, function(innerRes) {
	        var data = "";
	        innerRes.on('data', function(d) {
	            data += d;
	        });
	        innerRes.on('end', function() {
	            var certs = JSON.parse(data);
	            successCB(certs);
	        });
	        innerRes.on('error', function(err) {
	            errorCB(err);
	        });
	    });
	    innerReq.on('error', function(err) {
	        console.log(require("util").inspect(err));
	        errorCB(err);
	    });
	    innerReq.end();
	};

	RouteUtils.prototype.getJsonFromHostByUrl = function(url, successcb, errorcb) {
	    var parsedUrl = require('url').parse(url);
	    parsedUrl.method = "GET";
        parsedUrl.rejectUnauthorized = false;
	    RouteUtils.prototype.getJsonFromHostDirect(parsedUrl, successcb, errorcb);
	};

    /*
     * Currently unused, this function makes use of the Google URL shortener to
     * shorten any link.
     */
    RouteUtils.prototype.shortenUrl = function(url, cb, errcb) {
        if (authConfig.google.apiKey !== null) {
            try {
                var googl = require('goo.gl');
                googl.setKey(authConfig.google.apiKey);
            } catch (error) {
                errcb("Failed to require the goo.gl module");
            }
            googl.shorten(url, function(shortUrl) {
                cb(shortUrl.id);
            }); 
        } else {
            errcb("No goo.gl config");
        }
    }

}

module.exports = RouteUtils;