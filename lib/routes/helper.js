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
 * Copyright 2012 - 2013 The University of Oxford
 * Author: John Lyle (john.lyle@cs.ox.ac.uk)
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
exports.getCertsFromHostDirect = function(options, successCB, errorCB) {
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

exports.getCertsFromHost = function(hostEmail, hostDomain, successcb, errorcb) {
    var options = {
        host: hostDomain.split(":")[0],
        port: parseInt(hostDomain.split(":")[1]) || 443,
        path: "/main/"+encodeURIComponent(hostEmail)+"/certificates/",
        method: "GET"

    };
    exports.getCertsFromHostDirect(options, successcb, errorcb);
};
