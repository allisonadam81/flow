# FlowBox

A friendly, lazy, pipeline builder that handles async, errors, and bad values so you can stay in the **_flow_**.

Sure, it's a monad Either/Maybe/Task/Promise/try/catch abstraction. But you don't need to know what that means to get started. It’s just a simple helper that makes your code smoother, more reliable, and way easier to read.

### By default, FlowBox is:

- **Lazy** — Nothing runs until a runner is called.
- **Composable** — Every API method is chainable for long transformation pipelines.
- **Async-aware** — Once you start returning promises, so does FlowBox.
- **Error-safe** — Errors and bad values stay inside the box safely.
- **Beginner-friendly** — If you can build an array pipeline, you can build a FlowBox pipeline.

# Philosophy and Concepts

FlowBox exists to help your code _flow_.
Yes, you still need to be aware of errors, bad inputs, and async behavior — but FlowBox believes you shouldn’t need tons of boilerplate to do it. Its job is to let you write your actual logic, while it quietly handles async resolution, try/catch safety, and input validation behind the scenes.

At its core, FlowBox is built around a few key ideas:

### 1. Resolved Values.

A resolved value is either an immediately available synchronous value, or a value that a promise resolves to.

- If your code is synchronous, you get the immediately available synchronous value.
- If your code is asynchronous, FlowBox chains a .then and hands you what the promise resolves to.

You never deal with raw promises unless you explicitly want to.

### 2. Bad values.

A bad value is anything that should short-circuit a pipeline or function — the kinds of values you’d normally guard against with truthy checks or optional chaining.

For example, we all do this -

```js
const myFunc = (someParams) => {
  if (!someParams) return; // bail early.
  if (!someParams?.someProp) return; // also, bail early.
};
```

FlowBox handles that for you automatically.
By default, it considers the following “bad”:

- null
- undefined
- NaN
- any Error instance

But this is fully configurable — you can declare custom referential values as bad, or define custom predicate functions to identify bad values yourself.

When a bad value enters the pipeline:

- Your callbacks are skipped,
- The value propagates forward unchanged,
- You can handle it using .recover, .catch, your own try/catch with unwrap, or a final .fold.

This lets you write clean, straight-through logic without defensive checks everywhere. (Don’t worry — if defensive checks are comforting, you can absolutely keep writing them.)

### 3. FlowBox only becomes async when you make it async.

Most libraries split their APIs into “sync” and “async” versions.
FlowBox does not.

It unifies both worlds by simply following your return values, and then feeding forward resolved values accordingly.
If your callback returns a normal value, FlowBox stays synchronous.

```js
const asyncBox = FlowBox.of(1)
  .map((x) => x + 1) // sync
  .map((x) => x + 1); // sync
  .map(async (x) => x + 1); // sync call, async return.
  .map((x) => x + 1); // runs after promise resolves.

const syncBox = FlowBox.of(1)
  .map((x) => x + 1) // sync
  .map((x) => x + 1); // sync
  .map((x) => x + 1); // sync
  .map((x) => x + 1); // sync

// Note that since asyncBox became async during the pipeline, the runner will return a promise for you to await.
const asyncResult = await asyncBox.unwrap();
const syncResult = syncBox.unwrap();
```

That’s it. No special async version of map, no choice between “FlowBoxSync” and “FlowBoxAsync”
You write normal functions — API calls, DB queries, batch jobs, pure logic — and FlowBox handles sync/async resolution automatically, in order.

### 4. FlowBox will not crash your app until you tell it to.

FlowBox wraps every functional step in an internal try/catch.
Errors are stored inside the box until you choose to:

- recover from them,
- fold them into a response,
- or unwrap them and allow them to throw.

This keeps your pipelines resilient by default, while still giving you full control when you need it.

### Examples

FlowBox is designed to take common, branching, error-prone logic and turn it into a clean, linear sequence of steps.

Take a very typical “process a user, normalize → validate → fetch → enrich → render” flow. Imperatively, it might look like this:

```js
async function processUser(rawUser) {
  // Guard against invalid input
  if (!rawUser || typeof rawUser !== 'object') return null;

  // Normalize user object
  const user = {
    id: String(rawUser.id || '').trim(),
    name: String(rawUser.name || '').trim(),
    age: Number(rawUser.age),
  };

  // Validate normalized object
  if (!user.id || !user.name || Number.isNaN(user.age)) return null;

  // Fetch additional info
  let extra;
  try {
    const res = await fetch(`/api/user/${user.id}`);
    if (!res.ok) {
      console.log('Something went wrong with the fetch!');
      return null;
    }

    extra = await res.json();
  } catch (err) {
    console.error('Fetch failed:', err);
    return null;
  }

  const enriched = { ...user, ...extra };

  // Render / return the API response
  try {
    return renderProfile(enriched);
  } catch (err) {
    console.error('Rendering failed:', err);
    return null;
  }
}
```

