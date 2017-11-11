'use strict';

const Lab = require('lab');
const lab = (exports.lab = Lab.script());
const { beforeEach, it, describe } = lab;
const { expect } = require('code');
const Seneca = require('seneca');
const redis = require('redis-mock');
const Promise = require('bluebird');
const sinon = require('sinon');

const driver = options => {
  const client = redis.createClient(options);
  client.flushall();
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

let si = Seneca();
Promise.promisifyAll(si);

si.use('../', {
  driver: driver
});

function wrapAdd (pin, counter = 0) {
  let useCounter = !!counter;
  let responses = counter === 0 ? '' : [];
  let spy;
  let promise = new Promise(resolve => {
    si.add(
      pin,
      (spy = sinon.spy((msg, reply) => {
        reply();
        if (useCounter) {
          responses.push(si.util.clean(msg));
        } else {
          responses = si.util.clean(msg);
        }

        if (!counter--) {
          resolve(responses);
        }
      }))
    );
  });

  return {
    spy,
    promise
  };
}

describe('Muxer', () => {
  beforeEach(() => {
    si = Seneca({ log: 'silent' });
    Promise.promisifyAll(si);

    si.use('../', {
      driver: driver
    });
  });

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

    return action.promise.then(msg => {
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

  it('should call the target method twice when the optionalEvents answer', async () => {
    si.act('muxer:register', {
      events: ['event1:test'],
      optionalEvents: ['event2:test'],
      fires: 'validate:simple'
    });

    const action = wrapAdd('validate:simple', 1);

    si.act('event1:test', {
      identifiedBy: {
        test: '1'
      },
      some: 'msg'
    });

    const secondEvent = new Promise(resolve => {
      setTimeout(() => {
        si.act('event2:test', {
          identifiedBy: {
            test: '1'
          },
          someother: 'msg'
        });
        setTimeout(() => {
          resolve();
        }, 100);
      }, 200);
    });

    return action.promise
      .then(msg => {
        expect(msg).to.equal([
          {
            msgs: [
              {
                event1: 'test',
                identifiedBy: {
                  test: '1'
                },
                some: 'msg'
              }
            ],
            validate: 'simple'
          },
          {
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
          }
        ]);

        return secondEvent;
      })
      .then(() => {
        expect(action.spy.calledTwice).to.be.true();
      });
  });

  it('should call the target method when an event does not answer within the maxRequestTIme', async () => {
    si.act('muxer:register', {
      events: ['event1:test'],
      optionalEvents: ['event2:test'],
      fires: 'validate:simple',
      maxRequestTime: 50
    });

    const action = wrapAdd('validate:simple');

    si.act('event1:test', {
      identifiedBy: {
        test: '1'
      },
      some: 'msg'
    });

    const secondEvent = new Promise(resolve => {
      setTimeout(() => {
        si.act('event2:test', {
          identifiedBy: {
            test: '1'
          },
          someother: 'msg'
        });
        setTimeout(() => {
          resolve();
        }, 100);
      }, 200);
    });

    return action.promise
      .then(msg => {
        expect(msg).to.equal({
          msgs: [
            {
              event1: 'test',
              identifiedBy: {
                test: '1'
              },
              some: 'msg'
            }
          ],
          validate: 'simple'
        });

        return secondEvent;
      })
      .then(() => {
        expect(action.spy.calledOnce).to.be.true();
      });
  });

  it('should call and mux the target method when an event does answer within the maxRequestTIme', async () => {
    si.act('muxer:register', {
      events: ['event1:test'],
      optionalEvents: ['event2:test'],
      fires: 'validate:simple',
      maxRequestTime: 100
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
    }, 20);

    return action.promise.then(msg => {
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
