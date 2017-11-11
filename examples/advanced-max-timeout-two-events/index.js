'use strict';

const seneca = require('seneca')();
let dt = new Date();
let counter = 0;
// register with redis
seneca.use(require('../../'), {
  driver: 'seneca-muxer-redis'
});

// define our final event
seneca.add('testing:testme', (msg, reply) => {
  console.log('Have been called!', msg);

  if (!counter++) {
    // spawning second round this time the optional wont make it in time
    console.log('\n\nNow creating an optionalEvent that times out');
    console.log('calling event 3');
    dt = new Date();
    seneca.act('test:test', {
      identifiedBy: {
        hello: `hello ${dt}`
      },
      state: {
        im: '18'
      }
    });

    setTimeout(() => {
      console.log(
        'calling event 4 out of time there should no new event spawn up'
      );
      seneca.act('another:test', {
        identifiedBy: {
          hello: `hello ${dt}`
        },
        state: {
          im: '25'
        }
      });
    }, 5000);
  }

  setTimeout(() => process.exit(0), 7000); // finally terminating
  reply();
});

seneca.ready(() => {
  // we register our wanted event
  console.log('registering myself');
  seneca.act('muxer:register', {
    events: ['test:test'],
    optionalEvents: ['another:test'],
    fires: 'testing:testme',
    maxRequestTime: 2000
  });

  console.log('Creating an event where all optionalEvents reach in time');

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

    setTimeout(() => {
      console.log('calling event 2 in time');
      seneca.act('another:test', {
        identifiedBy: {
          hello: `hello ${dt}`
        },
        state: {
          im: '25'
        }
      });
    }, 1000);
  }, 100);
});
