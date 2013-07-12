webinos-pzh
===========

The webinos Personal Zone Hub (PZH) is an online router for webinos-enabled devices, as well as providing authentication between people in different personal zones.

The PZH consists of two different web servers:

* A TLS server, running by default on port 80, which listens for connections by PZPs and other PZHs.
* A web server, running by default on port 443, which serves webpages to people connecting with a browser.

These two servers can be on different machines, and communicate through a TLS connection established by the PZH Web Server.  However, separating these two servers is currently not supported.

The TLS Server
==============

The code for the TLS server can be found in 'lib' directory.  Tests are in the 'test' directory.

The Web Server
==============

The majority of the server-side code is located in the 'web-lib' directory.

If you want to modify any of the web pages served by the PZH, please see the 'web-lib/views' directory for the Jade templates.  The CSS and JavaScript are served from the 'public' directory.

Configuration of the web server is through the 'config.json' (to set the port) and the 'webconfig.json' files.  You need to edit the 'webconfig.json' file to enable Facebook and Twitter authentication.