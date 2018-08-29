
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

class Chat extends EventEmitter {
  constructor(options) {
    super();
    options = Object.assign({
      topic: '<no topic>',
      team: 'default',
      signedContext: null,
      signature: null,
      unsignedContext: null,
      url: 'wss://touchpoint.telviva.com/websocket',
      proxy: null
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

    this._closed = false;
    this._agentIsTyping = false;
    this._agentId = null;

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

    this._expectedDisconnect = false;
    this._ddp.ddp.on('disconnected', () => {
      if (!this._expectedDisconnect) {
        this._closed = true;
        this.emit('error', new Error('unexpected DDP disconnection'));
      }
    })

    this._ddp.ddp.on('added', message => {
      if (message.collection === 'chats') {
        this._chatUpdated(message.fields);
      } else if (message.collection === 'messages') {
        this.emit('message', message.fields);
      }
    });
    this._ddp.ddp.on('changed', message => {
      if (message.collection === 'chats') {
        this._chatUpdated(message.fields);
      }
    });

    this._ddp.call(
      'createChat', options.customerId, options.topic, options.team, 'text', options.signedContext, options.signature, options.unsignedContext
    ).then(id => {
      this._chatId = id;
      this._ddp.subscribe('userChat', id).on('ready', () => {
        this.emit('ready');
      }).on('error', error => {
        this.emit('error', error);
        this.close();
      });

    }).catch(err => {
      this.emit('error', err);
      this.close();
    });
  }

  _chatUpdated(chat) {
    if (chat.hasOwnProperty('agentIsTyping')) {
      this.emit('agentIsTyping', { agentIsTyping: chat.agentIsTyping });
    }

    if (chat.hasOwnProperty('agentId')) {
      this.emit('agentId', { agentId: chat.agentId });
    }

    if (chat.isClosed) {
      this.emit('closed');
      this.close();
    }
  }

  sendMessage(message) {
    if (this._chatId == null) {
      return Promise.reject(Error('chat has not been created yet'));
    }
    if (this._closed) {
      return Promise.reject(Error('chat was already closed'));
    }
    return this._ddp.call('postMessageAsUser', this._chatId, message);
  }

  setUserIsTyping(userIsTyping) {
    if (this._chatId == null) {
      return Promise.reject(Error('chat has not been created yet'));
    }
    if (this._closed) {
      return Promise.reject(Error('chat was already closed'));
    }
    return this._ddp.call('setUserIsTyping', this._chatId, userIsTyping);
  }

  close() {
    this._expectedDisconnect = true;
    this._closed = true;
    this._ddp.disconnect();
  }
}


module.exports = {
  createChat: (options) => new Chat(options),

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