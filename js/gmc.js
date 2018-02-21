function _hasClass(el, className) {
  if (el.classList)
    return el.classList.contains(className);
  else
    return new RegExp('(^| )' + className + '( |$)', 'gi').test(el.className);
}
function _hasData(el, dataName) {
  if (el.dataset)
    return el.dataset.hasOwnProperty(dataName);
  else
    return el.getAttribute('data-' + dataName);
}

function resizeIframe(obj) {
  obj.style.height = obj.contentWindow.document.body.scrollHeight + 'px';
}

function fetchJson(url, success, fail, httpHeaders) {
  var request = new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState === 4) { 
      if (request.status === 200) {
        success(JSON.parse(request.responseText));
      } else {
        fail();
      }
    } else {
      // HTTP is continuing....
    }
  };
  request.open('GET', url);
  var httpHeaders = httpHeaders || {};
  Object.keys(httpHeaders).forEach(function(key) {
    request.setRequestHeader(key, httpHeaders[key]);
  });
  request.send();
}
/*
2 possible initializations: 
  1. (iframe + data-gmc-theme + data-gmc-repo).
  2. (root_el + data-gmc-repo) containing the template markup.

In the first case, the template will be downloaded (using 
themesBaseURL + themeName) and loaded inside the iframe. The 
body can then be used as the root_el, leading us to the same 
situation as in case 2.

To speed up things, the theme (inside the iframe) and the json 
from the api can load at the same time.

*/

