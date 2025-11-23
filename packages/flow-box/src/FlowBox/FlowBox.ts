import { invoke, isError, isFunction, isPromise, toArray } from '../utils';

export const defaultConfig = Object.freeze({
  badValues: [null, undefined, isError, Number.isNaN],
});

class FlowBox {
  // Static level configs.
  static _defaultConfig = defaultConfig;
  static defineConfig(newConfig) {
    this._defaultConfig = Object.freeze({
      ...this._defaultConfig,
      ...newConfig,
    });
  }
  static restoreDefaults() {
    this._defaultConfig = defaultConfig;
  }

  // static instantiation methods and helpers.
  static of<T>(v: T, c?: typeof defaultConfig) {
    return new FlowBox(() => v, c || FlowBox._defaultConfig);
  }
  static thunk<T>(t: () => T, c?: typeof defaultConfig) {
    return new FlowBox(t, c || FlowBox._defaultConfig);
  }

  static isFlowBox(v) {
    return v instanceof FlowBox;
  }

  // Constructor and instance config.
  constructor(_thunk: () => any, _config = FlowBox._defaultConfig) {
    this._thunk = _thunk;
    this._config = _config;
  }

  get value() {
    return this._thunk();
  }

  get config() {
    return this._config;
  }

  _isBadValue(v) {
    const badVals = this.config.badValues || [];
    return badVals.some((bv) => {
      if (v === bv) return true;
      if (typeof bv === 'function' && bv(v)) return true;
      return false;
    });
  }

  _thunkWithConfig(thunk: () => any) {
    return FlowBox.thunk(thunk, this.config);
  }

  _ofWithConfig(value: any) {
    return FlowBox.of(value, this.config);
  }

  withConfig(newConfig: Partial<typeof defaultConfig>) {
    return FlowBox.thunk(this._thunk, { ...this._config, ...newConfig });
  }

  restoreDefaults() {
    return FlowBox.thunk(this._thunk, FlowBox._defaultConfig);
  }

