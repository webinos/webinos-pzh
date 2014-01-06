function DisplayListOfDevices(payload){
	$("#enumConnectedPzh").html("");
	$("#enumConnectedPzp").html("");
    var text = "", style;
	if(payload && payload.pzhs) {
	  for (var i = 0 ; i < payload.pzhs.length; i += 1){
            style = payload.pzhs[i].isConnected?"connected":"disconnected";
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
            style = payload.pzps[i].isConnected?"connected":"disconnected";
            text +='<li><input type="image" src="/images/removePzh.jpg" id="payload.pzps[i].id" height="15" width="15"'+
                'alt="button" onclick="webinosPZH.commands.removePzp(\''+payload.pzps[i].url+'\', removePzp)">'+
                '<a class="'+ style +'" title="'+payload.pzps[i].url+'">'+payload.pzps[i].id + '</a> </input></li>'
	  }
	  $("#enumConnectedPzp").html(text);
	}
	$('.column').equalHeight(); // Fix height
}
function setArticle(header,body){
	$('#mainheader').text(header);
	$('#maincontent').html(body);
	$('.column').equalHeight(); // Fix height
}
function setApproveUserVisibility(next) {
  webinosPZH.commands.getRequestingExternalUser(function(payload) {
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
function removePzh(payload) {
	if(payload) {
	  alert("pzh disconnected & removed from your trusted list");
	  webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
	} else {
	  alert("failed removing pzh from your trusted list");
	}
}
function removePzp(payload) {
    if(payload) {
        alert("pzp disconnected & removed from your trusted list");
        webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
    } else {
        alert("failed removing pzp from your trusted list");
    }
}

function showServiceForEntity(id) {
  /* This function will list all unregistered services at a particular endpoint
     and then use JQuery to populate them into a select option box, display them
     to the end user, and offer the option to register them through an HTML
     form.
     
     Currently broken due to the PZH TLS server.
   */
  webinosPZH.commands.listUnregServices(id, function(payload) {
    	var form = $('#form-' + id);
    	var select = $('<select name="service"></select>');
    	for (var i = 0; i < payload.modules.length; i += 1) {
	      var mod = payload.modules[i];
	      var option = $('<option value="' + id +' ' + mod.name + '" >' + mod.name + '</option>');
	      select.append(option);
	    }
	    form.append(select);
	    form.show();
  });
}


function startUpFunctions() {
  webinosPZH.commands.getZoneStatus(function(payload) {
    DisplayListOfDevices(payload);
    setApproveUserVisibility(); 
  });
}

$(document).ready(function() {
	webinosPZH.init(function(){
	  setTimeout(function() {
		  webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
	  }, 3000);
	  startUpFunctions();	  
	});
	$("#refresh").click(function(){
	   webinosPZH.commands.getZoneStatus(DisplayListOfDevices);
	});
	$('.column').equalHeight(); // Fix height
});
