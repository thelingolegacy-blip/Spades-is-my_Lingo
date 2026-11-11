import { before, after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

const projectId = 'demo-spades-wallet-rules';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
after(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/alice'), {
      uid: 'alice', email: 'alice@example.com', displayName: 'Alice',
      avatarId: 'avatar_rookie', themeId: 'theme_cyber', deckStyle: 'deck_classic',
      purchasedDecks: ['deck_classic'], chips: 2500, sweepstakesTickets: 3,
      xp: 120, level: 1, activeSweepstakesEntries: 0, streakDays: 1,
      updatedAt: '2026-11-11T00:00:00.000Z', createdAt: '2026-11-10T00:00:00.000Z'
    });
  });
});

test('owner can read own profile but another user cannot', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  const bob = testEnv.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  await assertFails(getDoc(doc(bob, 'users/alice')));
});

test('clients cannot list the global users collection', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  await assertFails(getDocs(collection(alice, 'users')));
});

test('owner cannot mutate wallet or progression fields directly', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  const profile = doc(alice, 'users/alice');
  for (const [field, value] of [
    ['chips', 999999], ['sweepstakesTickets', 999], ['xp', 999999],
    ['level', 99], ['streakDays', 99], ['activeSweepstakesEntries', 99],
    ['purchasedDecks', ['deck_classic', 'deck_gold']]
  ]) await assertFails(updateDoc(profile, { [field]: value }));
});

test('owner can update non-economic profile preferences', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  await assertSucceeds(updateDoc(doc(alice, 'users/alice'), {
    displayName: 'Ace', avatarId: 'avatar_pro', themeId: 'theme_mahogany',
    deckStyle: 'deck_classic', updatedAt: '2026-11-11T01:00:00.000Z'
  }));
});

test('new profile creation rejects client-supplied economic state', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(alice, 'users/alice-new'), {
    uid: 'alice-new', email: 'alice@example.com', displayName: 'Alice',
    avatarId: 'avatar_rookie', themeId: 'theme_cyber', deckStyle: 'deck_classic',
    purchasedDecks: ['deck_classic'], chips: 2500, sweepstakesTickets: 3,
    updatedAt: '2026-11-11T00:00:00.000Z', createdAt: '2026-11-11T00:00:00.000Z'
  }));
});

test('new profile creation allows only the safe default profile schema', async () => {
  const alice = testEnv.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(alice, 'users/alice-new'), {
    uid: 'alice-new', email: 'alice@example.com', displayName: 'Alice',
    avatarId: 'avatar_rookie', themeId: 'theme_cyber', deckStyle: 'deck_classic',
    purchasedDecks: ['deck_classic'],
    updatedAt: '2026-11-11T00:00:00.000Z', createdAt: '2026-11-11T00:00:00.000Z'
  }));
});
