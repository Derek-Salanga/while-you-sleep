import { routeForNotification } from './notificationRouting';

describe('routeForNotification', () => {
  it('opens Record for a partner-posted push', () => {
    expect(routeForNotification({ type: 'partner-posted' })).toEqual({
      screen: 'Record',
    });
  });

  it('opens the clip for a reaction push', () => {
    expect(
      routeForNotification({ type: 'reaction', clipId: 'abc-123' })
    ).toEqual({ screen: 'ClipView', clipId: 'abc-123' });
  });

  it('opens Home for the daily reminder', () => {
    expect(routeForNotification({ type: 'daily-reminder' })).toEqual({
      screen: 'Home',
    });
  });

  // A reaction payload without a usable clipId would otherwise navigate to
  // ClipView and render its "Couldn't load this clip" state -- worse than
  // simply opening the app.
  it('falls back to Home for a reaction with no usable clipId', () => {
    expect(routeForNotification({ type: 'reaction' })).toEqual({
      screen: 'Home',
    });
    expect(routeForNotification({ type: 'reaction', clipId: 42 })).toEqual({
      screen: 'Home',
    });
    expect(routeForNotification({ type: 'reaction', clipId: null })).toEqual({
      screen: 'Home',
    });
  });

  // The payload is server-supplied, so every shape below is reachable --
  // including a device still holding a reminder scheduled by an older
  // build, which carries no `data` at all.
  it('falls back to Home for anything it does not recognise', () => {
    expect(routeForNotification({ type: 'some-future-type' })).toEqual({
      screen: 'Home',
    });
    expect(routeForNotification({})).toEqual({ screen: 'Home' });
    expect(routeForNotification(null)).toEqual({ screen: 'Home' });
    expect(routeForNotification(undefined)).toEqual({ screen: 'Home' });
    expect(routeForNotification('partner-posted')).toEqual({ screen: 'Home' });
  });
});
