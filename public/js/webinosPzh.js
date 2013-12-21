var webinosPZH = {
    getNextId: function() {
        return Math.floor(Math.random() * 100000);
    },
    channel:null,
    provider:null,
    init:function (openCallback) {
        if (typeof openCallback === 'function') openCallback();
    },
    messageReceived:function () { // Process incoming messages
        if (webinosPZH.channel.readyState === 4) {
            var msg = webinosPZH.channel.responseText;
            console.log('Message Received : ' + JSON.stringify(msg));
            if (typeof msg === 'string' && msg !== "") {
                msg = JSON.parse(msg);
                switch (msg.type) {
                    case 'getZoneStatus':
                    case 'getUserDetails':
                    case 'getCrashLog':
                    case 'getInfoLog':
                    case 'getPzps':
                    case 'listAllServices':
                    case 'listUnregServices':
                    case 'getAllPzh':
                    case 'getRequestingExternalUser':
                    case 'revokePzp':
                    case 'unregisterService':
                    case 'registerService':
                    case 'removePzh':
                    case 'removePzp':
                        if (webinosPZH.callbacks.has(msg.type,msg.msgid)) {
                          webinosPZH.callbacks.get(msg.type,msg.msgid)(msg.message);
                          webinosPZH.callbacks.unset(msg.type,msg.msgid);
                        } else {
                          console.log("Could not invoke callback for: " + JSON.stringify(msg));
                        }
                        break;
                }
            }
        }
    },
    send:function (command, id, payload) {
        var msg = { 
          "id"     : id,
          "command": command, 
          "payload": payload || null
        }
        if (document.getElementById('anticsrf') !== null) {
          msg['_csrf'] = document.getElementById('anticsrf').innerHTML.trim();
        }
        
        webinosPZH.channel = new XMLHttpRequest();
        webinosPZH.channel.onreadystatechange = webinosPZH.messageReceived;
        var queryUrl = window.location.protocol + "//" + window.location.host + "/query";
        webinosPZH.channel.open("POST", queryUrl);
        webinosPZH.channel.setRequestHeader("Content-Type", "application/json");
        console.log("Sending to the PZH web interface: " + JSON.stringify(msg));
        webinosPZH.channel.send(JSON.stringify(msg));
    },
    callbacks:{
        set: function(msgtype, callback) {
            var nextId = webinosPZH.getNextId();
            if (!webinosPZH.callbacks.store.hasOwnProperty(msgtype)) {
                webinosPZH.callbacks.store[msgtype] = {};
            }
            webinosPZH.callbacks.store[msgtype][nextId] = callback;
            return nextId;
        },
        get: function(msgtype, id) {
            if (webinosPZH.callbacks.store.hasOwnProperty(msgtype)) {
                return webinosPZH.callbacks.store[msgtype][id];
            }
        },
        has: function(msgtype, id) {
            return webinosPZH.callbacks.store.hasOwnProperty(msgtype) &&
                   webinosPZH.callbacks.store[msgtype].hasOwnProperty(id) &&
                   typeof webinosPZH.callbacks.store[msgtype][id] === 'function';
        },
        unset: function(msgtype, id) {
            if (webinosPZH.callbacks.store.hasOwnProperty(msgtype)) {
              delete webinosPZH.callbacks.store[msgtype][id];
            }
        },
        store:{}
    },
    commands:{
        getZoneStatus:function (callback) {
            var nextId = webinosPZH.callbacks.set('getZoneStatus', callback);
            webinosPZH.send('getZoneStatus', nextId);            
        },
        getPzps:function (callback) {
            var nextId = webinosPZH.callbacks.set('getPzps', callback);
            webinosPZH.send('getPzps', nextId);
        },
        revokePzp:function (id, callback) {
            var nextId = webinosPZH.callbacks.set('revokePzp', callback);
            webinosPZH.send('revokePzp', nextId, {"pzpid":id});            
        },
        listAllServices:function (callback) {
            var nextId = webinosPZH.callbacks.set('listAllServices', callback);
            webinosPZH.send('listAllServices', nextId);
        },
        listUnregServices:function (at, callback) {
            var nextId = webinosPZH.callbacks.set('listUnregServices', callback);
            webinosPZH.send('listUnregServices', nextId, {"at":at });
        },
        registerService:function (at, name, callback) {
            var nextId = webinosPZH.callbacks.set('registerService', callback);
            webinosPZH.send('registerService', nextId, {"at":at, "name":name});
        },
        unregisterService:function (svAddress, svId, svAPI, callback) {
            var nextId = webinosPZH.callbacks.set('unregisterService', callback);
            webinosPZH.send('unregisterService', nextId, {"at":svAddress, "svId":svId, "svAPI":svAPI});
        },
        getCrashLog:function (callback) {
            var nextId = webinosPZH.callbacks.set('getCrashLog', callback);
            webinosPZH.send('getCrashLog', nextId);
        },
        getInfoLog:function (callback) {
            var nextId = webinosPZH.callbacks.set('getInfoLog', callback);
            webinosPZH.send('getInfoLog', nextId);
        },
        getUserDetails:function (callback) {
            var nextId = webinosPZH.callbacks.set('getUserDetails', callback);
            webinosPZH.send('getUserDetails', nextId);
        },
        restartPzh:function () {
            webinosPZH.send('restartPzh');
        },
        getAllPzh:function (callback) {
            var nextId = webinosPZH.callbacks.set('getAllPzh', callback);
            webinosPZH.send('getAllPzh', nextId);
        },
        getRequestingExternalUser:function (callback) {
            var nextId = webinosPZH.callbacks.set('getRequestingExternalUser', callback);
            webinosPZH.send('getRequestingExternalUser', nextId);
        },
        removePzh:function (id, callback) {
            var nextId = webinosPZH.callbacks.set('removePzh', callback);
            webinosPZH.send('removePzh', nextId, {id: id});
        },
        removePzp:function (id, callback) {
            var nextId = webinosPZH.callbacks.set('removePzp', callback);
            webinosPZH.send('removePzp', nextId, {id: id});
        }
    }
};
