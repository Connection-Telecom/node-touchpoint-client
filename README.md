
# touchpoint-client

Allows you to act as a Touchpoint user from a node server. Currently only text chats are supported.

## Install

    npm install --save touchpoint-client

## Usage

    const touchpoint = require('touchpoint-client');
    const chat = touchpoint.createChat({customerId: 'tDNRFKYYtyrAnhais', topic: 'test chat'});
    chat.on('message', msg => {
      console.log(msg);
    });
    chat.on('ready', () => {
      chat.sendMessage('Hello there!').catch(err => {
        console.log('Error occurred while sending message');
      });
    });

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

### touchpoint.createChat(options)

Create a new chat client.

#### Arguments

* `options.customerId` *string required*: ID of the customer to chat to.
* `options.team` *string*: Name of the team to chat to, `default` if unspecified
* `options.topic` *string*: Chat topic.
* `options.signedContext` *string*: JSON object containing the signed context fields, if necessary
* `options.signature` *string*: base64-encoded signature of the signed context, if necessary
* `options.unsignedContext` *string|object*: JSON object containing the unsigned context fields, if necessary
* `options.url` *string*: URL of the Touchpoint websocket. `wss://touchpoint.telviva.com/websocket` if unspecified
* `options.proxy` *string*: URL of an HTTP proxy to use, if needed. Be warned that some HTTP proxies may not correctly support Websockets.

#### Returns

Chat instance, which is also an `EventEmitter`.

### chat.sendMessage(message)

Send a message to the agent. Must be called after the `ready` event is emitted.

#### Arguments

* `message` *string required*: Message to send.

#### Returns

Promise which resolves to `undefined` once the message is sent. If Touchpoint modified the message (e.g. to mask a credit card number),
the promise will resolve to the new value.

### chat.setUserIsTyping(isTyping)

Set whether or not the user is currently typing a message. Note that sending a message
automatically sets this to `false`. Must be called after the `ready` event is emitted.

#### Arguments

* `isTyping` *boolean required*: `true` if the user started typing, or `false` if the user stopped typing.

#### Returns

Promise which resolves to `undefined` once the status was set.

### chat.close()

Close the chat and tear down the Websocket connection. Returns nothing.

## Chat events

* `error`: emitted with an `Error` if a fatal error occurs. This also closes the chat.
* `message`: emitted with a message object sent by the agent or by Touchpoint itself.
  This will always have two fields `type` and `message`, and may have more.
  `type` is `agentMsg` for a message sent by the agent; all other types are messages sent by the system.
* `ready`: emitted with no arguments once the chat has finished initializing.
* `agentIsTyping`: emitted with `{ agentIsTyping: true }` or `{ agentIsTyping: false }` when the agent starts or
  stops typing a message.
* `agentId`: emitted with `{ agentId: string|null }` when the agent taking the chat changes or if the chat enters the queue.
   If the chat enters the queue, `agentId` is `null`. This is generally accompanied by a message with type `claim` or `queue`.
* `closed`: emitted with no arguments if the agent closes the chat. It is not necessary to call `chat.close` yourself in this case.