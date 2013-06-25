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
	var T = new Twit(credentials);

	TwitterInvite.prototype.getContacts = function(cb, errorcb) {
		var accumulator = {};
		T.get("friends/ids", { screen_name : currentUser }, function(err, reply) {
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
						//console.log("Setting the accumulator[" + result.lowerBound/100 + "] to the result, with " + result.users.length + " entries");
						accumulator[result.lowerBound/100] = result.users;
							if (isComplete(accumulator, reply.ids.length)) {
								//console.log("Now received all twitter info, apparently.");
								// last iteration
								var res = [];
								for (var j in accumulator) {
									if (accumulator.hasOwnProperty(j) &&  accumulator[j] !== null && accumulator[j] !== "error") {
										res = res.concat(accumulator[j]);	
									}
								}
								res = res.sort(function(a,b) { 
									if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
									if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
									return 0;
								});
								cb(res);
							}
					});
				}
			}
		});
	}

	function isComplete(allFriends, friendSize) {
		//console.log("Checking whether I have all the results... (total: " + friendSize + ")");
		for (var i=0; i<=(friendSize/100); i++) {
			//console.log("Do we have results for index " + i + ", meaning between " + i*100 + " and " + (i+1)*100 + "?")
			if (allFriends[i] === null) {
				//console.log("Nope, because index " + i + " is empty");
				return false;
			} else {
				//console.log("Yes!  Apparently we do.");
			}
		}
		return true;
	}

	function lookUpUsers(userIds, lowerBound, upperBound, cb) {
		//console.log("Received twitter information from users: " + lowerBound + " through to " + upperBound + ", total expected: " + userIds.length);
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