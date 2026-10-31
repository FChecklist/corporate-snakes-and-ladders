# Tests skipped because they assert the OLD behaviour (not deleted)

Rule used: a test is stale only if it asserts something the owner's rules for this game do not require. Snakes' rules book (docs/SNAKES_RULES_BOOK.md in game-core) has no rule about the phone's screen lock, sound, Do not disturb, or the wording of the end-of-game line.

| Test | File | Why it is skipped | Replacement |
|---|---|---|---|
| SL-11 "sound is off until turned on" | apps/web/test/wp14-phone.test.ts | The owner's 1.4.1 audit restored sound ON by default; the test wants "Sound off". The screen-lock and Do-not-disturb parts still hold (the second SL-11 test runs). | tester's v3 version: expects "Sound on" and no "Sound is off until you turn it on" |
| SL-08 "ends when N players are home" literal | packages/beacon/test/sl08-ends-when.test.ts | The text now names the turn cap and the team rule ("ends sooner when K players are home" / "the first whole team is home"), because "ends when" alone was not true at the cap. | tester's v3 version expects the new text |

Not skipped, pending a decision: the owner's three test sign-ins (demo1/2/3 at xyz.in, code 123456). They are implemented and work while the service is in TEST mode (WP-17 gate, `isTestMode`); in LIVE mode they are refused on purpose. The old tests do not switch to TEST mode first.
