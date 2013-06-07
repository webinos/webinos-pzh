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
    var user = {
        emails: [{value:email}],
        displayName: displayName,
        from: "google"
    };
    pzhConnection.write(wUtil.webinosMsgProcessing.jsonStr2Buffer(JSON.stringify({user: user, message: {type: "addPzh"}})));
    return user;
}

function connectProvider(callback) {
    wUtil.webinosHostname.getHostName("", function (address) {
        pzhAddress= address;
        console.log(providerPort, pzhAddress, pzhWebCertificates);
        var pzhConnection = require("tls").connect(providerPort, pzhAddress, pzhWebCertificates,
        function () {
            expect(pzhConnection.authorized).toEqual(true);
            var user = createPzh(pzhConnection, "hello0@webinos.org", "Hello#0");
            pzhConnection.on("data", function (_buffer) {
                wUtil.webinosMsgProcessing.readJson(this, _buffer, function (obj) {
                    if(obj.payload && obj.payload.type && obj.payload.type === "addPzh") {
                       callback(true);
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
       if (createPzhProvider()) {
           connectProvider(function(){
               done();
           });
       }
    }, 3000);
});

