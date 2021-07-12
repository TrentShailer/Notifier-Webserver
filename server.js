require("dotenv").config();

var fs = require("fs");
var path = require("path");
var http = require("http");

var bodyParser = require("body-parser");

// Initialise libraries
var express = require("express");
var app = express();

var httpServer = http.createServer(app);

app.set("trust proxy", 1);

httpServer.listen(3005);
