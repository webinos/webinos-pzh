webinos-pzh
===========

The webinos Personal Zone Hub (PZH) is an online router for webinos-enabled devices, as well as providing 
authentication between people in different personal zones.

## Web Servers

The PZH consists of two different web servers:

* A TLS server, running by default on port 80, which listens for connections by PZPs and other PZHs.  The code for the TLS server can be found in 'lib' directory.  Tests are in the 'test' directory.
* A web server, running by default on port 443, which serves webpages to people connecting with a browser.  The web server is currently in repository [webinos-pzhWebServer](https://github.com/webinos/webinos-pzhWebServer), and ia a required dependency of the webinos-pzh
module.

These two servers can be on different machines, and communicate through a TLS connection 
established by the PZH Web Server.  However, separating these two servers is currently not supported.

## Installation

The webinos personal zone hub can be installed using the following instructions.  The hub was designed to operate on a web server, with constant access to the internet and with a permanent address.

### Requirements

The PZH currently requires nodejs version 0.8, and is not guaranteed to work on v0.10 or higher.

We have tested the PZH on Linux.  It should work on other platforms, but YMMV.

### Steps

* Download the latest version of webinos-pzh from github.
* Run `npm install` to install the dependencies.
* Run the PZH through `node webinos_pzh.js --host YOURDOMAINNAME`.  You will need to have superuser privileges to run node on low-number ports.  E.g., on Ubuntu run `sudo node webinos_pzh.js --host pzh.webinos.org`
* You can configure the ports that the PZH runs on through the config.json file found in ~/.webinosPzh/[your machine name]/config.json

### Other suggestions

* Use the 'forever' module to keep the PZH running in all circumstances.  E.g., 
   * `npm install -g forever`
   * `forever node webinos_pzh.js --host pzh.webinos.org`
* Use authbind to run the PZH on privileged port numbers without root privileges.  See the [man page](http://manpages.ubuntu.com/manpages/hardy/man1/authbind.1.html) for more information.  Unfortunately the PZH does not work behind reverse proxies such as NGINX.  We're working on it.
* Install your own DNS certificates.
   * Edit the file ~/.webinosPZH/[your machine name]/certificates/internal/...

## Customising the web server

### Adding authentication providers

The PZH comes pre-configured with support for Google and Yahoo sign-in.  Vanilla OpenID is also available, although turned off.  To turn it on, and to enable Twitter and Facebook, you need to edit the file [webinos-pzh/node_modules/webinos-pzhWebServer/config.json](https://github.com/webinos/webinos-pzhWebServer/blob/master/config.json).  

For Twitter and Facebook support you will need to add your own credentials, which you can download from their respective developer portals.

### Configuring login and user accounts

At present, the PZH is designed to use a file system to record user account details, in combination with identifiers from social network logins (see above).  We would welcome contributions of alternative approaches.

If you want to control who is allowed to register for an account, you will want to edit the project 'webinos-pzhWebServer' which performs the authentication and sign-up processes.  The 'signup.jade' page is probably what you're looking for, along with routes/index.js.
