require("dotenv").config();

var fs = require("fs");
var path = require("path");
var http = require("http");
var db = require("./db/db.js");
var { zonedTimeToUtc } = require("date-fns-tz");
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
		"SELECT sender_api_id, sender_name, muted FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1",
		[apiID]
	);
	if (senderQuery === -1)
		return res.send({ error: "Failed to fetch senders" });
	if (senderQuery.rowCount === 0) return [];
	var senders = [];
	for (var i = 0; i < senderQuery.rowCount; i++) {
		var row = senderQuery.rows[i];
		senders.push({
			apiID: row.sender_api_id,
			name: row.sender_name,
			muted: row.muted,
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

app.post("/sender/get/homepage", async (req, res) => {
	const apiID = req.body.apiID;
	var senders = [];
	var latestMessageQuery = await db.query(
		"SELECT DISTINCT ON(message.sender_id) message_content, sent_time, seen, sender_api_id, sender_name FROM app_user INNER JOIN message USING(user_id) INNER JOIN sender USING(sender_id) WHERE user_api_id=$1 AND sender.sender_id IN(SELECT sender_id FROM message) ORDER BY message.sender_id, sent_time DESC;",
		[apiID]
	);
	if (latestMessageQuery === -1)
		return res.send({ error: "Failed to get senders" });
	for (var i = 0; i < latestMessageQuery.rowCount; i++) {
		senders.push({
			apiID: latestMessageQuery.rows[i].sender_api_id,
			name: latestMessageQuery.rows[i].sender_name,
			message: {
				message: latestMessageQuery.rows[i].message_content,
				date: latestMessageQuery.rows[i].sent_time,
				seen: latestMessageQuery.rows[i].seen,
			},
		});
	}

	var otherSendersQuery = await db.query(
		"SELECT sender_id, sender_api_id, sender_name FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id=$1 AND sender_id NOT IN(SELECT sender_id FROM message);",
		[apiID]
	);
	if (otherSendersQuery === -1)
		return res.send({ error: "Failed to get senders" });
	for (var i = 0; i < otherSendersQuery.rowCount; i++) {
		senders.push({
			apiID: otherSendersQuery.rows[i].sender_api_id,
			name: otherSendersQuery.rows[i].sender_name,
		});
	}
	res.send({ senders: senders });
});

app.post("/sender/get/messages/sender", async (req, res) => {
	const apiID = req.body.apiID;
	const senderApiID = req.body.senderApiID;

	var validation = await db.query(
		"SELECT sender_id FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 AND sender.sender_api_id = $2",
		[apiID, senderApiID]
	);
	if (validation === -1 || validation.rowCount === 0) {
		return res.send({
			error: "You do not have permission to view this sender",
		});
	}

	var senderID = await db.query(
		"SELECT sender_id FROM sender WHERE sender_api_id = $1",
		[senderApiID]
	);
	if (senderID === -1 || senderID.rowCount === 0)
		return res.send({ error: "Failed to fetch sender." });
	await db.query("UPDATE message SET seen=true WHERE sender_id = $1", [
		senderID.rows[0].sender_id,
	]);

	var fetchMessage = await db.query(
		"SELECT message_id, message_content, sent_time FROM message WHERE sender_id=$1 ORDER BY sent_time ASC",
		[senderID.rows[0].sender_id]
	);
	if (fetchMessage === -1)
		return res.send({ error: "Failed to fetch messages" });
	var messages = [];
	for (var i = 0; i < fetchMessage.rowCount; i++) {
		var row = fetchMessage.rows[i];
		messages.push({
			message: row.message_content,
			sentTime: row.sent_time,
			id: row.message_id,
		});
	}
	res.send({ messages: messages });
});

app.post("/user/verify", async (req, res) => {
	var apiID = req.body.apiID;
	var account = await db.query(
		"SELECT user_id FROM app_user WHERE user_api_id=$1",
		[apiID]
	);
	if (account === -1) return res.sendStatus(500);
	if (account.rowCount === 0)
		return res.send({ error: "Account doesn't exist" });
	return res.send(200);
});

app.post("/send/message", async (req, res) => {
	var senderApiID = req.body.senderApiID;
	var apiID = req.body.targetApiID;
	var message = req.body.message;
	var notify = req.body.notify;
	var nowUtc = zonedTimeToUtc(Date.now(), "Pacific/Auckland");

	var validation = await db.query(
		"SELECT sender_id, user_id, push_token, muted FROM app_user INNER JOIN sender USING(user_id) WHERE user_api_id = $1 AND sender.sender_api_id=$2",
		[apiID, senderApiID]
	);
	if (validation === -1) return res.sendStatus(500);
	if (validation.rowCount === 0) return res.sendStatus(400);

	var user_id = validation.rows[0].user_id;
	var sender_id = validation.rows[0].sender_id;
	var push_token = validation.rows[0].push_token;

	var insertQuery = await db.query(
		"INSERT INTO message(message_content, user_id, sender_id, sent_time) VALUES($1, $2, $3, $4)",
		[message, user_id, sender_id, nowUtc]
	);
	if (insertQuery === -1) return res.sendStatus(500);

	if (!validation.rows[0].muted && notify) {
		let messages = [];

		messages.push({
			to: push_token,
			title: "Notifer",
			sound: "default",
			body: message,
		});

		let chunks = expo.chunkPushNotifications(messages);

		(async () => {
			for (let chunk of chunks) {
				try {
					let receipts = await expo.sendPushNotificationsAsync(chunk);
					console.log(receipts);
				} catch (error) {
					console.error(error);
				}
			}
		})();
	}

	res.sendStatus(200);
});

httpServer.listen(3005);
