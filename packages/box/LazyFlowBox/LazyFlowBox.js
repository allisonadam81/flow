export const identity = (v) => v;
export const invoke = (fn) => fn();

export const isFunction = (fn) => typeof fn === 'function';
const toArray = (collection) => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (!collection) return [];
  if (collection?.constructor === Object) return Object.values(collection);
  return [collection];
};
const isError = (e) => e instanceof Error;
const isNullOrUnd = (v) => v === null || v === undefined;
const isPromise = (v) => v instanceof Promise;

const isBadValue = (v) => {
  return [() => isError(v), () => isNullOrUnd(v), Number.isNaN(v)].some((fn) =>
    fn()
  );
};
class FlowBox {
  constructor(thunk) {
    this.thunk = thunk;
  }

  static of(val) {
    return new FlowBox(() => val);
  }

  static isFlowBox(v) {
    return v instanceof FlowBox;
  }
  get value() {
    return this.thunk();
  }

  map(fn) {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((v) => (isBadValue(v) ? v : fn(v)));
        }
        return fn(val);
      } catch (err) {
        return err;
      }
    });
  }

  run() {
    try {
      return this.value;
    } catch (err) {
      return err;
    }
  }

  inspect(tag = '') {
    return FlowBox.of(() => {
      const label = `FlowBox - ${tag ? `${tag} - ` : ''}'Value - '`;
      console.log(label, this);
      return this.value;
    });
  }

  tap(fn) {
    return FlowBox.of(() => {
      fn(this);
      return this.value;
    });
  }

  collect() {
    try {
      return FlowBox.of(this.value);
    } catch (err) {
      return FlowBox.of(err);
    }
  }

  ap(fb) {
    return FlowBox.of(() => {
      try {
        const fa = this.value; // value from A
        const vbRaw = FlowBox.isFlowBox(fb) ? fb.value : fb;

        if (isBadValue(fa)) return fa;
        if (isBadValue(vbRaw)) return vbRaw;

        // A is a Promise
        if (isPromise(fa)) {
          return fa.then((faResolved) => {
            if (isBadValue(faResolved)) return faResolved;

            // B may also be a Promise
            if (isPromise(vbRaw)) {
              return vbRaw.then((vbResolved) => {
                if (isBadValue(vbResolved)) return vbResolved;
                return isFunction(faResolved)
                  ? faResolved(vbResolved)
                  : faResolved;
              });
            }
            // B is not a promise
            return isFunction(faResolved) ? faResolved(vbRaw) : faResolved;
          });
        }

        // A is NOT a promise, but B might be
        if (isPromise(vbRaw)) {
          return vbRaw.then((vbResolved) => {
            if (isBadValue(vbResolved)) return vbResolved;
            return isFunction(fa) ? fa(vbResolved) : fa;
          });
        }

        // Both are plain values
        return isFunction(fa) ? fa(vbRaw) : fa;
      } catch (err) {
        return err;
      }
    });
  }

  traverse(fn) {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((v) => {
            if (isBadValue(v)) return v;

            return toArray(v).map((el) => {
              const input = FlowBox.isFlowBox(el) ? el.value : el;
              const result = isBadValue(input)
                ? input
                : isPromise(input)
                  ? input.then((inRes) => {
                      if (isBadValue(inRes)) return inRes;
                      return fn(inRes);
                    })
                  : fn(input);
              return FlowBox.isFlowBox(result) ? result.value : result;
            });
          });
        }
        return toArray(val).map((el) => {
          const input = FlowBox.isFlowBox(el) ? el.value : el;
          const result = isBadValue(input) ? input : fn(input);
          return FlowBox.isFlowBox(result) ? result.value : result;
        });
      } catch (err) {
        return err;
      }
    });
  }

  flatMap(fn) {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        if (isPromise(val)) {
          return FlowBox.of(
            val
              .then((v) => (isBadValue(v) ? v : fn(v)))
              .then((res) => (FlowBox.isFlowBox(res) ? res.value : res))
          );
        }
        const res = fn(val);
        return FlowBox.isFlowBox(res) ? res.value : res;
      } catch (err) {
        return err;
      }
    });
  }

  filter(predicate) {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((res) =>
            isBadValue(res) ? res : predicate(res) ? res : null
          );
        }
        return predicate(val) ? val : null;
      } catch (err) {
        return err;
      }
    });
  }
  chain(fn) {
    return this.flatMap(fn);
  }
  // takes a list of values, turns it into an array, and then unpacks any internal flow boxes in that array.
  // FlowBox.of([FlowBox(1), FlowBox(2), FlowBox(3)]) turns into ->
  // FlowBox.of([1, 2, 3])
  sequence() {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        return toArray(val).map((v) => (FlowBox.isFlowBox(v) ? v.value : v));
      } catch (err) {
        return err;
      }
    });
  }

  // takes a raw value in a flow box, turns it into an array, and converts all internal elements into a flow box.
  // FlowBox.of([1, 2, 3]) turns into ->
  // FlowBox.of([FlowBox(1), FlowBox(2), FlowBox(3)])
  distribute() {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        return toArray(val).map((v) =>
          FlowBox.isFlowBox(v) ? v : FlowBox.of(v)
        );
      } catch (err) {
        return err;
      }
    });
  }

  // unpacks a nested Flow Box.
  flat() {
    return FlowBox.of(() => {
      try {
        const val = this.value;
        if (isBadValue(val)) return val;
        if (FlowBox.isFlowBox(val)) return val.value;
        if (isPromise(val)) {
          return val.then((v) => (FlowBox.isFlowBox(v) ? v.value : v));
        }
        return val;
      } catch (err) {
        return err;
      }
    });
  }

  fold(onError, onNothing, onOk, onFinally) {
    let val;
    try {
      val = this.value;
      if (isPromise(val)) {
        return val
          .then((v) => {
            if (isError(v)) return onError(v);
            if (isBadValue(v)) return onNothing(v);
            return onOk(v);
          })
          .catch(onError)
          .finally(
            () =>
              [() => !!onFinally, () => isFunction(onFinally)].every(invoke) &&
              onFinally()
          );
      } else {
        if (isError(val)) return onError(val);
        if (isBadValue(val)) return onNothing(val);
        return onOk(val);
      }
    } catch (err) {
      return onError(err);
    } finally {
      [
        () => !!onFinally,
        () => isFunction(onFinally),
        () => !isPromise(val),
      ].every(invoke) && onFinally();
    }
  }
}

export const LazyFlowBox = FlowBox;

const numBox = FlowBox.of(1)
  .map((x) => x + 1)
  .run();

const funcBox = FlowBox.of((x) => x + 1)
  .map((fn) => fn(2))
  .run();