There’s nothing wrong with this — it’s normal JavaScript. It's debuggable and it makes sense. And if you prefer this, FlowBox might not even be for you.
But it’s full of early returns, try/catches, and branching paths. Lots of "boilerplate management" that we all have to do to just write safe functions.

FlowBox collapses this into a linear pipeline:

```js
FlowBox.of(rawUser)
  .map((u) => ({
    id: String(u?.id ?? '').trim(),
    name: String(u?.name ?? '').trim(),
    age: Number(u?.age),
  }))
  .filter((u) => u.id && u.name && !Number.isNaN(u.age))
  .flatMap(async (user) => {
    const res = await fetch(`/api/user/${user.id}`);
    if (!res.ok) throw new Error('API request failed');
    const extra = await res.json();
    return { ...user, ...extra };
  })
  .peek((v) =>
    console.log(
      v
        ? 'Extra data fetch status was ok!'
        : 'Something went wrong — check for errors or invalid data.',
      v
    )
  )
  .fold(
    (err) => ({
      status: 'error',
      message: err?.message ?? String(err),
      data: null,
    }),
    (bad) => ({
      status: 'invalid',
      message: 'User data is incomplete or invalid.',
      data: bad,
    }),
    (good) => ({
      status: 'ok',
      data: renderProfile(good),
    })
  );
```

The “FlowBox way” is to think in simple linear terms, and to write everything as a tiny, testable, inspectable step:
normalize → validate → fetch → enrich → react → fold.

No manual try/catch wrapping.
No repetitive early returns.
No thinking about promise vs sync — FlowBox does that for you.

And when you start breaking steps into named functions, it gets even cleaner. Things can start to read in plain english:

```js
FlowBox.of(rawUser)
  .map(normalizeUser)
  .filter(validateUser)
  .flatMap(adornExtraUserInfo)
  .peek(logResult)
  .fold(handleOnError, handleOnNothing, handleOk);
```

For fairness, here's the same level of cleanup for the imperative example as well -

```js
async function processUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const user = normalizeUser(rawUser);
  if (!validateUser(user)) return null;

  let enriched;
  try {
    enriched = await adornExtraUserInfo(user);
    if (!enriched) return null;
  } catch (e) {
    return null;
  }

  try {
    return renderProfile(enriched);
  } catch (err) {
    console.error('Rendering failed:', err);
    return null;
  }
}
```

Still readable. Still fine.
But FlowBox removes the boilerplate — all the manual guards, try/catch blocks, and null-checks — while leaving the logic entirely yours.

If you want your code to read like a description of what happens next, FlowBox can make that way easier.

# Installation

npm install @flow-tools/flow-box

# Getting Started

Put a value in a box with .of or .thunk -

```js
const box = FlowBox.of(5);
const thunkBox = FlowBox.thunk(() => 10);
```

Create a transformation pipeline around that value -

```js
const numberToDeclaration = FlowBox.of(5)
  .map((x) => x + 1)
  .map((x) => new Array(x).fill(null).map((n, i) => i))
  .traverse((idx) => [idx, idx + 1])
  .traverse((arr) =>
    arr.map((arr) => `I have val ${arr[1]} at ${arr[0]} in a box`)
  );
```

And run that pipeline whenever you want to -

```js
numberPipeline.fold(
  (err) => setError(err.message),
  (nothing) => setError('Oops! Something happened')
  (val) => setState(val)
);
```

Mix and match async/sync freely.

```js
const toNumberId = (longId) => // return back just numbers.
const transformUsers = (arrOfUsers) => // returns back modified users.

const getUserData = async (id) => fetchUserData(id);

const getUsersFromProfilesPipeline = FlowBox.of([
  { profile: { id: 'id-123-321' } },
  { profile: { id: 'id-456-654' } },
  { profile: { id: 'id-789-987' } },
])
  .traverse((profile) => profile.id) // sync
  .traverse(toNumberId) // sync
  .traverse(getUserData) // array of promises.
  .toPromiseAll() // wrap those in a promise.all.
  .map(transformUsers) // transformUsers is handed the resolved array of users.

// run the pipeline, do stuff.
const results = await getUsersFromProfilesPipeline.unwrap()
```

---

# API Documentation

## Static Constructors

### FlowBox.of(value)

Create a FlowBox around a plain value. FlowBox will internally convert that value into a thunk.

```js
FlowBox.of(5); // FlowBox._thunk is now () => 5
```

### FlowBox.thunk(fn)

Use this when you already have a thunk. _Note that when a thunk is called, it is best practice to not trigger a side effect. For example, () => fetchStuff(). Evaluating the thunk itself would trigger an action. Might be fine. Could get weird._

