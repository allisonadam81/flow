# FlowBox

A friendly, lazy, pipeline builder that handles async, errors, and bad values so you can stay in flow.

Sure, it's a monad Either/Maybe/Task abstraction. But you don't need to know what that means to get started. It’s just a simple helper that makes your code smoother, more reliable, and way easier to read.

### By default, FlowBox is:

- **Lazy** — Nothing runs until a runner is called.
- **Composable** — Every API method is chainable for long transformation pipelines.
- **Async-aware** — Once you start returning promises, so does FlowBox.
- **Error-safe** — Errors and bad values stay inside the box safely.
- **Beginner-friendly** — TS first, with js docs to help you out.

# Philosophy

FlowBox exists to help your code _flow_. You should always handle errors, try/catch, and async behaviors, but FlowBox thinks you should do it with a lot less ceremony.

So you write the transformation pipelines and what you want to do with the data afterwards. FlowBox handles:

- async/sync resolution
- try/catch behavior
- error propagation
- “bad value” detection (null/undefined/NaN/Error by default)
- deep unwrapping of promises and nested FlowBoxes

No crashes unless you decide to crash.
No boilerplate.
Just clean pipelines you can read and reason about.

FlowBox is designed so that you can streamline your thoughts and handle your data fluidly, and your errors safely.

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
  .distribute()
  .traverse((box) =>
    box.map((arr) => `I have val ${arr[1]} at ${arr[0]} in a box`)
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

Mix and match async work. FlowBox will run synchronously and register when you start async tasks, and always pass resolved values to your callbacks.

```js
const toNumberId = (longId) => // return back just numbers.
const transformUsers = (arrOfUsers) => // returns back modified users.

const getUserData = async (id) => fetchUserData(id);

const getUsersFromProfilesPipeline = FlowBox.of([
  { profile: { id: 'id-123-321' } },
  { profile: { id: 'id-456-654' } },
  { profile: { id: 'id-789-987' } },
])
  .traverse((profile) => profile.id) // runs sync
  .traverse(toNumberId) // still sync
  .traverse(getUserData) // an regular array, now filled with promises.
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

Use this when you already have a thunk. _Not that when a thunk is called, it is best practice to not return a side effect. For example, () => fetchStuff(). Evaluating the thunk itself would trigger an action._

```js
FlowBox.thunk(() => 5);
```

Promise are valid values to pass in as thunks.

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

Takes a callback that will be passed the value stored in the FlowBox.
If that value is a promise, it will be passed the resolved value of the promise.

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

Async value + async callback:

```js
const box = FlowBox.thunk(async () => 5).map(async (x) => x + 1);
await box.run(); // 6
```

### flatMap(fn)

Like map, but if fn returns a FlowBox, it flattens one layer.

Example:

```js
FlowBox.of(5)
  .flatMap((x) => FlowBox.of(x + 1))
  .run(); // 6
```

Async:

```js
await FlowBox.thunk(async () => 5)
  .flatMap(async (x) => FlowBox.of(x + 1))
  .run(); // 6
```

### flat()

Flatten one level of nested FlowBoxes or promises.

```js
FlowBox.of(FlowBox.of(5)).flat().run(); // 5
```

Async:

```js
await FlowBox.thunk(async () => FlowBox.of(5))
  .flat()
  .run(); // 5
```

### filter(predicate)

Keeps the value if predicate returns truthy; otherwise returns null. If the predicate returns a promise, the resolved value will be used.

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
Good for raw side-effecting transformations, or getting direct access to the value in the box.

```js
FlowBox.of(5)
  .mutate((x) => x + 1)
  .run(); // 6
```

ap(otherBox)

Applicative style application.
If this box contains a function, apply it to otherBox.

```js
const fn = FlowBox.of((x: number) => x + 1);
const val = FlowBox.of(2);

fn.ap(val).run(); // 3
```

Async everything:

```js
await FlowBox.thunk(async () => (x) => x + 1)
  .ap(FlowBox.thunk(async () => 10))
  .run(); // 11
```

traverse(fn)

Convert the boxed value to an array, and apply the callback to each element.
Basically a short cut for map(arr => arr.map( _actual function I care about_ ))

- If the value itself is a promise, the resolved value will be turned into an array and the callback applied to each element.
- If any elements are promises, the callback will be applied to the resolved value.

```js
FlowBox.of([1, 2, 3])
  .traverse((x) => x + 1)
  .run(); // [2, 3, 4]
```

Async callback:

```js
await FlowBox.of([1, 2, 3])
  .traverse(async (x) => x * 2)
  .toPromiseAll()
  .run(); // [2, 4, 6]
```

### distribute()

Turn a FlowBox containing a collection into a collection of FlowBoxes.
Will not nest FlowBoxes.

```js
FlowBox.of([1, 2, 3]).distribute().unwrap();
// [FlowBox(1), FlowBox(2), FlowBox(3)]
```

Mixed values:

```js
FlowBox.of([FlowBox.of(1), 2])
  .distribute()
  .run();
// [FlowBox(1), FlowBox(2)]
```

### recover(fn)

Recover from “bad values”:
null, undefined, NaN, Error, or your custom config. This catches promises that resolve to a "bad value" or that gets rejected as well.

```js
FlowBox.of(null)
  .recover(() => 10)
  .run(); // 10
```

Async:

```js
await FlowBox.thunk(async () => undefined)
  .recover(() => 99)
  .run(); // 99
```

### catch(fn)

Recover from Errors and rejectd promises only.

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

# Runners

fold(onError, onNothing, onOk, onFinally?)

A full pattern match on success, bad value, error.
Passes the resolved value or rejected promise value, to the appropriate callback.

```js
FlowBox.of(5).fold(
  (err) => 'ERR',
  (val) => 'BAD',
  (val) => 'OK ' + val
);
// "OK 5"
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
Returns the final value or promise. Does not throw.
_You will need to catch rejected promises, or handle safely returned errors manually. This will not trigger your own try/catch blocks._

```js
FlowBox.of(5).run(); // 5
```

Async:

```js
await FlowBox.thunk(async () => 5).run(); // 5
await FlowBox.thunk(async () => throw new Error('whoops'))
  .run()
  .catch(handleErr);
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
FlowBox.thunk(() => 5)
  .map(addOne)
  .collect() // runs the pipeline before this point. We now have a box of 6 here.
  .map(addOne); // not run yet.
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

FlowBox, by default, will not call your functions if it finds a "bad value." A bad value, by default, is configured with the following -

```js
badValues: [null, undefined, isError, NaN];
```

You can override the default config to allow FlowBox to detect any bad value you want. If FlowBox finds a function, it will call the function with the value to determine if it's "bad". DefineConfig sets the default for all FlowBox instances.

```js
FlowBox.defineConfig({
  badValues: [null, undefined], // only consider null/undefined as "bad".
});
// or check your custom function to see if it's "bad".
FlowBox.defineConfig({
  badValues: [(v) => customBadChecker(v)],
});
```

Restore defaults to the original config:

```js
FlowBox.restoreDefaults();
```

You can also override the config inline with an instance level, or pipeline level, config.

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
  .restoreDefaults() // flips this pipeline back to the in the static class.
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
