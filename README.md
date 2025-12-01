FlowBox

A predictable, lazy, async and error-safe functional pipeline for JavaScript & TypeScript.

For the FP people, it's a Lazy/Maybe/Task/Either Monad. For everybody else, it's a try/catch/async abstraction.

FlowBox, on th

The only time FlowBox does not catch and give an error back to you is when a promise rejects during certain runners, more on this below.

In general, we do this a lot -

```js
const doStuff = async (args) => {
  try {
    const firstResult = await someTask(args);
    const secondResult = await otherTask(firstResult);
    return secondResult;
  } catch (err) {
    console.log('We have a problem', err);
  }
};
```

Then if we want to do a lot of that, we might do something like...

```js
const lotsOfStuff = async () => {
  try {
    return Promise.all([user1, user2, user3].map((user) => doStuff(user)));
  } catch (err) {
    console.log('Dang - it rejected', err);
  }
};

// somewhere...

useEffect(() => {
  const handleStuff = async () => {
    const stuff = await lotsOfStuff();
    const consolidated = consolidateStuff(stuff);
    const formatted = formatStuff(consolidated);
    setState(formatted);
  };
  handleStuff();
}, []);

// or in our backend...
const stuff = await lotsOfStuff();
db.queryAll(
  stuff.map((moreUserData) => ({
    key: moreUserData.id,
    otherKey: moreUserData.tags,
  }))
);
```

This is normal. There's nothing wrong with these patterns. Everybody writes code like this everyday. Myself included.

But it would be cool if we didn't need to manage any of the boilerplate to just writing a function and making a few calls, and formatting our objects, and hopping around from function to function to understand how our pipeline is structured.

```js
const doStuffBox = await FlowBox.of(userArray)
  .map((userArray) => userArray.map(doStuff))
  .traverse(otherStuff) // this will do the other stuff with the result of do stuff.
  .toPromiseAll() // batch together.
  .map(consolidateStuff)
  .map(formatStuff)
  .fold(
    (err) => handleErr(err),
    (nothing) => handleNothing(nothing),
    (res) => handleOk(res),
    () => console.log('all finished!')
  );
```

We can use fold to set state in the UI, or we can have already made our db calls and now send back multiple responses from our API. It doesn't matter.

But notice - all we had to do was await our pipeline because we knew we were doing some async work. If a runtime error or promise rejection occurred, we would have found it in our error handler in our fold. If batch of work somehow got lost and Promise.All gave us an undefined or null, our nothing handler would have caught that as well, short circuiting the pipeline and making sure the format functions don't run with a bad value.