```js
FlowBox.thunk(() => 5);
```

Promises are valid values to pass in as thunks.

```js
FlowBox.thunk(async () => 10).run(); // Promise → 10
// ^^ is the same as -
FlowBox.of(Promise.resolve(10)).run();
```

### FlowBox.isFlowBox(v)

Returns true if v is a FlowBox.

```js
FlowBox.isFlowBox(42); // false
FlowBox.isFlowBox(FlowBox.of(42)); // true
```

# Core Methods

### map(fn)

Takes a callback that will be passed the resolved value stored in the FlowBox. _Note that unlike other FP libs, this does not call a values map function if available._

Sync example:

```js
FlowBox.of(5)
  .map((x) => x + 1)
  .run(); // 6
```

Async callback:

```js
const box = FlowBox.of(5).map(async (x) => x + 1);
await box.run(); // 6
```

### flatMap(fn)

Like map, but if fn returns a FlowBox, it safely flattens the resolved value.

Example:

```js
FlowBox.of(5)
  .flatMap((x) => FlowBox.of(x + 1))
  .run(); // 6
```

### flat()

Safely flatten a resolved value if it is a FlowBox.

```js
FlowBox.of(FlowBox.of(5)).flat().run(); // 5
```

### filter(predicate)

Passes the resolved value to a predicate function. If the resolved value of the predicate is truthy, then the resolved value is kept. Else null is returned.

```js
FlowBox.of(5)
  .filter((x) => x > 3)
  .run(); // 5
FlowBox.of(5)
  .filter((x) => x > 10)
  .run(); // null
```

Async predicate:

```js
await FlowBox.of(5)
  .filter(async (x) => x > 3)
  .run(); // 5
```

### mutate(fn)

Like map, but skips FlowBox’s error/bad-value/promise resolution logic.
Good for raw side-effecting transformations, or getting direct access to the unresolved value in the box.

```js
FlowBox.of(5)
  .mutate((x) => x + 1)
  .run(); // 6
FlowBox.of(fetchStuff())
  .mutate((p) => {
    /* whatever you want, unsafely */
  })
  .run(); // whatever mutate did.
```

### ap(otherBox)

Applicative style function application. _Apply this function to a value and keep it in the box_.

- If the resolved value of this box is a function, it calls that function with the unboxed resolved value of the box passed in.
- If the resolved value of this box is not a function, do nothing and return the value.
- If either resolved value is "bad", the function returns a FlowBox of the bad value.

```js
const fn = FlowBox.of((x: number) => x + 1);
const boxedVal = FlowBox.of(2);
const unBoxedVal = 2;

fn.ap(boxedVal).run(); // 3
fn.ap(unBoxedVal).run(); // 3
```

traverse(fn)

Take a resolved value that is a collection, and apply a callback to the resolved values of the collection.

- Resolves the box's value. If it's not a collection, it will be turned into an array with the single resolved value.
- Traverse the collection's items (an objects/maps values, an arrays elements, etc) and call the callback on the resolved value of each item.
- If there are any bad values found, that element will be kept, but skipped.
- Returns a collection in the same data structure it was given.

Only supports Map, Set, object literals, and arrays.

```js
FlowBox.of([1, 2, 3])
  .traverse((x) => x + 1)
  .run(); // [2, 3, 4]
FlowBox.of({ a: 'hi', b: 'bye' })
  .traverse((str) => str + ' dawg')
  .run(); // { a: 'hi dawg', b: 'bye dawg' }
```

### distribute()

Turns a resolved value that is a collection into a collection of FlowBoxes. Like traverse, respects your collection shape. Does not nest boxes.

```js
FlowBox.of([1, 2, 3]).distribute().unwrap();
// [FlowBox(1), FlowBox(2), FlowBox(3)]
FlowBox.of({ a: 'hi', b: 'bye' }).distribute().unwrap();
// { a: FlowBox('hi'), b: FlowBox('bye')}
```

Mixed values:

```js
FlowBox.of([FlowBox.of(1), 2])
  .distribute()
  .run();
// [FlowBox(1), FlowBox(2)]
```

### recover(fn)

Recover from “bad values” and from Errors. This catches promises that resolve to a "bad value" or get rejected as well.

```js
FlowBox.of(null)
  .recover((nothing) => 10)
  .run(); // 10
```

Async:

```js
await FlowBox.thunk(async () => undefined)
  .recover(() => 99)
  .run(); // 99
```

### catch(fn)

Recover from Errors and rejected promises only.

```js
FlowBox.thunk(() => new Error('whoops'))
  .catch((e) => 10)
  .run(); // 10
```

Async:

```js
await FlowBox.thunk(async () => Promise.reject('nah'))
  .catch(() => 99)
  .run(); // 99
```

