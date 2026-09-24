const base = require('./base');
const boundaries = require('./boundaries');

module.exports = {
  ...base,
  plugins: [...base.plugins, ...boundaries.plugins],
  settings: {
    ...boundaries.settings,
  },
  rules: {
    ...base.rules,
    ...boundaries.rules,
  },
};
