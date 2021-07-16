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
const { response } = require("express");
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

async function GetAllSenders(apiID) {
	var senderQuery = await db.query(
		"SELECT sender_api_id, sender_name, muted, offline_notification FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1",
		[apiID]
	);
	if (senderQuery === -1)
		return res.send({ error: "Failed to fetch senders" });
	if (senderQuery.rowCount === 0) return res.send({ senders: [] });
	var senders = [];
	for (var i = 0; i < senderQuery.rowCount; i++) {
		var row = senderQuery.rows[i];
		senders.push({
			apiID: row.sender_api_id,
			name: row.sender_name,
			muted: row.muted,
			notifyIf: row.notifyIf,
		});
	}
	return senders;
}

app.post("/user/create", async (req, res) => {
	var apiID = GenerateApiID();

	var user_id = uuid.v4();

	var result = await db.query(
		"INSERT INTO app_user(user_id, user_api_id) VALUES ($1, $2)",
		[user_id, apiID]
	);
	if (result === -1) {
		res.send({ error: "Failed to create user" });
	} else {
		return res.send({ apiID: apiID });
	}
});

app.post("/user/registerPushToken", async (req, res) => {
	var pushToken = req.body.pushToken;
	var apiID = req.body.apiID;
	var result = await db.query(
		"UPDATE app_user SET push_token = $1 WHERE user_api_id = $2",
		[pushToken, apiID]
	);
	if (result === -1)
		return res.send({ error: "Failed to register push token" });
	return res.sendStatus(200);
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
	var senders = await GetAllSenders(apiID);
	res.send({ senders: senders });
});

app.post("/sender/get/all", async (req, res) => {
	var senders = await GetAllSenders(req.body.apiID);
	return res.send({ senders: senders });
});

app.post("/sender/edit/mute", async (req, res) => {
	var senderApiID = req.body.senderApiID;
	var muted = req.body.mute;
	var apiID = req.body.apiID;
	var validation = await db.query(
		"SELECT sender_id FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 AND sender.sender_api_id = $2",
		[apiID, senderApiID]
	);
	if (validation === -1 || validation.rowCount === 0) {
		return res.send({
			error: "You do not have permission to edit this sender",
		});
	}
	var q = await db.query(
		"UPDATE sender SET muted = $1 WHERE sender_api_id = $2",
		[muted, senderApiID]
	);
	if (q === -1) return res.send({ error: "Failed to update name" });
	var senders = await GetAllSenders(apiID);
	res.send({ senders: senders });
});

app.post("/sender/edit/notify", async (req, res) => {
	var senderApiID = req.body.senderApiID;
	var notifyIn = req.body.notifyIn;
	var apiID = req.body.apiID;
	var validation = await db.query(
		"SELECT sender_id FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 AND sender.sender_api_id = $2",
		[apiID, senderApiID]
	);
	if (validation === -1 || validation.rowCount === 0) {
		return res.send({
			error: "You do not have permission to edit this sender",
		});
	}
	var q = await db.query(
		"UPDATE sender SET offline_notification = $1 WHERE sender_api_id = $2",
		[notifyIn, senderApiID]
	);
	if (q === -1) return res.send({ error: "Failed to update name" });
	var senders = await GetAllSenders(apiID);
	res.send({ senders: senders });
});

app.post("/sender/edit/rename", async (req, res) => {
	var senderApiID = req.body.senderApiID;
	var name = req.body.name;
	var apiID = req.body.apiID;
	var validation = await db.query(
		"SELECT sender_id FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 AND sender.sender_api_id = $2",
		[apiID, senderApiID]
	);
	if (validation === -1 || validation.rowCount === 0) {
		return res.send({
			error: "You do not have permission to edit this sender",
		});
	}
	var q = await db.query(
		"UPDATE sender SET sender_name = $1 WHERE sender_api_id = $2",
		[name, senderApiID]
	);
	if (q === -1) return res.send({ error: "Failed to update name" });
	var senders = await GetAllSenders(apiID);
	res.send({ senders: senders });
});

app.post("/sender/delete", async (req, res) => {
	var apiID = req.body.apiID;
	var senderApiID = req.body.senderApiID;

	var validation = await db.query(
		"SELECT sender_id FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 AND sender.sender_api_id = $2",
		[apiID, senderApiID]
	);
	if (validation === -1 || validation.rowCount === 0) {
		return res.send({
			error: "You do not have permission to delete this sender",
		});
	}

	var result = await db.query("DELETE FROM sender WHERE sender_api_id = $1", [
		senderApiID,
	]);
	if (result === -1) return res.send({ error: "Failed to delete sender." });
	var senders = await GetAllSenders(apiID);
	res.send({ senders: senders });
});

app.post("/sender/get/messages/latest", async (req, res) => {});

app.post("/sender/get/messages/sender", async (req, res) => {});

app.post("/send/message", async (req, res) => {});

httpServer.listen(3005);
