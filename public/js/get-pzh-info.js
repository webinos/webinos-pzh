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
 * Copyright 2013 The University of Oxford
 * Author: John Lyle <john.lyle@cs.ox.ac.uk>
 *******************************************************************************/
window.onload = function() {

  var channel;
  try {
	  channel = new window.WebSocket("ws://localhost:8080");
  } catch (err) {
    console.log(err);
	  throw new Error ("Your browser does not support websockets. Please report your browser on webinos.org.");
  }

  channel.onerror = function (error) {
	  console.error ("Connection Error: " + error.toString ());
  }

  channel.onclose = function () {
	  console.log ("PZP Connection Closed");
  }
  channel.onmessage = function (message) {
	  var data = JSON.parse (message.data);
	  console.log("Data received from the PZP: " + JSON.stringify(data));
	  if (data && data.payload && data.payload.message && data.payload.message.pzhWebAddress) {
	  	var box = document.getElementById("pzhWebUrl");
		  box.value = data.payload.message.pzhWebAddress;
      document.getElementById("inviteRedirectForm").submit();
	  }
  }
  channel.onopen = function() {
	  console.log("connection successful");
	  var data = {
  	      type:"prop", 
  	      from: window.location.host, 
  	      to: "",
	      payload:{ status:"registerBrowser" }
	  }; 
	  channel.send(JSON.stringify(data));
  }
}