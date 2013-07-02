/*
window.onload = function() {
	var box = document.getElementById("pzhWebUrl");
	box.value = webinos.session.getPzhWebAddress();
}
*/

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