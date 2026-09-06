import { petMood } from './index';

// The bands are the pet's entire visual vocabulary -- an off-by-one here
// shows up as the wrong face, which is exactly the kind of thing nobody
// notices until it says "withdrawn" on a day you both posted.
describe('petMood', () => {
  it('maps each band, including its lower boundary', () => {
    expect(petMood(100)).toBe('thriving');
    expect(petMood(75)).toBe('thriving');
    expect(petMood(74)).toBe('content');
    expect(petMood(45)).toBe('content');
    expect(petMood(44)).toBe('sleepy');
    expect(petMood(20)).toBe('sleepy');
    expect(petMood(19)).toBe('withdrawn');
    expect(petMood(0)).toBe('withdrawn');
  });

  // The default score is 50, so a brand-new pet must not open on a subdued
  // face -- that would greet a pair with guilt before they'd missed a day.
  it('starts a new pair at content, not sleepy', () => {
    expect(petMood(50)).toBe('content');
  });
});
