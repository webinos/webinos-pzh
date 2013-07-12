/*******************************************************************************
*  Code contributed to the webinos project
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* Copyright 2013 John Lyle, University of Oxford
*******************************************************************************/

var Browser = require("zombie");
var assert = require("assert");
var util = require('util');

var pzhwsPath = "https://localhost:6443/";

describe("The PZH Web Server", function() {

  beforeEach(function() {
    Browser.debug = true;
    browser = new Browser()
  });
  
  afterEach(function() {
      browser.close();
  }); 

  it("is running", function() {
    var finished = false;

    runs(function() {
      browser.
        visit(pzhwsPath).
        then(function() {
          var document = browser.document;    
          finished = true;
        });
    });    
    
    waitsFor(function() {
      return finished;
    }, "The browser never completed", 2000);
    
    runs(function() {
      //we got there
      expect(browser.success).toBe(true);
      // we're at the login page
      expect(browser.location.pathname).toBe("/login");
      // the first heading label is a login script
      expect(browser.text("header > label")).toBe("Personal Zone Hub login");
    });
    
  });
  
  it("Requires authentication to see a profile", function() {
    var finished = false;

    runs(function() {
      browser.
        visit(pzhwsPath + "home").
        then(function() {
          var document = browser.document;    
          finished = true;
        });
    });    
    
    waitsFor(function() {
      return finished;
    }, "The browser never completed", 2000);
    
    runs(function() {
      //we got there
      expect(browser.success).toBe(true);
      // we're at the login page
      expect(browser.location.pathname).toBe("/login");
      // the first heading label is a login script
      expect(browser.text("header > label")).toBe("Personal Zone Hub login");
    });
  });
});

