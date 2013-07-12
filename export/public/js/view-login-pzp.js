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
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
function loginGoogle() {
	var options = {"type": 'prop', "payload":{"status": "authenticate", "message": "google"}};
	webinos.session.message_send(options);
}
function loginYahoo() {
	var options = {"type": 'prop', "payload":{"status": "authenticate", "message": "yahoo"}};
	webinos.session.message_send(options);
}
function loginFacebook() {
	var options = {"type": 'prop', "payload":{"status": "authenticate", "message": "facebook"}};
	webinos.session.message_send(options);
}
function loginTwitter() {
	var options = {"type": 'prop', "payload":{"status": "authenticate", "message": "twitter"}};
	webinos.session.message_send(options);
}
function loginOpenID() {
  var openIdElem = document.getElementById("openid_identifier");
	var options = {"type": 'prop', "payload":{"status": "authenticate", "message": "openid", "identifier": openIdElem.value }};
	webinos.session.message_send(options);
}
function authenticate(msg){
	console.log(msg);
	window.location.href=msg.payload.message;
}
webinos.session.addListener('authenticate', authenticate);
