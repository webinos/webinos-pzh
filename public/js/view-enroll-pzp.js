function enrol(pzpPort, user, pzhPort, pzhAddress, csrf) {
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
	  console.log("Data received from the PZP for enrolment: " + JSON.stringify(data));
	  if (data.payload && data.payload.status === "csrFromPzp") { //csrAuthCodeByPzp
		   //respond back to the PZH
		   console.log("Now sending an XMLHttpRequest to the PZH...");
		   var req = new XMLHttpRequest ();
		   req.onreadystatechange = function() {
			  if (req.readyState === 4) {
				  var msg = req.responseText;
				  if (msg !== "") {
					  var parsed = JSON.parse(msg);
					  console.log("Sending certificate via WebSockets: " + JSON.stringify(parsed.message));
					  channel.send(JSON.stringify(parsed.message));
				  }
			   }
		   }
		   req.open("POST", window.location.protocol + "//" + window.location.host + "/pzpEnroll");
		   req.setRequestHeader ("Content-Type", "application/json");
		   req.send(JSON.stringify({"csr":data.payload.csr, "friendlyName": data.payload.friendlyName, from:data.from, deviceType: data.payload.deviceType, "_csrf":csrf}));
		   console.log("Sent XHR to " + window.location.protocol + "//" + window.location.host + "/pzpEnroll");
	  } else if (data.payload && data.payload.status === "enrolmentSuccess") {
	  		console.log("Enrolment success, going back to the PZP page.");
			channel.close();
			window.location.href = "http://localhost:"+pzpPort;	  		
	  } else if (data.payload && data.payload.status === "enrolmentFailure") {
	  		console.log("Enrolment failure.");
	  		document.getElementById("mainContent").innerHtml = "<p>Could not enrol device into personal zone.</p>";
	  		channel.close();
	  }
  }
  channel.onopen = function() {
	  console.log("connection successful");
	  var data = {
  	      type:"prop", 
  	      from: window.location.host+"_" + user , 
  	      to: "",
	      payload:{ status:"enrolRequestCSR" } //authCodeByPzh
	  }; 
	  channel.send(JSON.stringify(data));
  }
}