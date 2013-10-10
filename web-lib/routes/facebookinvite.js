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
 * Author: John Lyle (john.lyle@cs.ox.ac.uk)
 *******************************************************************************/

var util = require('util');

var FacebookInvite = function(accessToken, appid, currentUser) {
	var FB = require('fb');
	FB.setAccessToken(accessToken);

	FacebookInvite.prototype.getSendRedirect = function(recipient, link, redirectUrl, cb) {
		var url = require('url');
		var fbUrl = {
			protocol: "https",
			host : "www.facebook.com",
			pathname : "/dialog/send",
			query : {
				"app_id" : appid,
				"link" : link,
				"redirect_uri" : redirectUrl,
				"to":recipient
			}
		}
		cb(url.format(fbUrl));
	}

	FacebookInvite.prototype.getContacts = function(cb, errorcb) {
		var accumulator = {};
		console.log("Getting friend list");
		FB.api("me/friends", { fields: 'id,name' }, function(result) {
			if (!result || result.error) {
				errorcb();
			} else {
				cb(result.data);
			}
		});
	}
}



module.exports = FacebookInvite;