function GMC(root_el, json) { 'use strict';
  var self = this;

  // url used to locate a theme template from its name: (themeBaseURL + themeName + .html)
  var themesBaseURL = "https://cdn.rawgit.com/tsucres/GithubManyfacedCards/master/dist/themes/";
  // github api url to retrieve repo data: (repoApiURL + repoFullName)
  var repoApiURL = "https://api.github.com/repos/";

  this.repoFullName = root_el.getAttribute("data-gmc-repo");
  this.json = json;
  this.root_el = null;

  /**
    Fetch the json data about the repo whose name is in 
    self.repoFullName and fill them in the template.
  */
  this.fillWithRepoName = function() {
    var headers = {};
    if (typeof GH_API_KEY === "string") {
      headers["Authorization"] = "token " + GH_API_KEY; // Untested!!!!
    }
    headers['Accept'] = "application/vnd.github.mercy-preview+json";
    fetchJson(repoApiURL + self.repoFullName, function(json) {
      self.json = json
      self.fillWithRepoJson();
    }, function() {
      self.markError();
      //console.log("Shout! Json failed loading!");
    }, headers);
  }

  /**
    Find all the elements (inside self.root_el) having a 
    'data-gmc-id' attribute and fill them using the data pointing 
    by this attribute in self.json.
    It requires root_el, json and repoName to be filled. Otherwise 
    it quits.
    */
  this.fillWithRepoJson = function() {
    if (!(self.root_el && self.json && self.repoFullName))
      return
    var elements = self.root_el.querySelectorAll('[data-gmc-id]');
    elements.forEach(function(el) {
      gcm_fill_one_el_with_json(el, self.json)
    });
    this.markAsLoaded();
    if (typeof this.iframe === "object") {
      resizeIframe(this.iframe);
    }
  }

  /// Add the class 'gmc-loaded' to root_el
  this.markAsLoaded = function() {
    self.root_el.className += ' gmc-loaded';
  }
  /// Add the class 'gmc-error' to root_el
  this.markError = function() {
    self.root_el.className += ' gmc-error';
  }

  /**
    Parses the attributes of the specified element, looking for 
    'data-gm-id'. Fill the specified element with the data pointed 
    by this attribute in json.

    element: HTMLElement with specified data-gmc-id
    json: json retrieved from github api
    */
  function gcm_fill_one_el_with_json(element, json) {
    var gmcId = element.getAttribute("data-gmc-id");
    if (gmcId) {
      gmcId = gmcId.replace(" ", "");
      var gmcIdList = gmcId.split(",");
      gmcIdList.forEach(function(id) {
        gmc_fill_one_el_with_gmc_id(element, json, id);
      });
    }
  }

  /**
    Fill the specified element with the right data from json.

    element: HTMLElement
    json: json retrieved from github api.
    gmcId: a string with format where__what[__js]. If '__js' is 
      specified, then element should also have a 'data-gmc-js' 
      attribute. Otherwise it's just ignored.
    */
  function gmc_fill_one_el_with_gmc_id(element, json, gmcId) {
    var splitted = gmcId.split("__");
    if (splitted.length < 2)
      return // It should at least have a 'what' and a 'where'

    var what = splitted[1];
    var where = splitted[0];
    var js = (splitted.length >= 2 
              && splitted[2] == "js" 
              && element.getAttribute("data-gmc-js"));
    gmc_fill_one_el_with_wwj(element, json, what, where, js);
  }

  /**
    basically does the following: element.where += js(json[what])

    element: HTMLElement to which the "what" will be added.
    json: the json resulting the github api
    what: a key in the json. The hierarchy has to be marked using a 
      dash '-'.
    where: the attribute (from element) to which the jsonValue will be 
      assigned
    js: a boolean indicating whether there is a 'data-gmc-js' attribute 
      n the 'element'. If so, the javascript code it contains will be 
      evaluated as a function with, as a parameter, the jsonValue. This 
      code should return a value that will be assign to 'where'.
    */
  function gmc_fill_one_el_with_wwj(element, json, what, where, js) {
    var splittedWhat = what.split("-");
    var subJson = json;
    var jsonValue = null;
    splittedWhat.some(function(whatPart) {
      if (!subJson.hasOwnProperty(whatPart))
        return true;
      else if (typeof subJson[whatPart] === "object") {
        subJson = subJson[whatPart];
      } else {
        jsonValue = subJson[whatPart];
        return true;
      }
      
    });

    if (js) {
      var jsFunction = element.getAttribute("data-gmc-js");
      var doc = element.ownerDocument;
      var win = doc.defaultView || doc.parentWindow;
      if(typeof win[jsFunction] === "function")
        jsonValue = win[jsFunction].call(null, jsonValue, element, self);
    }
    if (jsonValue === null) {
      return
    }
    var ap = typeof self.root_el.getAttribute("data-gmc-ap") === "string";
    if (where == "in") {
      var textBackup = ap ? element.textContent : "";
      element.textContent = textBackup + jsonValue;
    } else {
      var whereBackup = "";
      if (ap && element.hasAttribute(where)) {
        whereBackup = element.getAttribute(where);
      }
      element.setAttribute(where, whereBackup + jsonValue);

    }

    
  }



  if (root_el.tagName === "IFRAME") {
    // case 1)
    this.iframe = root_el;
    root_el.onload = function() {
      self.root_el = root_el.contentWindow.document.body;
      // This is async, in race with the download of the json data. 
      // If the json isn't fetched yet, the call to this function will 
      // just return.
      self.fillWithRepoJson(); 
    };
    /*root_el.onerror = function() {
      console.log("error root");
    }*/
    if (root_el.getAttribute("data-gmc-theme-url")) {
      root_el.src = root_el.getAttribute("data-gmc-theme-url");
    } else {
      var themeName = root_el.getAttribute("data-gmc-theme") || "gh_pure";
      root_el.src = themesBaseURL + themeName + ".html";
    }
    
  } else { 
    // case 2)
    self.root_el = root_el;
  }
  if (this.json) {
    this.fillWithRepoJson();
  } else {
    this.fillWithRepoName();
  }
}

/**
  loadAllCards([json])
  Calls (new GMC(el, json)) for every elemement selected by 
  '[data-gmc-repo]'
  
  if json is not specified, it will be downloaded from the api 
  using the repo name specified in data-gmc-repo.
  */
