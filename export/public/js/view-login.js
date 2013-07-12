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
  window.location.href = "/auth/google";
}
function loginYahoo() {
  window.location.href = "/auth/yahoo";
}
function loginFacebook() {
  window.location.href = "/auth/facebook";
}
function loginTwitter() {
  window.location.href = "/auth/twitter";
}
function loginOpenID() {
  var openIdElem = document.getElementById("openid_identifier");
  if (openIdElem === undefined || openIdElem === null || openIdElem.value === "") {
      alert("Please enter a valid OpenId identifier");
  } else {
      window.location.href = "/auth/openid?openid_identifier=" + openIdElem.value;
  }
}
