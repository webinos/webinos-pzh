function enrol(pzpPort, authCode, user, pzhPort, pzhAddress, csrf) {
  var channel;
  try {
	  channel = new window.WebSocket("ws://localhost:"+pzpPort);
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
	  if (data.payload && data.payload.status === "csrAuthCodeByPzp") {
		   //respond back to the PZP
		   var req = new XMLHttpRequest ();
		   req.onreadystatechange = function() {
			  if (req.readyState === 4) {
				  var msg = req.responseText;
				  if (msg !== "") {
					  var parsed = JSON.parse(msg);
					  channel.send(JSON.stringify(parsed.message));
					  window.location.href = "http://localhost:"+pzpPort;
					  channel.close();
				  }
			   }
		   }
		   req.open("POST", window.location.protocol + "//" + window.location.host + "/pzpEnroll");
		   req.setRequestHeader ("Content-Type", "application/json");
		   req.send(JSON.stringify({"authCode":authCode, "csr":data.payload.csr, from:data.from, "_csrf":csrf}));
	  }
  }
  channel.onopen = function() {
	  console.log("connection successful");
	  var data = {type:"prop", from: window.location.host+"_" + user , to: "",
	  payload:{
		  status:"authCodeByPzh",
		  authCode:authCode,
		  providerDetails:((pzhPort !== '443') ? (pzhAddress+":"+pzhPort) : pzhAddress)}};
	  channel.send(JSON.stringify(data));
  }
}
