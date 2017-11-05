'use strict';

const Promise = require('bluebird');

module.exports = function muxer(options) {
  const plugin = require(options.driver);
  const store = plugin(options.options);
  let events = [];
  let actions = [];

  const createEventAction = (event, _msg) => {
    const optional = _msg.events.indexOf(event) === -1;

    return async msg => {
      // first thing add it
      const fireEvent = `${_msg.fires}_${Object.keys(msg.identifiedBy)
        .map(key => `${key}_${msg.identifiedBy[key]}`)
        .join('_')}`;
      await store.addToSet(
        fireEvent,
        JSON.stringify({ event: event, msg: this.util.clean(msg) })
      );
      const meta = await store.get(`${fireEvent}_meta`).then(meta => {
        if (meta === null) {
          meta = { startDate: new Date() };
          store.set(`${fireEvent}_meta`, JSON.stringify(meta));
          return meta;
        }

        meta = JSON.parse(meta);
        meta.startDate = new Date(meta.startDate);
        return meta;
      });

      return Promise.all([
        store.get(`${fireEvent}_fired`),
        store.getSet(fireEvent).map(event => JSON.parse(event))
      ]).then(([fireCount, actions]) => {
        fireCount = fireCount || 0;
        if (_msg.fireCount && fireCount > _msg.fireCount) {
          return Promise.reject('fired too often');
        }

        // We first check if all Events have been submitted that are required
        const actionSet = actions.map(({ event }) => event);
        const leftEvents = _msg.events.filter(
          event => actionSet.indexOf(event) === -1
        ).length;

        if (!optional) {
          if (fireCount === 0 && leftEvents === 0) {
            // This tree will delay up to the maxRequestTime and maybe
            // fires if not all optional already fired
            const callDate = new Date() - meta.startDate;
            if (_msg.maxRequestTime > callDate) {
              // ToDo: This timeout better gets distributed, to be safe after crashes
              store.set(`${fireEvent}_call`, callDate);
              setTimeout(() => {
                store.delete(`${fireEvent}_call`);
                store.incr(`${fireEvent}_fired`).then(fireCount => {
                  if (fireCount === 1) {
                    this.act(_msg.fires, {
                      msgs: actions.map(({ msg }) => msg)
                    });
                  }
                });
              }, _msg.maxRequestTime - callDate);
            } else {
              // the default is ensure it has not been fired and fire
              store.incr(`${fireEvent}_fired`).then(fireCount => {
                if (fireCount === 1) {
                  this.act(_msg.fires, { msgs: actions.map(({ msg }) => msg) });
                }
              });
            }
          }
        } else {
          // Entering this branch if we're handling the optional events
          if (
            _msg.maxRequestTime &&
            _msg.maxRequestTime > new Date() - meta.startDate
          ) {
            return null;
          }

          // maxRequestTime requires ALL events to resolve or
          // the timeout to happen
          const leftOptional = _msg.optionalEvents.filter(
            event => actionSet.indexOf(event) === -1
          ).length;

          if (leftEvents === 0 && leftOptional === 0) {
            store.incr(`${fireEvent}_fired`).then(fireCount => {
              // if nothing was specified
              if (!_msg.maxRequestTime || fireCount === 1) {
                this.act(_msg.fires, { msgs: actions.map(({ msg }) => msg) });
              }
            });
          }
        }
      });
    };
  };

  const createDuplicator = event => {
    const actionSet = actions[events.indexOf(event)];
    this.add(event, (msg, reply) => {
      reply(); // always async
      actionSet.forEach(action => {
        action(msg);
      });
    });
  };

  // registering holds the following arguments
  // events [], optionalEvents []
  // options: { maxRequestTime, preferLocal }
  this.add('muxer:register', (msg, reply) => {
    msg.optionalEvents = msg.optionalEvents || [];
    msg.events.concat(msg.optionalEvents).forEach(event => {
      let index = 0;
      if ((index = events.indexOf(event)) === -1) {
        index = events.push(event) - 1;
        actions[index] = new Set();
      }

      actions[index].add(createEventAction(event, msg));

      if (!this.has(event)) {
        createDuplicator(event);
      }

      reply();
    });
  });

  return 'muxer';
};
