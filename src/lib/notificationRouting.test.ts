import { routeForNotification } from './notificationRouting';

describe('routeForNotification', () => {
  it('opens Record for a partner-posted push', () => {
    expect(routeForNotification({ type: 'partner-posted' })).toBe('Record');
  });

  it('opens Home for the daily reminder', () => {
    expect(routeForNotification({ type: 'daily-reminder' })).toBe('Home');
  });

  // The payload is server-supplied, so every shape below is reachable --
  // including a device still holding a reminder scheduled by an older
  // build, which carries no `data` at all.
  it('falls back to Home for anything it does not recognise', () => {
    expect(routeForNotification({ type: 'some-future-type' })).toBe('Home');
    expect(routeForNotification({})).toBe('Home');
    expect(routeForNotification(null)).toBe('Home');
    expect(routeForNotification(undefined)).toBe('Home');
    expect(routeForNotification('partner-posted')).toBe('Home');
  });
});
