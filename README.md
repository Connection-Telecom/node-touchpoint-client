
# touchpoint-client

Allows you to act as a Touchpoint user from a node server. Currently only text chats are supported.

## Install

    npm install --save touchpoint-client

## Usage

    const touchpoint = require('touchpoint-client');
    const client = touchpoint.createClient();
    client.on('message', (msg, chatId) => {
      console.log(msg);
    });
    client.createChat({customerId: 'tDNRFKYYtyrAnhais', topic: 'test chat'}).then(chatId => {
      client.sendMessage('Hello there!', chatId).catch(err => {
        console.log('Error occurred while sending message');
      });
    })

Also see [node-touchpoint-client-sample](https://github.com/Connection-Telecom/node-touchpoint-client-sample).

## API

### touchpoint.isAvailable(customerId[, team[, url[, proxy]]])

Check if a team is available (i.e. has logged-in text agents who are not paused).

#### Arguments

* `customerId` *string required*: ID of the customer to check
* `team` *string*: Name of the team to check, `default` if unspecified
* `url` *string*: URL of the Touchpoint server, including the trailing `/`. `https://touchpoint.telviva.com/` if unspecified
* `proxy` *string*: URL of an HTTP proxy to use, if needed

#### Returns

Promise which resolves to `{ available: true }` or `{ available: false }`.

### touchpoint.createClient(options)

Create a new client.

#### Arguments

* `options.url` *string*: URL of the Touchpoint websocket. `wss://touchpoint.telviva.com/websocket` if unspecified
* `options.proxy` *string*: URL of an HTTP proxy to use, if needed. Be warned that some HTTP proxies may not correctly support Websockets.

#### Returns

Client instance, which is also an `EventEmitter`.

### client.createChat(options)

Create a new chat.

#### Arguments

* `options.customerId` *string required*: ID of the customer to chat to.
* `options.team` *string*: Name of the team to chat to, `default` if unspecified
* `options.channel` *string*: Channel to use, `text` if unspecified. (Only text chat is supported.)
* `options.topic` *string*: Chat topic.
* `options.signedContext` *string*: JSON object containing the signed context fields, if necessary
* `options.signature` *string*: base64-encoded signature of the signed context, if necessary
* `options.unsignedContext` *string|object*: JSON object containing the unsigned context fields, if necessary

#### Returns

Promise resolving to the ID of the new chat.

### client.closeChat(chatId)

Close a chat that you previously created.

#### Arguments

* `chatId` *string required*: Chat ID of the chat to close.
  Must be one of the chats you created.

#### Returns

Promise which resolves to `undefined` once the chat is closed.

### client.sendMessage(message, chatId[, attachment])

Send a message to the agent.

#### Arguments

* `message` *string required*: Message to send.
* `chatId` *string required*: Chat ID to send the message to.
  Must be one of the chats you created.
* `attachment` *object*: Optional object to attach to the message. Valid formats are:

    client.sendMessage('Here is a message with attached link', chatId, {
      type: 'link',
      url: 'https://github.com/Connection-Telecom/node-touchpoint-client',
      title: 'Node Touchpoint client'
    });

    client.sendMessage('Here is a message with attached file', chatId, {
      type: 'file',
      url: 'https://example.com/path/to/file.bin',
      filename: 'file.bin'
    });

    client.sendMessage('Here is a message with attached image', chatId, {
      type: 'image',
      url: 'https://example.com/path/to/image.png'
    });

    client.sendMessage('Here is a message with attached audio', chatId, {
      type: 'audio',
      url: 'https://example.com/path/to/audio.mp3'
    });

    client.sendMessage('Here is a message with attached video', chatId, {
      type: 'video',
      url: 'https://example.com/path/to/video.mp4'
    });

    client.sendMessage('Here is a message with attached location', chatId, {
      type: 'location',
      title: 'Connection Telecom Cape Town office',
      lat: -33.933986,
      long: 18.471258
    });

#### Returns

Promise which resolves to `undefined` once the message is sent. If Touchpoint modified the message
(e.g. to mask a credit card number), the promise will resolve to the new value.

### client.setUserIsTyping(isTyping, chatId)

Set whether or not the user is currently typing a message. Note that sending a message
automatically sets this to `false`.

#### Arguments

* `isTyping` *boolean required*: `true` if the user started typing, or `false` if the user stopped typing.
* `chatId` *string required*: Chat ID of the chat to update. Must be one of the chats you created.

#### Returns

Promise which resolves to `undefined` once the status was set.

### client.close()

Close the client and tear down the Websocket connection. Returns nothing. Will automatically
close all unclosed chats.

## Chat events

* `error`: emitted with an `Error` if an error occurs. If the error related to one chat,
  the chat ID is also included. If there is no chat ID, the error is a fatal error 
  which also closes the client.
* `message`: When one of the chats you created receives a message, this is emitted 
  with a message object sent by the agent or by Touchpoint itself, and the chat ID.
  The message object will always have two fields `type` and `message`, and may have more.
  `type` is `agentMsg` for a message sent by the agent; all other types are messages sent by the system.
* `chatReady`: emitted with a chat ID once that chat has finished initializing.
* `agentIsTyping`: emitted with `{ agentIsTyping: true }` or `{ agentIsTyping: false }` along with a
  chat ID when the agent starts or stops typing a message.
* `agentId`: emitted with `{ agentId: string|null }` along with a chat ID
   when the agent taking the chat changes or if the chat enters the queue.
   If the chat enters the queue, `agentId` is `null`.
   This is generally accompanied by a message with type `claim` or `queue`.
* `chatClosed`: emitted with a chat ID if the agent closes the chat.
  It is not necessary to call `client.closeChat` yourself in this case.