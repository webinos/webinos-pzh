var pzp_api = require("../../lib/pzh_tlsSessionHandling.js");
var webinosPath = require("webinos-utilities").webinosPath.webinosPath();
var wUtil = require("webinos-utilities");
var certificateHandler = require("webinos-certificateHandler");
var providerPort = require("../../config.json").ports.provider;
var providerWebServer = require("../../config.json").ports.provider_webServer;
var pzhWebCertificates, pzhAddress;

function createPzhProvider() {
    var inputConfig = {
        "friendlyName": "",
        "sessionIdentity": pzhAddress
    };
    var config = new wUtil.webinosConfiguration("PzhP", inputConfig);
    config.cert = new certificateHandler(config.metaData);
    if(config.loadWebinosConfiguration() && config.loadCertificates(config.cert)){
        if((csr=config.cert.generateSelfSignedCertificate("PzhWS", "PzhWS"))) {
            if((clientCert= config.cert.generateSignedCertificate(csr))) {
                config.cert.internal["webclient"].cert = clientCert;
                pzhWebCertificates =   {
                    key:  config.cert.keyStore.fetchKey(config.cert.internal.webclient.key_id),
                    cert: config.cert.internal.webclient.cert,
                    ca:   config.cert.internal.master.cert,
                    requestCert: true,
                    rejectUnauthorized: true
                };
                return true;
            }
        }
    }
    return false;
}

function createPzh(pzhConnection, email, displayName) {
    var nickname = email.split("@")[0]
    var user = {
        emails: [{value:email}],
        displayName: displayName,
        from: "google",
        nickname:nickname,
        identifier:nickname+"@localhost"
    };
    pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "addPzh", "nickname":nickname}})));
    return user;
}

function connectProvider(callback) {
    wUtil.webinosHostname.getHostName("", function (address) {
        pzhAddress= address;
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,
        function () {
            expect(pzhConnection.authorized).toEqual(true);
            var user = createPzh(pzhConnection, "hello0@webinos.org", "hello0");
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "addPzh") {
                       expect(obj.payload.message.id).toContain(user.nickname);
                       callback(true);
                       pzhConnection.socket.end();
                    }
                });
            });
            pzhConnection.on("error", function(err){
               console.log(err);
            });
        });
    });    
}

describe("connect pzh provider and create pzh", function(){
   it("create pzh", function(done){
      wUtil.webinosHostname.getHostName("", function (address) {
        pzhAddress= address;
        if (createPzhProvider()) {
           connectProvider(function(){
               done();
           });
       }
     });
    }, 3000);
});

describe("test web api of PZH", function(){
    var email = "hello0@webinos.org";
    var nickname = email.split("@")[0]
    var user = {
        emails: [{value:email}],
        displayName: "hello0",
        from: "google",
        nickname:nickname,
        identifier:nickname+"@localhost"
    };
    it("get user data", function(done){
       var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
           expect(pzhConnection.authorized).toEqual(true);
           pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "getUserDetails"}})));
           pzhConnection.on("data", function (_buffer) {
               wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                   if(obj.payload && obj.payload.type && obj.payload.type === "getUserDetails") {
                       expect(obj.payload.message.authenticator).toEqual(user.from);
                       expect(obj.payload.message.friendlyName).toEqual(user.displayName);
                       expect(obj.payload.message.email).toEqual(user.emails[0].value);
                       pzhConnection.socket.end();
                       done();
                   }
               });
           });
       });
    });

    it("get connected details", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "getZoneStatus"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "getZoneStatus") {
                        expect(obj.payload.message.pzps).toEqual([]);
                        expect(obj.payload.message.pzhs[0].id).toEqual(user.displayName+" (Your Pzh)");
                        expect(obj.payload.message.pzhs[0].url).toContain(user.nickname);
                        expect(obj.payload.message.pzhs[0].isConnected).toBeTruthy();
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });

    it("get logs", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "getCrashLog"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "getCrashLog") {
                        expect(obj.payload.message).not.toBeNull();
                        pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "getInfoLog"}})));
                    } else if(obj.payload && obj.payload.type && obj.payload.type === "getInfoLog") {
                        expect(obj.payload.message).not.toBeNull();
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });

    it("get pzps", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "getPzps"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "getPzps") {
                        expect(obj.payload.message.revokedCert).toEqual([]);
                        expect(obj.payload.message.signedCert).toEqual([]);
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });

    it("enroll PZP", function(done){
        var webinosMetaData = {
            webinosRoot: webinosPath,
            webinosType: "Pzp",
            serverName: "0.0.0.0",
            webinosName: "machine0"
        };
        var cert = require("webinos-certificateHandler");
        var certificateInstance = new cert(webinosMetaData);
        certificateInstance.generateSelfSignedCertificate("PzpCA", "PzpCA:machine0");
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "csrFromPzp",
                from: webinosMetaData.webinosName, csr: certificateInstance.internal.master.csr, friendlyName: "Test"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "csrFromPzp") {
                        expect(obj.payload.message.from).toContain(user.nickname);
                        expect(obj.payload.message.to).toContain(webinosMetaData.webinosName);
                        expect(obj.payload.message.payload.message.clientCert).not.toBeNull();
                        expect(obj.payload.message.payload.message.masterCert).not.toBeNull();
                        expect(obj.payload.message.payload.message.masterCrl).not.toBeNull();
                        expect(obj.payload.message.payload.message.friendlyName).toEqual(user.displayName)
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });


    it("list services", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "listAllServices"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "listAllServices") {
                        expect(obj.payload.message.pzEntityList[0].pzId).toContain(user.nickname);
                        expect(obj.payload.message.services[0].serviceAddress).toContain(user.nickname);
                        expect(obj.payload.message.services[1].serviceAddress).toContain(user.nickname);
                        pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user,
                            message: {type: "listUnregServices", at: user.nickname + "@" + pzhAddress}})));
                     } else if(obj.payload && obj.payload.type && obj.payload.type === "listUnregServices") {
                        expect(obj.payload.message.pzEntityId).toContain(user.nickname);
                        expect(obj.payload.message.modules).not.toBeNull();
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });
    it("get all pzhs", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "getAllPzh"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "getAllPzh") {
                        expect(obj.payload.message).toEqual([]);
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });
    /*it("register and un-register service", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "registerService",
                at:pzhAddress+":"+providerWebServer+"_"+user.emails[0].value , name: "webinos-api-test"}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "registerService") {
                        console.log(obj.payload.message);
                        pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "unregisterService"}})));
                    } else if(obj.payload && obj.payload.type && obj.payload.type === "unregisterService") {
                        console.log(obj.payload.message);
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    }); */

    it("revokePzp", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "revokePzp", pzpid: { 'url' : user.nickname + "@" + pzhAddress + "/machine0"}}})));
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "revokePzp") {
                        expect(obj.payload.message).toBeTruthy();
                        pzhConnection.socket.end();
                        done();
                    }
                });
            });
        });
    });

    it("remove pzh", function(done){
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,function(){
            expect(pzhConnection.authorized).toEqual(true);
            pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "removePzh", id:user.nickname + "@" + pzhAddress }})));
            pzhConnection.on("data", function (_buffer) {
              wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                  if(obj.payload && obj.payload.type && obj.payload.type === "removePzh") {
                      console.log(obj.payload.message);
                      pzhConnection.socket.end();
                      //    "revokePzp"             :revokePzp,  "csrAuthCodeByPzp"      :csrAuthCodeByPzp,
                      done();
                  }
              });
            });
        });
    });
    // not repeating pzh certificate exchange as handled in pzp
});
