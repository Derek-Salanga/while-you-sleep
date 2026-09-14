/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'Days together',
  // The App Group is the whole data channel: the app writes the anniversary
  // date into this suite's UserDefaults, the widget reads it. It has to match
  // ios.entitlements in app.json exactly, or the widget silently reads an
  // empty container and renders its "not set yet" state forever.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.whileyousleep.app'],
  },
});
