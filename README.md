FlowBox

A friendly, lazy, pipeline builder that handles async, errors, and bad values so you can stay in flow.

FlowBox is a tiny utility that helps you build clean, composable pipelines without worrying about whether each step is sync or async, whether you need try/catch, or whether your value is wrapped inside a promise or another FlowBox.

It’s not an FP library you need to “study.”
It’s just a simple helper that makes your code smoother, more reliable, and way easier to read.

FlowBox is:
• Lazy — nothing runs until .run()
• Composable — chain transformations everywhere
• Async-aware — callbacks always get the real value, not the promise
• Error-safe — errors and bad values stay inside the box
• Non-intrusive — no magic, no symbols, no proxies, no patched prototypes
• Beginner-friendly — no need to know what a “monad” is

⸻

Philosophy

FlowBox exists to help your code flow.
You shouldn’t need to think about whether something is async, sync, error-prone, or wrapped inside some value container — the box handles that for you.

You write the transformation pipeline.
FlowBox handles:
• async/sync resolution
• try/catch behavior
• error propagation
• “bad value” detection (null/undefined/NaN/Error by default)
• deep unwrapping of promises and nested FlowBoxes

No crashes unless you decide to crash.
No boilerplate.
Just clean pipelines you can read and reason about.

FlowBox gives power, not ceremony — you don’t need FP vocabulary to use any of it.

⸻

Installation

npm install @flow-tools/flow-box

Getting Started

Wrap a value

```js
const box = FlowBox.of(5);
box.map((x) => x + 1).run(); // 6
```

Wrap async work

```js
const box = FlowBox.thunk(async () => {
  await fetchStuff();
  return 10;
});

await box.map((x) => x * 2).run(); // 20
```

Nothing runs until .run()

```js
const box = FlowBox.of(1).map((x) => {
  console.log("This doesn't run yet!");
  return x + 1;
});

box.run(); // logs + returns 2
```

API Documentation

Everything below includes:
• friendly explanation
• sync example
• async example
• combined / nested examples where appropriate

Static Constructors

FlowBox.of(value)

```js
FlowBox.of(Promise.resolve(5)).flat().run(); // 5
```

Create a FlowBox around a plain value.

Async example:

```js
FlowBox.of(Promise.resolve(5)).flat().run(); // 5
```

FlowBox.thunk(fn)

Wrap a thunk (a function that returns a value).

```js
FlowBox.thunk(() => 5).run(); // 5
```

Async

```js
FlowBox.thunk(async () => 10).run(); // Promise → 10
```

FlowBox.isFlowBox(v)

Returns true if v is a FlowBox.

```js
FlowBox.isFlowBox(42); // false
FlowBox.isFlowBox(FlowBox.of(42)); // true
```

Core Methods

⸻

map(fn)

Transform the contained value.
Works with sync, async, or promise-returning callbacks.

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

flatMap(fn)

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

flat()

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

filter(predicate)

Keeps the value if predicate returns truthy; otherwise returns null.

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

mutate(fn)

Like map, but skips FlowBox’s error/bad-value logic.
Good for raw side-effecting transformations.

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

Convert the boxed value to an array, apply a callback to each element,
and deeply unpack the results afterward.

```js
FlowBox.of([1, 2, 3])
  .traverse((x) => x + 1)
  .run(); // [2, 3, 4]
```

Async callback:

```js
await FlowBox.of([1, 2, 3])
  .traverse(async (x) => x * 2)
  .run(); // [2, 4, 6]
```

Nested FlowBoxes:

```js
FlowBox.of([FlowBox.of(1), FlowBox.of(2)])
  .traverse((x) => x)
  .run(); // [1, 2]
```

distribute()

Turn a FlowBox over a collection into a collection of FlowBoxes.

```js
FlowBox.of([1, 2, 3]).distribute().run();
// [FlowBox(1), FlowBox(2), FlowBox(3)]
```

Mixed values:

```js
FlowBox.of([FlowBox.of(1), 2])
  .distribute()
  .run();
// [FlowBox(1), FlowBox(2)]
```

recover(fn)

Recover from “bad values”:
null, undefined, NaN, Error, or your custom config.

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

Runners

fold(onError, onNothing, onOk, onFinally?)

A full pattern match on success, bad value, error.

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

run()

Evaluate the pipeline.
Returns the final value or promise. Does not throw.

```js
FlowBox.of(5).run(); // 5
```

Async:

```js
await FlowBox.thunk(async () => 5).run(); // 5
```

unwrap()

Like run(), but throws errors.

```js
FlowBox.of(5).unwrap(); // 5
FlowBox.of(new Error('fail')).unwrap(); // throws
```

collect()

Re-wrap the evaluated result (including errors) into a new FlowBox.

```js
FlowBox.thunk(() => {
  throw 'x';
})
  .collect()
  .run(); // "x"
```

Promise Helpers

toPromiseAll()

Convert boxed collection → Promise.all.

```js
await FlowBox.of([Promise.resolve(1), Promise.resolve(2)])
  .toPromiseAll()
  .run();
// [1, 2]
```

toPromiseAllSettled()

Convert boxed collection → Promise.allSettled.

```js
await FlowBox.of([Promise.resolve(1), Promise.reject('x')])
  .toPromiseAllSettled()
  .run();
// [{status:'fulfilled',value:1}, {status:'rejected',reason:'x'}]
```

Debugging Utilities

inspect(tag?)

```js
FlowBox.of(5).inspect('foo').run();
// console.logs detailed info
```

tap(fn)

Receive the FlowBox instance.

```js
FlowBox.of(5)
  .tap((fb) => console.log(fb.run()))
  .run();
```

peak(fn)

Receive the value + config.

```js
FlowBox.of(5)
  .peak((x, cfg) => console.log(x, cfg))
  .run();
```

Configuration

FlowBox has defaults:

```js
badValues: [null, undefined, Error, NaN];
```

You can override globally:

```js
FlowBox.defineConfig({
  badValues: [null, undefined, 0],
});
```

Restore defaults:

```js
FlowBox.restoreDefaults();
```

Per-instance override:

```js
FlowBox.of(5)
  .withConfig({ badValues: [undefined] })
  .map(...)
```

Final Notes

FlowBox isn’t a math exercise.
It’s just a tiny utility to help you write code that:
• Looks cleaner
• Reads more like a pipeline
• Handles async and errors automatically
• Doesn’t crash your app unless you want it to
• Lets you stay in your flow

Use what you want. Ignore what you don’t.
Build the simplest pipeline that makes your code feel smooth.
