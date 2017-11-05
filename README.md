![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js](http://senecajs.org) Event and Message Muxing Plugin

# seneca-muxer
[![npm version][npm-badge]][npm-url]
[![Dependency Status][david-badge]][david-url]

Lead Maintainers: [Tobias Gurtzick](https://github.com/wzrdtales) and [Christian Wolf](https://github.com/chris-wolf)

# seneca-muxer

This module is a plugin for the Seneca framework. It provides muxing capabilities to combine different
messages and events into a single event that an indefinite amount of clients listens to. This shal help
when synchronizing asynchrounus actions coming from across your microservice landscape.

# Usage

To use the muxer first install the module via

    npm i -s seneca-muxer

Next you will need a driver, for example a  [redis driver](https://github.com/chris-wolf/seneca-muxer-redis):

    npm i -s seneca-muxer-redis

Now you can require the plugin and use it, like in the following example:

```javascript
'use strict';

const seneca = require('seneca');
seneca.use({
  driver: 'seneca-muxer-redis'
});

seneca.act('muxer:register', {
  events: [
    'simple:event',
    'another:event'
  ],
  optionalEvents: [
    'event:that,is:optional'
  ],
  maxRequestTime: 2000
});
```

[npm-badge]: https://badge.fury.io/js/seneca-muxer.svg
[npm-url]: https://badge.fury.io/js/seneca-muxer
[david-badge]: https://david-dm.org/wzrdtales/seneca-muxer.svg
[david-url]: https://david-dm.org/wzrdtales/seneca-muxer
