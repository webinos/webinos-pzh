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

var TwitterInvite = function(credentials, currentUser) {
	var Twit = require('twit');
	var cred = {
		"consumer_key"        : credentials.consumer_key,
		"consumer_secret"     : credentials.consumer_secret,
		"access_token"        : currentUser.token || credentials.access_token,
		"access_token_secret" : currentUser.tokenSecret || credentials.access_token_secret
	}
	var T = new Twit(cred);

	TwitterInvite.prototype.sendDM = function(recipient, msg, cb, errorcb) {
		T.post("direct_messages/new", { user_id : recipient, text : msg}, function(err, reply) {
			if (err) {
				return errorcb(err);
			} else {
				return cb(reply);
			}
		});
	}

	TwitterInvite.prototype.getContacts = function(cb, errorcb) {
		var accumulator = {};
		T.get("friends/ids", { screen_name : currentUser.username }, function(err, reply) {
			if (err) {
				return errorcb(err);
			} else {
				for (var i=0; i<(reply.ids.length / 100); i++) {
					accumulator[i] = null;
				}
				for (var i=0; i<(reply.ids.length / 100); i++) {
					var lowerBound = i*100;
					var upperBound = (i+1)*100;
					lookUpUsers(reply.ids, lowerBound, upperBound, function(result) {
						accumulator[result.lowerBound/100] = result.users;
							if (isComplete(accumulator, reply.ids.length)) {
								// last iteration
								var res = [];
								for (var j in accumulator) {
									if (accumulator.hasOwnProperty(j) &&  accumulator[j] !== null && accumulator[j] !== "error") {
										res = res.concat(accumulator[j]);	
									}
								}
								cb(res);
							}
					});
				}
			}
		});
	}

	function isComplete(allFriends, friendSize) {
		for (var i=0; i<=(friendSize/100); i++) {
			if (allFriends[i] === null) {
				return false;
			} else {
			}
		}
		return true;
	}

	function lookUpUsers(userIds, lowerBound, upperBound, cb) {
		T.post('users/lookup', { user_id : userIds.slice(lowerBound, upperBound) }, function(errAgain, userObjects) {
			if (errAgain) {
				console.log(errAgain);
				userObjects = "error";
			}
			cb( { 
				"lowerBound" : lowerBound,
				"upperBound" : upperBound,
				"users"      : userObjects
			});
		});
	}
}



module.exports = TwitterInvite;