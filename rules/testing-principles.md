# Testing Principles

## Follow the existing tests

New tests go where the existing tests for that area live, named and structured like
them, using the same helpers, fixtures and mocking approach. Do not introduce a second
test style, runner or assertion library.

## A new test must be able to fail

Break the thing the test guards and watch it go red before trusting it. A test that
cannot fail protects nothing, and a green suite full of them is worse than a missing
test because it reads as coverage.

## Assert closed sets, not presence

`contains`, `some`, `> 0` only check that something is present — no future addition can
ever violate them, so a new field, event or case ships untested with a green suite.
Where the full set is knowable, assert the whole set with an equality check, so both a
missing entry and an unexpected new one fail. A member legitimately outside the set goes
in an explicit exclusion map with a reason, so adding a member forces a decision.

## Test the decision, not the view

When something renders or runs conditionally, test the predicate that decides it, not
the markup or output that reflects it. A test through the view fails for unrelated
reasons — a renamed label, restructured markup — and when the condition is a literal in
the same file it is just a second copy of that literal.

| The condition is | Test |
|------------------|------|
| A constant in the same file | nothing — there is no decision |
| A predicate over local inputs | the predicate, directly |
| A predicate over something non-local (a role, a flag, shared state) | the predicate, plus one test that the view honours it |

Never make code testable just to have something to assert on.

## Coverage is a diagnostic, not a target

It finds code no test has executed. It says nothing about whether the assertions mean
anything.