This does nothing -

```js
FlowBox.thunk(() => null)
  .catch((e) => 10)
  .run(); // null
```

# Runners

fold(onError, onNothing, onOk, onFinally?)

A full pattern match on success, bad value, error, and finally.
Passes the resolved value or rejected promise value, to the appropriate callback.

```js
FlowBox.of(5).fold(
  (err) => 'ERR', // errors and promise rejections
  (val) => 'BAD', // bad values
  (val) => 'OK ' + val // success case
  () => console.log('everything is finished') // run in a .finally or try/catch/finally.
); // "OK 5"

```

Error:

```js
FlowBox.thunk(() => {
  throw 'oops';
}).fold(
  (err) => 'ERR ' + err,
  (_) => 'BAD',
  (val) => 'OK ' + val
);
// "ERR oops"
```

Async:

```js
await FlowBox.thunk(async () => null).fold(
  (err) => 'ERR',
  (val) => 'BAD',
  (val) => 'OK'
);
// "BAD"
```

### run()

Evaluate the pipeline.
Returns the final value or promise.
Runtime errors are caught and returned.
Promise rejections are caught and returned.
_This will not trigger your own try catch blocks_.

```js
FlowBox.of(5).run(); // 5
FlowBox.of(null).run(); // null
FlowBox.thunk(() => throw new Error('haha')).run(); // Error safely returned
```

Async:

```js
await FlowBox.thunk(async () => 5).run(); // 5

// OR FOR PROMISE REJECTIONS

const res = await FlowBox.thunk(async () => throw new Error('whoops')).run(); // safely returned Error('whoops')
```

### unwrap()

Like run(), but throws errors.
Use this when you want to catch errors and rejected promises yourself.
_This will trigger your own try/catch blocks_

```js
FlowBox.of(5).unwrap(); // 5
FlowBox.of(new Error('fail')).unwrap(); // throws
```

### collect()

Begin evaluating a pipeline up until this point. Everything after collect will remain lazy.

```js
const collected = FlowBox.thunk(loadData()).map(normalizeData).collect(); // runs the pipeline before this point. We now have a box of normalized data here, just waiting to be unwrapped. Fetch has concluded.

// somewhere else...
const retrieveLoadedData = collected.unwrap(); // whatever loaded data is. Fetch was made and resolved a long time ago.
```

# Promise Helpers

### toPromiseAll()

Convert boxed collection → Promise.all.

```js
await FlowBox.of([Promise.resolve(1), Promise.resolve(2)])
  .toPromiseAll()
  .run();
// [1, 2]
```

### toPromiseAllSettled()

Convert boxed collection → Promise.allSettled.

```js
await FlowBox.of([Promise.resolve(1), Promise.reject('x')])
  .toPromiseAllSettled()
  .run();
// [{status:'fulfilled',value:1}, {status:'rejected',reason:'x'}]
```

# Debugging Utilities

### inspect(tag?)

Logs value in FlowBox. Optional to pass in your own label.

```js
FlowBox.of(5).inspect('foo').run();
// console.logs detailed info
```

### tap(fn)

Receive the FlowBox instance for either logging or side effect purposes.

```js
FlowBox.of(5)
  .tap((fb) => console.log(fb))
  .run();
```

### peak(fn)

Receive the value + config.

```js
FlowBox.of(5)
  .peak((x, cfg) => console.log(x, cfg))
  .run();
```

# Configuration

You can configure what values will short-circuit your pipelines. By default, FlowBox is configured with:

```js
badValues: [null, undefined, isError, NaN];
```

You can override this array at the static class level, or instance/pipeline level, anytime you want.

Override class level default configuration:

```js
FlowBox.defineConfig({
  badValues: [null, undefined], // only consider null/undefined as "bad" by default for all new pipelines.
});
// or check your custom predicate to see if it's "bad".
FlowBox.defineConfig({
  badValues: [(v) => customBadChecker(v)],
});
```

Restore class level defaults to the original config:

```js
FlowBox.restoreDefaults();
```

Instance or pipeline level config:

```js
FlowBox.of(5)
  .withConfig({ badValues: [undefined] }) // this is now the bad values array for this pipeline, and this pipeline only.
  .map(...)
```

And you can always restore it inline as well.

```js
FlowBox.of(5)
  .withConfig({ badValues: [undefined] })
  .map(...)
  .restoreDefaults() // flips this pipeline back to the current config in the static class.
```

# Final Notes

FlowBox isn’t a math exercise.
It’s just a tiny utility to help you write code that:

- Looks cleaner
- Reads more like a pipeline
- Handles async and errors automatically
- Doesn’t crash your app unless you want it to
- Lets you stay in your flow

Use what you want. Ignore what you don’t.
Build the simplest pipeline that makes your code feel smooth.
