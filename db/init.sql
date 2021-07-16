CREATE TABLE app_user (
	user_id UUID PRIMARY KEY NOT NULL,
	user_api_id VARCHAR UNIQUE NOT NULL,
	push_token VARCHAR DEFAULT null
);

CREATE TABLE sender (
	sender_id UUID PRIMARY KEY NOT NULL,
	user_id UUID NOT NULL,
	sender_api_id VARCHAR UNIQUE NOT NULL,
	sender_name VARCHAR NOT NULL,
	muted BOOLEAN DEFAULT false,
	CONSTRAINT fk_user_id FOREIGN KEY(user_id) REFERENCES app_user(user_id) ON DELETE CASCADE
);

CREATE TABLE message (
	message_id SERIAL PRIMARY KEY,
	message_content VARCHAR NOT NULL,
	user_id UUID NOT NULL,
	sender_id UUID NOT NULL,
	sent_time TIMESTAMPTZ NOT NULL,
	seen BOOLEAN DEFAULT false,
	CONSTRAINT fk_user_id FOREIGN KEY(user_id) REFERENCES app_user(user_id) ON DELETE CASCADE,
	CONSTRAINT fk_sender_id FOREIGN KEY(sender_id) REFERENCES sender(sender_id) ON DELETE CASCADE
);
CREATE INDEX sent_time_index on message(sent_time);
