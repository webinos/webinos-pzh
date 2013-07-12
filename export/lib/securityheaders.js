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
 * Copyright 2012 - 2013 University of Oxford
 * Author: John Lyle (john.lyle@cs.ox.ac.uk)
 *******************************************************************************/

var SecurityHeaders = exports,
    util = require('util'),
    defaultCSP = "default-src 'self';";

// { "defaultPolicy": 
//      { "default-src" : ["'self'"]
//      , "script-src"  : ["'self'", "https://ajax.googleapis.com"]
//      , "image-src"   : ["'self'", "https://ssl.gstatic.com", "http://www.webinos.org", "http://l.yimg.com", "https://twitter.com", "http://cav2013.forsyte.at", "http://openid.net"]
//      }
//    }

SecurityHeaders.setCSP = function(policy) {
  "use strict";
  var cspString = getCspString(policy);
  return function(req, res, next) {
    var headerFunction = res.writeHead;
    res.writeHead = getCSPHeaders(res, cspString, headerFunction);
    next();
  } 
}

function getCSPHeaders(res, cspString, headerFunction) {
  "use strict";
  return function(status, headers) {
    headers = headers || {};
    headers['Content-Security-Policy'] = cspString;
    headerFunction.call(res, status, headers);
  };
}

function getCspString(policy) {
  "use strict";
  var result = "";
  if (policy) {
    if (policy.hasOwnProperty('defaultPolicy')) {
      var pols = policy.defaultPolicy;
      for (var p in pols) {
        if (pols.hasOwnProperty(p) && pols[p].length > 0) {
          result += p;
          for (var j=0; j<pols[p].length; j++) {
            result += " " + pols[p][j];
          }
          result += "; "
        }
      }
      return result;
    }
  }
  //default case
  return defaultCSP;
}

SecurityHeaders.setHSTS = function(age) {
  "use strict";
  return function(req, res, next) {
    var headerFunction = res.writeHead;
    res.writeHead = getHstsHeaders(res, age, headerFunction);
    next();
  } 
}


function getHstsHeaders(res, age, headerFunction) {
  "use strict";
  return function(status, headers) {
    headers = headers || {};
    headers['Strict-Transport-Security'] = "max-age=" + age;
    headerFunction.call(res, status, headers);
  };
}