GMC.loadAllCards = function(json) {
  var iframes = document.querySelectorAll('[data-gmc-repo]');
  iframes.forEach(function(iframe) {
    (new GMC(iframe, json));
  });
}

//window.onload = GMC.loadAllCards
function getStyleForLanguage(lang) {
  return "background-color: " + githubColorForLanguage(lang) + ";";
}
function githubColorForLanguage(lang) {
    var color_map = {"Mercury":"#ff2b2b","TypeScript":"#2b7489","PureBasic":"#5a6986","Objective-C++":"#6866fb","Self":"#0579aa","edn":"#db5855","NewLisp":"#87AED7","Jupyter Notebook":"#DA5B0B","Rebol":"#358a5b","Frege":"#00cafe","Dart":"#00B4AB","AspectJ":"#a957b0","Shell":"#89e051","Web Ontology Language":"#9cc9dd","xBase":"#403a40","Eiffel":"#946d57","Nix":"#7e7eff","RAML":"#77d9fb","MTML":"#b7e1f4","Racket":"#22228f","Elixir":"#6e4a7e","SAS":"#B34936","Agda":"#315665","wisp":"#7582D1","D":"#ba595e","Kotlin":"#F18E33","Opal":"#f7ede0","Crystal":"#776791","Objective-C":"#438eff","ColdFusion CFC":"#ed2cd6","Oz":"#fab738","Mirah":"#c7a938","Objective-J":"#ff0c5a","Gosu":"#82937f","FreeMarker":"#0050b2","Ruby":"#701516","Component Pascal":"#b0ce4e","Arc":"#aa2afe","Brainfuck":"#2F2530","Nit":"#009917","APL":"#5A8164","Go":"#375eab","Visual Basic":"#945db7","PHP":"#4F5D95","Cirru":"#ccccff","SQF":"#3F3F3F","Glyph":"#e4cc98","Java":"#b07219","MAXScript":"#00a6a6","Scala":"#DC322F","Makefile":"#427819","ColdFusion":"#ed2cd6","Perl":"#0298c3","Lua":"#000080","Vue":"#2c3e50","Verilog":"#b2b7f8","Factor":"#636746","Haxe":"#df7900","Pure Data":"#91de79","Forth":"#341708","Red":"#ee0000","Hy":"#7790B2","Volt":"#1F1F1F","LSL":"#3d9970","eC":"#913960","CoffeeScript":"#244776","HTML":"#e44b23","Lex":"#DBCA00","API Blueprint":"#2ACCA8","Swift":"#ffac45","C":"#555555","AutoHotkey":"#6594b9","Isabelle":"#FEFE00","Metal":"#8f14e9","Clarion":"#db901e","JSONiq":"#40d47e","Boo":"#d4bec1","AutoIt":"#1C3552","Clojure":"#db5855","Rust":"#dea584","Prolog":"#74283c","SourcePawn":"#5c7611","AMPL":"#E6EFBB","FORTRAN":"#4d41b1","ANTLR":"#9DC3FF","Harbour":"#0e60e3","Tcl":"#e4cc98","BlitzMax":"#cd6400","PigLatin":"#fcd7de","Lasso":"#999999","ECL":"#8a1267","VHDL":"#adb2cb","Elm":"#60B5CC","Propeller Spin":"#7fa2a7","X10":"#4B6BEF","IDL":"#a3522f","ATS":"#1ac620","Ada":"#02f88c","Unity3D Asset":"#ab69a1","Nu":"#c9df40","LFE":"#004200","SuperCollider":"#46390b","Oxygene":"#cdd0e3","ASP":"#6a40fd","Assembly":"#6E4C13","Gnuplot":"#f0a9f0","JFlex":"#DBCA00","NetLinx":"#0aa0ff","Turing":"#45f715","Vala":"#fbe5cd","Processing":"#0096D8","Arduino":"#bd79d1","FLUX":"#88ccff","NetLogo":"#ff6375","C Sharp":"#178600","CSS":"#563d7c","Emacs Lisp":"#c065db","Stan":"#b2011d","SaltStack":"#646464","QML":"#44a51c","Pike":"#005390","LOLCODE":"#cc9900","ooc":"#b0b77e","Handlebars":"#01a9d6","J":"#9EEDFF","Mask":"#f97732","EmberScript":"#FFF4F3","TeX":"#3D6117","Nemerle":"#3d3c6e","KRL":"#28431f","Ren'Py":"#ff7f7f","Unified Parallel C":"#4e3617","Golo":"#88562A","Fancy":"#7b9db4","OCaml":"#3be133","Shen":"#120F14","Pascal":"#b0ce4e","F#":"#b845fc","Puppet":"#302B6D","ActionScript":"#882B0F","Diff":"#88dddd","Ragel in Ruby Host":"#9d5200","Fantom":"#dbded5","Zephir":"#118f9e","Click":"#E4E6F3","Smalltalk":"#596706","DM":"#447265","Ioke":"#078193","PogoScript":"#d80074","LiveScript":"#499886","JavaScript":"#f1e05a","VimL":"#199f4b","PureScript":"#1D222D","ABAP":"#E8274B","Matlab":"#bb92ac","Slash":"#007eff","R":"#198ce7","Erlang":"#B83998","Pan":"#cc0000","LookML":"#652B81","Eagle":"#814C05","Scheme":"#1e4aec","PLSQL":"#dad8d8","Python":"#3572A5","Max":"#c4a79c","Common Lisp":"#3fb68b","Latte":"#A8FF97","XQuery":"#5232e7","Omgrofl":"#cabbff","XC":"#99DA07","Nimrod":"#37775b","SystemVerilog":"#DAE1C2","Chapel":"#8dc63f","Groovy":"#e69f56","Dylan":"#6c616e","E":"#ccce35","Parrot":"#f3ca0a","Grammatical Framework":"#79aa7a","Game Maker Language":"#8fb200","Papyrus":"#6600cc","NetLinx+ERB":"#747faa","Clean":"#3F85AF","Alloy":"#64C800","Squirrel":"#800000","PAWN":"#dbb284","UnrealScript":"#a54c4d","Standard ML":"#dc566d","Slim":"#ff8f77","Perl6":"#0000fb","Julia":"#a270ba","Haskell":"#29b544","NCL":"#28431f","Io":"#a9188d","Rouge":"#cc0088","C++":"#f34b7d","AGS Script":"#B9D9FF","Dogescript":"#cca760","nesC":"#94B0C7"};
    if (color_map.hasOwnProperty(lang)) {
      return color_map[lang];
    } else {
      return "#fff";
    }
  }

  function humanReadable(num) {
   if(num == 0) return '0';
   var k = 1000,
       dm = 1,
       sizes = ['', ' k', ' M', ' B', ' T'],
       i = Math.floor(Math.log(num) / Math.log(k));
   return parseFloat((num / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}
function getStargazersURL(repoFullName) {
  return 'https://github.com/' + repoFullName + '/stargazers/';
}
function getRepoURL(fullRepoName) {
	return "https://github.com/" + fullRepoName;
}
/**
  Returns the specified iso formatted date into another format: "MMM dd yyyy"
  */
function formatDate(isoDateStr) {
  var date = new Date(isoDateStr);
  var monthNames = [
    "Jan", "Feb", "Mar",
    "Apr", "May", "Jun", "Jul",
    "Aug", "September", "Oct",
    "Nov", "Dec"
  ];

  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();
  var yearStr = "";
  if (year != (new Date()).getFullYear()) {
    yearStr = ", " + String(year);
  }

  return  monthNames[monthIndex] + ' ' + day + ' ' + yearStr;
}