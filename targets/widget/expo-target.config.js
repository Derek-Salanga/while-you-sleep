/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  // Deliberately NOT named here. A `name` with a space produces an Xcode
  // target called "Days together" while the plugin sanitises the same value
  // to "Daystogether" when it registers the extension under
  // extra.eas.build.experimental.ios.appExtensions -- EAS then looks up a
  // target that does not exist and the build dies in "Configure Xcode
  // project" with an empty log and only "Unknown error" to go on. Left
  // unset, everything derives from this folder ("widget") and agrees.
  //
  // The name users actually see is configurationDisplayName in
  // widgets.swift, which is unaffected by this.
  // The App Group is the whole data channel: the app writes the anniversary
  // date into this suite's UserDefaults, the widget reads it. It has to match
  // ios.entitlements in app.json exactly, or the widget silently reads an
  // empty container and renders its "not set yet" state forever.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.whileyousleep.app'],
  },
});
