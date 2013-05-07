webinos-pzhWebServer
====================

This is the web server component of the webinos Personal Zone Hub provider.

In this repository you can find

 * HTML, JavaScript and CSS for the PZH web server user interface
 * Details of how the PZH web server authenticates users through their identity provider, and how new devices are enrolled into a user's personal zone.
 * The source code for the connection between the PZH web server and the PZH TLS server (webinos-pzh)

Technical details
=================

A _webinos personal zone_ - a collection of devices belonging to one user - is centred around an online _personal zone hub_ (PZH).  This hub provides inter-connectivity between devices which may be behind firewalls or network address translation and would otherwise be inaccessible from the internet.  Personal zone hubs receive connections from devices running _personal zone proxies_ (PZP) and provides an administration interface for users.

A personal zone hub is provided by a _personal zone hub provider_ that may host many hubs.  This is made up of two components, the _personal zone hub TLS server_ (see the webinos-pzh project) and the _personal zone hub web server_ (this project).  The web server is responsible for providing an administration interface, authenticating web users, and enrolling new devices into the personal zone.  The TLS server provides the real webinos functionality and routes messages to PZPs.

This repository uses Express and NodeJS, and must (currently) be installed as part of the webinos-pzh project.  It would be extraordinarily easy to use this as a stand-alone server, but we currently don't support it.

Installation Instructions
=========================

Don't install this module directly, use it as a sub-module of the webinos-pzh project.  It will be installed automatically as part of npm-install.
