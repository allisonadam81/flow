class Thing {
  constructor(v) {
    this.v = v;
  }

  // static helper to wrap a value or thunk
  static of(v) {
    return new Thing(() => v);
  }

  get value() {
    console.log('VALUE', this.v);
    return this.v();
  }

  val() {
    console.log('DID RUN val()', this.v);
    return this.v();
  }

  map(fn) {
    return Thing.of(() => fn(this.value)); // wrap in thunk
  }

  run() {
    console.log('run called');
    return this.value; // executes the stored thunk
  }

  ap(t) {
    return Thing.of(() => {
      console.log('ap called');
      const fn = this.value; // evaluate this box
      const arg = t.value; // evaluate argument box
      if (typeof fn === 'function') return fn(arg);
      return fn;
    });
  }
}

// Example usage:

const pipelineBox = Thing.of(() => (num) => (num + 1) * 2);
const threeBox = Thing.of(3);

const result = pipelineBox
  .ap(threeBox)
  .map((x) => console.log('Result inside map:', x));

console.log('Pipeline created, nothing has run yet');

result.run(); // executes the whole pipeline, logs the result
