# Notifier Guide

-   ### [Overview](#Overview)

-   ## Examples

    -   ### [Javascript Example](#Javascript)

    -   ### [NodeJS Example](#NodeJS)

## Overview

> Remember to exclude any IDs from being published to your github repo

Notifer works by sending a push notification to a given device that is defined by a **User ID** from a given **Sender ID**.

In order to send a push notification, the webserver needs to receive a POST request to `/send/message`

This POST request must contain:

```text
	targetApiID: (String)<User ID>
	senderApiID: (String)<Sender ID>
	message: (String)<Message body>
	notify: (Optional Any)<If present send a push notification>
```

For Example via cURL

```shell
cURL -X POST -d targetApiID=####-####-#### -d senderApiID=####-####-#### -d message="Example notifier usage" -d notify http://notification.trentshailer.com/send/message
```

---

## Specific Examples

## Javascript

No libraries

```javascript
var xhr = new XMLHttpRequest();
xhr.open("POST", "http://notification.trentshailer.com/send/message");
xhr.setRequestHeader("Accept", "application/json");
xhr.setRequestHeader("Content-Type", "application/json");

xhr.onreadystatechange = function () {
	if (xhr.readyState === 4) {
		// Handle errors
	}
};

var data = {
	targetApiID: "####-####-####",
	senderApiID: "####-####-####",
	message: "Example javascript usage",
	notify: true,
};

xhr.send(data);
```

jQuery Ajax

```javascript
$.post("http://notification.trentshailer.com/send/message", {
	targetApiID: "####-####-####",
	senderApiID: "####-####-####",
	message: "Example javascript usage",
	notify: true,
});
```

---

## NodeJS

Using the axios library

```javascript
const axios = require("axios");

axios
	.post("http://notification.trentshailer.com/send/message", {
		targetApiID: "####-####-####",
		senderApiID: "####-####-####",
		message: "Example NodeJS usage",
		notify: true, // Do not include if you do not want a push notification
	})
	.catch((error) => {
		// Handle error status
	});
```
