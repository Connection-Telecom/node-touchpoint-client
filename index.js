
'use strict';

const EventEmitter = require('events');
const WebSocket = require('ws');
const request = require('request');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const Asteroid = require('asteroid').createClass();

class TouchpointError extends Error {
  constructor(obj) {
    super(obj != null ? obj.message : 'Unknown error');
    if (obj != null) {
      this.reason = obj.reason || obj.message;
      this.errorCode = obj.error;
    }
  }
}

class Client extends EventEmitter {
  constructor(options) {
    super();
    options = Object.assign({
      url: 'wss://touchpoint.telviva.com/websocket',
      proxy: null
    }, options);

    let SocketConstructor;
    if (options.proxy == null) {
      SocketConstructor = WebSocket;
    } else {
      SocketConstructor = class extends WebSocket {
        constructor(address, protocols) {
          if (protocols == null) {
            super(address, { agent: new HttpsProxyAgent(url.parse(options.proxy)) });
          } else {
            super(address, protocols, { agent: new HttpsProxyAgent(url.parse(options.proxy)) });
          }
        }
      };
    }

    this._ddp = new Asteroid({
      endpoint: options.url,
      SocketConstructor: SocketConstructor,
      autoReconnect: false
    });

    this._closed = false;

    this._expectedDisconnect = false;
    this._ddp.ddp.on('disconnected', () => {
      if (!this._expectedDisconnect) {
        this._closed = true;
        this.emit('error', new Error('unexpected DDP disconnection'));
      }
    })

    this._ddp.ddp.on('added', message => {
      if (message.collection === 'chats') {
        this._chatUpdated(message.fields, message.id);
      } else if (message.collection === 'messages') {
        this.emit('message', message.fields, message.fields.chatId);
      }
    });
    this._ddp.ddp.on('changed', message => {
      if (message.collection === 'chats') {
        this._chatUpdated(message.fields, message.id);
      }
    });

    this._subIds = {};
  }

  createChat(options) {
    if (this._closed) {
      return Promise.reject(Error('client was already closed'));
    }

    options = Object.assign({
      topic: '<no topic>',
      team: 'default',
      signedContext: null,
      signature: null,
      unsignedContext: null,
    }, options);

    if (typeof options.customerId !== 'string') {
      throw new Error('customerId must be a string');
    }

    if (typeof options.unsignedContext === 'object') {
      options.unsignedContext = JSON.stringify(options.unsignedContext);
    }

    if (options.signedContext != null && typeof options.signedContext !== 'string') {
      throw new Error('signedContext must be a string, if present');
    }

    return this._ddp.call(
      'createChat', options.customerId, options.topic, options.team, 'text', options.signedContext, options.signature, options.unsignedContext
    ).then(id => {
      const sub = this._ddp.subscribe('userChat', id, true);
      sub.on('ready', () => {
        this.emit('chatReady', id);
      }).on('error', error => {
        this.emit('error', error, id);
        delete this._subIds[id];
      });
      this._subIds[id] = sub.id;

      return id;
    });
  }

  closeChat(chatId) {
    if (!this._subIds.hasOwnProperty(chatId)) {
      return Promise.reject(`unknown chat: ${chatId}. it might already have been closed or it was never created`);
    }
    this._unsub(chatId);
    return this._ddp.call('userCloseChat', chatId);
  }

  _unsub(chatId) {
    if (this._subIds.hasOwnProperty(chatId)) {
      this._ddp.unsubscribe(this._subIds[chatId]);
      delete this._subIds[chatId];
    }
  }

  _chatUpdated(chat, chatId) {
    if (chat.hasOwnProperty('agentIsTyping')) {
      this.emit('agentIsTyping', { agentIsTyping: chat.agentIsTyping }, chatId);
    }

    if (chat.hasOwnProperty('agentId')) {
      this.emit('agentId', { agentId: chat.agentId }, chatId);
    }

    if (chat.isClosed) {
      this.emit('chatClosed', chatId);
      this._unsub(chat._id);
    }
  }

  sendMessage(message, chatId, attachment) {
    if (this._closed) {
      return Promise.reject(Error('client was already closed'));
    }
    if (attachment == null) {
      return this._ddp.call('postMessageAsUser', chatId, message);
    } else {
      return this._ddp.call('postMessageAsUser', chatId, message, attachment);
    }
  }

  setUserIsTyping(userIsTyping, chatId) {
    if (this._closed) {
      return Promise.reject(Error('client was already closed'));
    }
    return this._ddp.call('setUserIsTyping', chatId, userIsTyping);
  }

  close() {
    this._expectedDisconnect = true;
    this._closed = true;
    this._ddp.disconnect();
  }
}


module.exports = {
  createClient: options => new Client(options),

  isAvailable(customerId, team, url, proxy) {
    if (url == null) {
      url = 'https://touchpoint.telviva.com/';
    }

    if (team == null) {
      team = 'default';
    }

    return new Promise((resolve, reject) => {
      request({
        uri: url + 'api/customers/' + encodeURIComponent(customerId) + '/teams/' + encodeURIComponent(team) + '/channels',
        json: true,
        proxy: proxy
      }, (err, result) => {
        if (err != null) {
          return reject(err);
        }

        if (result.statusCode >= 300) {
          return reject(new TouchpointError(result.body));
        }

        for (let channel of result.body) {
          if (channel.channel === 'text') {
            return resolve({ available: channel.available });
          }
        }

        return resolve({ available: false });
      });
    });
  }
};