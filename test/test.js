'use strict';

const Lab = require('lab');
const lab = (exports.lab = Lab.script());
const { before, it, describe } = lab;
const { expect } = require('code');
const pquire = require('proxyquire').noPreserveCache();
const Seneca = require('seneca');
const redis = require('redis-mock');
const Promise = require('bluebird');

const driver = options => {
  const client = redis.createClient(options);
  Promise.promisifyAll(client);

  return {
    set: (key, value) => {
      return client.setAsync(key, value);
    },
    get: key => {
      return client.getAsync(key);
    },
    addToSet: (key, value) => {
      return client.saddAsync(key, value);
    },
    getSet: key => {
      return client.smembersAsync(key);
    },
    incr: key => {
      return client.incrAsync(key);
    },
    delete: key => {
      return client.delAsync(key);
    }
  };
};

const si = Seneca();
Promise.promisifyAll(si);

si.use('../', {
  driver: driver
});

function wrapAdd(pin) {
  return new Promise(resolve => {
    si.add(pin, (msg, reply) => {
      reply();
      resolve(msg);
    });
  });
}

describe('Muxer', () => {
  it('should call the target method when both events have been fired', async () => {
    si.act('muxer:register', {
      events: ['event1:test', 'event2:test'],
      fires: 'validate:simple'
    });

    const action = wrapAdd('validate:simple');

    si.act('event1:test', {
      identifiedBy: {
        test: '1'
      },
      some: 'msg'
    });

    setTimeout(() => {
      si.act('event2:test', {
        identifiedBy: {
          test: '1'
        },
        someother: 'msg'
      });
    }, 50);

    return action.then(msg => {
      msg = si.util.clean(msg);
      expect(msg).to.equal({
        msgs: [
          {
            event1: 'test',
            identifiedBy: {
              test: '1'
            },
            some: 'msg'
          },
          {
            event2: 'test',
            identifiedBy: {
              test: '1'
            },
            someother: 'msg'
          }
        ],
        validate: 'simple'
      });
    });
  });
});
