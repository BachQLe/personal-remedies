// @vitest-environment jsdom
/**
 * api.getProfile.freshRead.test.js — getProfile() must read storage at call
 * time. profileSync.js's remote pull writes `profile` straight to storage
 * (bypassing api.js), so a snapshot captured at module load left every
 * getProfile() caller on the pre-sign-in profile until a full reload.
 *
 * api.js is imported ONCE (statically) on purpose: any load-time snapshot
 * inside it is taken before the tests below write to storage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { clearProfile, getProfile, saveProfile } from '../api.js';
import { storage } from '../storage.js';

const profileA = { firstName: 'A', conditions: [], calorieTarget: 1800 };
const profileB = { firstName: 'B', conditions: [203], calorieTarget: 2200 };

beforeEach(() => {
  storage.clear();
});

describe('getProfile reads storage at call time', () => {
  it('returns a profile written to storage after api.js loaded (remote pull)', async () => {
    expect(await getProfile()).toBeNull();
    storage.set('profile', profileB);
    expect(await getProfile()).toEqual(profileB);
  });

  it('returns the latest of successive direct storage writes', async () => {
    storage.set('profile', profileA);
    expect(await getProfile()).toEqual(profileA);
    storage.set('profile', profileB);
    expect(await getProfile()).toEqual(profileB);
  });

  it('returns null after clearProfile() and after a direct storage removal', async () => {
    storage.set('profile', profileB);
    expect(await getProfile()).toEqual(profileB);
    await clearProfile();
    expect(await getProfile()).toBeNull();

    storage.set('profile', profileB);
    storage.remove('profile');
    expect(await getProfile()).toBeNull();
  });

  it('saveProfile round-trips and still fills the default calorieTarget', async () => {
    await saveProfile({ firstName: 'C', conditions: [] });
    const p = await getProfile();
    expect(p).toMatchObject({ firstName: 'C', conditions: [], calorieTarget: 2000 });
    expect(storage.get('profile').calorieTarget).toBe(2000);
  });
});
