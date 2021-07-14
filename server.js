require("dotenv").config();

var fs = require("fs");
var path = require("path");
var http = require("http");
var db = require("./db/db.js");
var dateFormat = require("dateformat");
var uuid = require("uuid");
var { Expo } = require("expo-server-sdk");

// Initialise libraries
var express = require("express");
var app = express();

let expo = new Expo({});

var httpServer = http.createServer(app);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", 1);

function GenerateApiID() {
	var apiID = "";
	var chars = "abcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 1; i <= 12; i++) {
		var num = (Math.random() * 35).toFixed(0);
		apiID += chars[num];
		if (i % 4 === 0) apiID += "-";
	}

	apiID = apiID.substring(0, apiID.length - 1);
	return apiID;
}

async function GetUserID(apiID) {
	var result = await db.query(
		"SELECT user_id FROM app_user WHERE user_api_id = $1",
		[apiID]
	);
	return result;
}

app.post("/user/create", async (req, res) => {
	var pushToken = req.body.pushToken;
	var exists = await db.query(
		"SELECT user_api_id FROM app_user WHERE pushToken = $1",
		[pushToken]
	);
	if (exists.rowCount !== 0) {
		return res.send({ apiID: exists.rows[0].user_api_id });
	}
	var apiID = GenerateApiID();

	var user_id = uuid.v4();

	var result = await db.query(
		"INSERT INTO app_user(user_id, user_api_id, pushToken) VALUES ($1, $2, $3)",
		[user_id, apiID, pushToken]
	);
	if (result === -1) {
		res.sendStatus(500);
	} else {
		return res.send({ apiID: apiID });
	}
});

app.post("/sender/create", async (req, res) => {
	var name = req.body.name;
	var apiID = req.body.apiID;
	var limitCheck = await db.query(
		"SELECT sender_id FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 ;",
		[apiID]
	);
	if (limitCheck.rowCount + 1 > 10) {
		return res.send({ error: "Sender limit reached." });
	}

	var senderApiID = GenerateApiID();
	var senderID = uuid.v4();
	var user_id = await GetUserID(apiID);
	if (user_id === -1 || user_id.rowCount === 0) {
		return res.send({ error: "Failed to add sender" });
	}
	await db.query(
		"INSERT INTO sender(sender_id, user_id, sender_api_id, sender_name) VALUES ($1, $2, $3, $4)",
		[senderID, user_id.rows[0].user_id, senderApiID, name]
	);
	res.send({ apiID: senderApiID });
});

app.post("/sender/get/all", async (req, res) => {});

app.post("/sender/edit/mute", async (req, res) => {});

app.post("/sender/edit/notify", async (req, res) => {});

app.post("/sender/edit/rename", async (req, res) => {});

app.post("/sender/delete", async (req, res) => {});

app.post("/sender/get/messages/latest", async (req, res) => {});

app.post("/sender/get/messages/sender", async (req, res) => {});

app.post("/send/message", async (req, res) => {});

httpServer.listen(3005);
