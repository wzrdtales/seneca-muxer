'use strict';

const seneca = require('seneca')();
// register with redis
seneca.use(require('../../'), {
  driver: 'seneca-muxer-redis'
});

// define our final event
seneca.add('testing:testme', (msg, reply) => {
  console.log('Have been called!', msg);
  process.exit(0);
  reply();
});

const dt = new Date();

seneca.ready(() => {
  // we register our wanted event
  console.log('registering myself');
  seneca.act('muxer:register', {
    events: ['test:test', 'another:test'],
    fires: 'testing:testme'
  });

  setTimeout(() => {
    console.log('calling event 1');
    seneca.act('test:test', {
      identifiedBy: {
        hello: `hello ${dt}`
      },
      state: {
        im: '18'
      }
    });

    console.log('calling event 2');
    setTimeout(() => {
      seneca.act('another:test', {
        identifiedBy: {
          hello: `hello ${dt}`
        },
        state: {
          im: '25'
        }
      });
    }, 100);
  }, 100);
});
