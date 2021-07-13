const e = require("express");
const { Pool } = require("pg");

// Setup pool of clients to fetch from database
const pool = new Pool({
	user: process.env.DBUSER,
	host: "0.0.0.0",
	database: process.env.DB,
	password: process.env.DBPASS,
	port: process.env.DBPORT,
});

async function Connect() {
	// Connect to the database, if fails try again every 5 seconds for 20 tries before reporting a failure
	return new Promise(async (resolve) => {
		var tries = 20;
		while (tries > 0) {
			try {
				tries--;
				const client = await pool.connect();
				resolve(client);
				break;
			} catch (err) {
				console.log(
					`Failed to connect to database, ${tries} tries remaining`
				);
				await new Promise((res) => setTimeout(res, 5000));
			}
		}
		if (tries === 0) resolve(-1);
	});
}

async function query(sql, params = []) {
	// Connect to db
	const client = await Connect();
	if (client === -1) {
		console.error("Failed to connect to database");
		return -1;
	}

	try {
		// Query the database through a client
		const res = await client.query(sql, params);
		// release the client and return the result
		client.release();
		return res;
	} catch (err) {
		// Handle errors
		console.log({ error: err.message, sql: sql, params: params });
		client.release();
		return -1;
	}
}

module.exports.query = query;
