function DisplayListOfDevices(payload){
	$("#enumConnectedPzh").html("");
	$("#enumConnectedPzp").html("");
	var text = "";
	if(payload && payload.pzhs) {
	  for (var i = 0 ; i < payload.pzhs.length; i += 1){
		var style = payload.pzhs[i].isConnected?"connected":"disconnected";
		if (payload.pzhs[i].id.search("Your Pzh") === -1 ) {
	      text +='<li><input type="image" src="/images/removePzh.jpg" id="payload.pzhs[i].id" height="15" width="15"'+
	      'alt="button" onclick="webinosPZH.commands.removePzh(\''+payload.pzhs[i].url+'\', removePzh)">'+
	      '<a class="'+ style +'" title="'+payload.pzhs[i].url+'">'+payload.pzhs[i].id + '</a> </input></li>'
	    } else {
	      text+= "<li><a class='"+ style +"' title='"+payload.pzhs[i].url+"'>"+payload.pzhs[i].id + "</a> </input></li>";
	    }
	  }
	  $("#enumConnectedPzh").html(text);
	  text = "";
	  for (i = 0 ; i < payload.pzps.length; i += 1){
		var style = payload.pzps[i].isConnected?"connected":"disconnected";
		text+= "<li><a class='"+ style +"' title='"+payload.pzps[i].url+"'>"+payload.pzps[i].id + "</a></li>";
	  }
	  $("#enumConnectedPzp").html(text);
	}
	$('.column').equalHeight(); // Fix height
}
function setArticle(header,body){
	$('#main').html('<article class="module width_full"><header><h3>' + header + '</h3></header><div class="module_content">'+ body + '</div></article><div class="spacer"></div>');
	$('.column').equalHeight(); // Fix height
}
function setApproveUserVisibility(next) {
  webinosPZH.commands.approveUser(function(payload) {
    console.log("Approve User? " + JSON.stringify(payload));
    if (payload.length === 0) {
      document.getElementById('approveUser').style.display='none';
    } else if (payload.length > 0) {
      document.getElementById('approveUser').style.display='inline-block';
      document.getElementById('approveUserCount').innerHTML = payload.length + " ";
    }
    if (next) {
      next();
    }
  });
  return;
}
function pzhList(payload) {
	var text = "";
	if (payload.length !== 0) {
	  text += "<form action=\"/connect-friend-local\" method=\"post\">";
	  text += "<fieldset id=\"connect-local-friend\" class=\"connect-fieldset\">";
	  text += "<legend>Connect to a personal zone at this website</legend>";
	  text += "<select id='pzh_list' name='email'>"
    for (var i = 0; i < payload.length; i = i +1) {
      text += "<option value="+payload[i].email+">"+ payload[i].username + " (" + payload[i].email + ")</option>";
    }
	  text += "</select>";
    text += "<input type='submit' value='Connect Pzh'/>";
	  text += "</fieldset></form>";
	}
  text += "<form action=\"connect-friend\" method=\"post\">";
  text += "<fieldset id=\"connect-friend\" class=\"connect-fieldset\">";
  text += "<legend>Enter details manually</legend>";
  text += "<dl>";
    text += "<dt>";
      text += "<label>Personal zone hub address (e.g., pzh.webinos.org)</label>";
    text += "</dt>";
    text += "<dt>";
	    text += "<input type='text' name='pzhaddress' id='connectPzhId' value=''/>";
    text += "</dt>";
    text += "<dt>";
      text += "<label>Email address (e.g., alice@foo.com)</label>";
    text += "</dt>";
    text += "<dt>";
	    text += "<input type='text' name='email' id='connectPzhEmail' value=''/>";
    text += "</dt>";
    text += "<dt>";
	    text += "<input type='submit' value='Connect Pzh'/>";
    text += "</dt>";
  text += "</dl>";	
	text += "</fieldset></form>";

	setArticle("Connect to another personal zone",text);
}
function removePzh(payload) {
	console.log(payload)
	if(payload) {
	  alert("pzh disconnected & removed from your trusted list");
	  webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
	} else {
	  alert("failed removing pzh from your trusted list");
	}
}
function pzpRevokeResult(payload){
	setArticle("Device removed from personal zone", "<p>" + payload.payload + " device removed.</p>");
}
function listPzpsToRevoke(payload){
	var i, id;
	var text = " <h3 align=center> Connected PZP's</h3> <p> <table border=2 align='center' bgcolor='#000099' font-color='#FFFFFF'>";
	for (i = 0; i < payload.signedCert.length; i += 1 ) {
	  id = payload.signedCert[i].id;
	  text += "<tr>  <td> " + payload.signedCert[i].url + "</td> <td> "+
	  "<input id=\'"+payload.signedCert[i].url+"\' type=\'button\' onclick=\'webinosPZH.commands.revokePzp(id,pzpRevokeResult)\'; value =\'"+id+"\' />  </td> </tr>" ;
	}
	text += '</table> </p>';
	text += " <p> <h3 align=center> Remove a device from your personal zone</h3> </p>";
	text += "<p>This page will allow you to remove a device from your personal zone.</p>";
	text += "<p> <table border=2 align='center' bgcolor='#000099' font-color='#FFFFFF'>";
	for (i = 0; i < payload.revokedCert.length; i += 1 ) {
	  id = payload.revokedCert[i].id;
	  text += "<tr>  <td> " + payload.revokedCert[i].url + "</td> </td> </tr>" ;
	}
	text += '</table> </p>';
	setArticle("Remove device from personal zone", text);
}
function listAllServices(payload){
	var text = " <h3 align=center> Configure services</h3> <p> <table border=2 align='center' bgcolor='#000099' font-color='#FFFFFF'>";
	for (var i = 0; i < payload.pzEntityList.length; i += 1 ) {
	  var pzId = payload.pzEntityList[i].pzId;
	  text += '<tr><td><input type="button" onclick="webinosPZH.commands.listUnregServices(\'' +
		pzId + '\', listUnregServices)" value="' + pzId + '"/></td></tr>';
	}
	text += "</table> </p>";
	text += "<p><ul>";
	for (var i = 0; i < payload.services.length; i += 1 ) {
	  var sv = payload.services[i];
	  text += "<li> " + sv.api + " @ " + sv.serviceAddress +
		"<input type='button' value='unregister' onclick='webinosPZH.commands.unregisterService(\"" + sv.serviceAddress + "\",\"" + sv.id + "\",\"" + sv.api + "\", listAllServices)'></li>";
	}
	text += '</ul>';
	setArticle("Services", text);
}
function listUnregServices(payload){
	var text = '<h3 align=center>Original Services from ' + payload.pzEntityId + '</h3><ul>';
	for (var i = 0; i < payload.modules.length; i += 1) {
	  var mod = payload.modules[i];
		text += '<li>' + mod.name + '<input type="button" value="register" onclick="webinosPZH.commands.registerService(\'' + payload.pzEntityId + '\',\'' + mod.name + '\', listAllServices)"></li>';
	}
	text += '</ul>';
	setArticle("unregistered Services", text);
}
function showCrashLog(payload){
	setArticle("Crash Log", payload);
}
function showInfoLog(payload){
	setArticle("Info Log", payload);
}
function approveUser(payload) {
	var text = "";
	if (payload) {
	  text = "<h3>Would you like to approve or reject the request?</h3>";
	  text += "<p><form name='approve-user' action='/make-user-decision' method='post'> <table>";
	  for (var i = 0; i < payload.length; i = i+1) {
		text += "<tr> <td> <input type='checkbox' name='decision' value="+payload[i].name+">";
		text += payload[i].name+"</input></td>";
		text += "<td>"+payload[i].url +"</td>";
		text += "<td><input type='submit' value='Accept'></td></tr>";
	  }

	  text += "</table></form></p>";
	} else {
	  text = "No users to approve";
	}
	setArticle("Approve User List", text);
}
function listUserDetails(payload){
  console.log("List user details: " + JSON.stringify(payload));
	var text = "";
	if (!payload) {
	  payload = {
		name: "Connected",
		email: [{value:"Undefined"}],
	  }
	}	
	if (payload.photoUrl){
	  text += "<h3> <img src="+ payload.photoUrl + " width='100px'> </img> </h3>";
	}
	text += "<h3> Name: "+          payload.name +"</h3>";
	text += "<h3> Email: "+         payload.email[0].value+"</h3>";
	setArticle("About you", text);
	$("#userId").html(payload.name);
	webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
}
function startUpFunctions() {
  webinosPZH.commands.getZoneStatus(function(payload) {
    DisplayListOfDevices(payload);
    webinosPZH.commands.getUserDetails(function(payload2) {
        listUserDetails(payload2);
        setApproveUserVisibility(); 
    });
  });
}

$(document).ready(function() {
	webinosPZH.init(function(){
	  setTimeout(function() {
		  webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
	  }, 3000);
	  startUpFunctions();	  
	});
	$("#connectPzh").click(function(){
	  webinosPZH.commands.getAllPzh(pzhList);
	});
	$("#revokeCert").click(function(){
	  webinosPZH.commands.getPzps(listPzpsToRevoke);
	});
	$("#refresh").click(function(){
	   webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
	});
	$("#crashLog").click(function(){
	  webinosPZH.commands.getCrashLog(showCrashLog);
	});
	$("#infoLog").click(function(){
	  webinosPZH.commands.getInfoLog(showInfoLog);
	});
	$("#userDetails").click(function(){
	  webinosPZH.commands.getUserDetails(listUserDetails);
	});
	$("#restartPzh").click(function(){
	  webinosPZH.commands.restartPzh();
	  setArticle("Command sent", "<p>Restart command sent!</p>");
	});
	$("#serviceConfig").click(function(){
	  webinosPZH.commands.listAllServices(listAllServices);
	});
	$("#approveUser").click(function(){
	  webinosPZH.commands.approveUser(approveUser);
	});
	$('.column').equalHeight(); // Fix height
});