  // Instance level Combinators
  map(fn) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((v) => (this._isBadValue(v) ? v : fn(v)));
        }
        return fn(val);
      } catch (err) {
        return err;
      }
    });
  }

  flatMap(fn) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;
        if (isPromise(val)) {
          return val
            .then((v) => (this._isBadValue(v) ? v : fn(v)))
            .then((res) => (FlowBox.isFlowBox(res) ? res.value : res));
        }
        const res = fn(val);
        return FlowBox.isFlowBox(res) ? res.value : res;
      } catch (err) {
        return err;
      }
    });
  }

  filter(predicate) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((res) =>
            this._isBadValue(res) ? res : predicate(res) ? res : null
          );
        }
        return predicate(val) ? val : null;
      } catch (err) {
        return err;
      }
    });
  }

  flat() {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;
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

  ap(fb) {
    return this._thunkWithConfig(() => {
      try {
        const fa = this.value; // value from A
        const vbRaw = FlowBox.isFlowBox(fb) ? fb.value : fb;

        if (this._isBadValue(vbRaw)) return vbRaw;

        // A is a Promise
        if (isPromise(fa)) {
          return fa.then((faResolved) => {
            if (!isFunction(faResolved)) return faResolved;

            // B may also be a Promise
            if (isPromise(vbRaw)) {
              return vbRaw.then((vbResolved) =>
                this._isBadValue(vbResolved)
                  ? vbResolved
                  : faResolved(vbResolved)
              );
            }
            // B is not a promise
            return faResolved(vbRaw);
          });
        }

        if (!isFunction(fa)) return fa;
        // A is NOT a promise, but B might be
        if (isPromise(vbRaw)) {
          return vbRaw.then((vbResolved) =>
            this._isBadValue(vbResolved) ? vbResolved : fa(vbResolved)
          );
        }

        // Both are plain values
        return fa(vbRaw);
      } catch (err) {
        return err;
      }
    });
  }

  traverse(fn) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;

        if (isPromise(val)) {
          return val.then((v) => {
            if (this._isBadValue(v)) return v;

            return toArray(v).map((el) => {
              const input = FlowBox.isFlowBox(el) ? el.value : el;
              const result = this._isBadValue(input)
                ? input
                : isPromise(input)
                  ? input.then((res) => (this._isBadValue(res) ? res : fn(res)))
                  : fn(input);
              return FlowBox.isFlowBox(result) ? result.value : result;
            });
          });
        }

        return toArray(val).map((el) => {
          const input = FlowBox.isFlowBox(el) ? el.value : el;
          const result = this._isBadValue(input)
            ? input
            : isPromise(input)
              ? input.then((res) => (this._isBadValue(res) ? res : fn(res)))
              : fn(input);
          return FlowBox.isFlowBox(result) ? result.value : result;
        });
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
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((res) =>
            this._isBadValue(res)
              ? res
              : toArray(res).map((el) =>
                  isPromise(el)
                    ? el.then((e) => (FlowBox.isFlowBox(e) ? e.value : e))
                    : FlowBox.isFlowBox(el)
                      ? el.value
                      : el
                )
          );
        }
        return toArray(val).map((v) =>
          isPromise(v)
            ? v.then((res) => (FlowBox.isFlowBox(res) ? res.value : res))
            : FlowBox.isFlowBox(v)
              ? v.value
              : v
        );
      } catch (err) {
        return err;
      }
    });
  }

  // takes a raw value in a flow box, turns it into an array, and converts all internal elements into a flow box.
  // FlowBox.of([1, 2, 3]) turns into ->
  // FlowBox.of([FlowBox(1), FlowBox(2), FlowBox(3)])
  distribute() {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((res) =>
            this._isBadValue(res)
              ? res
              : toArray(res).map((v) =>
                  FlowBox.isFlowBox(v) ? v : this._ofWithConfig(v)
                )
          );
        }
        return toArray(val).map((v) =>
          FlowBox.isFlowBox(v) ? v : this._ofWithConfig(v)
        );
      } catch (err) {
        return err;
      }
    });
  }

  // RUNNERS

  run() {
    try {
      return this.value;
    } catch (err) {
      return err;
    }
  }

  collect() {
    try {
      return this._ofWithConfig(this.value);
    } catch (err) {
      return this._ofWithConfig(err);
    }
  }

  fold(onError, onNothing, onOk, onFinally) {
    let val;
    try {
      val = this.value;
      if (isPromise(val)) {
        return val
          .then((v) => {
            if (isError(v)) return onError(v);
            if (this._isBadValue(v)) return onNothing(v);
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
        if (this._isBadValue(val)) return onNothing(val);
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

  // HELPERS AND ERROR HANDLING
  catch(fn) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        if (isPromise(val)) {
          return val
            .then((res) => (this._isBadValue(res) ? fn(res) : res))
            .catch(fn);
        }
        if (this._isBadValue(val)) {
          return fn(val);
        }
        return val;
      } catch (err) {
        return fn(err);
      }
    });
  }

  recover(fn) {
    return this.catch(fn);
  }

  toPromiseAll() {
    try {
      return this._thunkWithConfig(() => {
        const val = this.value;
        if (this._isBadValue(val)) return val;
        if (isPromise(val)) {
          return val.then((res) =>
            this._isBadValue(res) ? res : Promise.all(toArray(res))
          );
        }
        return Promise.all(toArray(val));
      });
    } catch (err) {
      return err;
    }
  }

  // Debugging

  inspect(tag = '') {
    return this._thunkWithConfig(() => {
      const label = `FlowBox - ${tag ? `${tag} - ` : ''}'Value - '`;
      console.log(label, this);
      return this.value;
    });
  }

  tap(fn) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        fn(this);
        return val;
      } catch (err) {
        return err;
      }
    });
  }

  peak(fn) {
    return this._thunkWithConfig(() => {
      try {
        const val = this.value;
        fn(val, this.config);
        return val;
      } catch (err) {
        return err;
      }
    });
  }
}

export default FlowBox;
