import { invoke, isError, isFunction, isPromise, toArray } from '../utils';

type BadValuePredicate = (v: any) => boolean;
type BadValue = any | BadValuePredicate;
type Thunk<T> = () => T;

type MaybePromise<T> = T | Promise<T>;

type Unbox<T> =
  T extends FlowBox<infer U> ? U : T extends Promise<infer U> ? U : T;

type FlowBoxConfig = {
  badValues: BadValue[];
};

export const defaultConfig = Object.freeze({
  badValues: [null, undefined, isError, Number.isNaN],
});

class FlowBox<T = any> {
  private _thunk: Thunk<T>;
  private _config: FlowBoxConfig;

  // Static level configs.
  private static _defaultConfig: FlowBoxConfig = defaultConfig;
  static defineConfig(newConfig: FlowBoxConfig) {
    this._defaultConfig = Object.freeze({
      ...this._defaultConfig,
      ...newConfig,
    });
  }
  static restoreDefaults() {
    this._defaultConfig = defaultConfig;
  }

  static isBadValue(v: any, badValues: BadValue[]) {
    const badVals = badValues || [];
    return badVals.some((bv) => {
      if (v === bv) return true;
      if (isFunction(bv) && bv(v)) return true;
      return false;
    });
  }

  // static instantiation methods and helpers.
  static of<U>(v: U, c?: FlowBoxConfig): FlowBox<U> {
    return new FlowBox<U>(() => v, c || FlowBox._defaultConfig);
  }
  static thunk<U>(t: Thunk<U>, c?: FlowBoxConfig): FlowBox<U> {
    return new FlowBox<U>(t, c || FlowBox._defaultConfig);
  }

  static isFlowBox(v: any) {
    return v instanceof FlowBox;
  }

  // Constructor and instance config.
  constructor(_thunk: Thunk<T>, _config = FlowBox._defaultConfig) {
    this._thunk = _thunk;
    this._config = _config;
  }

  get value(): T {
    return this._thunk();
  }

  get config(): FlowBoxConfig {
    return this._config;
  }

  private _isBadValue(v: any) {
    return FlowBox.isBadValue(v, this.config.badValues);
  }

  _thunkWithConfig<U>(thunk: Thunk<U>): FlowBox<U> {
    return FlowBox.thunk<U>(thunk, this.config);
  }

  _ofWithConfig<U>(value: U): FlowBox<U> {
    return FlowBox.of<U>(value, this.config);
  }

  withConfig(newConfig: Partial<typeof defaultConfig>): FlowBox<T> {
    return FlowBox.thunk<T>(this._thunk, { ...this.config, ...newConfig });
  }

  restoreDefaults(): FlowBox<T> {
    return FlowBox.thunk<T>(this._thunk, FlowBox._defaultConfig);
  }

  // Instance level Combinators
  mutate<U>(fn: (val: T) => MaybePromise<U>): FlowBox<MaybePromise<U>> {
    return this._thunkWithConfig<MaybePromise<U>>(() => {
      try {
        const val = this.value;
        return fn(val);
      } catch (err) {
        return err as any;
      }
    });
  }

  map<U>(fn: (val: T) => MaybePromise<U>): FlowBox<MaybePromise<U>> {
    return this._thunkWithConfig<MaybePromise<U>>(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val as any;
        if (isPromise(val)) {
          return val.then((v) => (this._isBadValue(v) ? v : fn(v)));
        }
        return fn(val);
      } catch (err) {
        return err;
      }
    });
  }

  filter(
    predicate: (val: T) => MaybePromise<boolean>
  ): FlowBox<MaybePromise<T | null>> {
    return this._thunkWithConfig<MaybePromise<T | null>>(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val as any;
        if (isPromise(val)) {
          return val.then((res) => {
            if (this._isBadValue(res)) return res;
            const bool = predicate(res);
            if (isPromise(bool)) {
              return bool.then((b) => (b ? res : null));
            }
            return bool ? res : null;
          });
        }

        const bool = predicate(val);
        if (isPromise(bool)) {
          return bool.then((b) => (b ? val : null));
        }
        return bool ? val : null;
      } catch (err) {
        return err;
      }
    });
  }

  flatMap<U>(
    fn: (val: T) => FlowBox<MaybePromise<U>> | MaybePromise<U>
  ): FlowBox<MaybePromise<U>> {
    return this._thunkWithConfig<MaybePromise<U>>(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val as any;
        if (isPromise(val)) {
          return val
            .then((v) => (this._isBadValue(v) ? v : fn(v)))
            .then((res) => (FlowBox.isFlowBox(res) ? res.value : res));
        }
        const res = fn(val);
        if (isPromise(res)) {
          return res.then((v) => (FlowBox.isFlowBox(v) ? v.value : v));
        }
        return FlowBox.isFlowBox(res) ? res.value : res;
      } catch (err) {
        return err;
      }
    });
  }

  flat(): FlowBox<Unbox<T>> {
    return this._thunkWithConfig<Unbox<T>>(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val as any;
        if (FlowBox.isFlowBox(val)) return val.value as any;
        if (isPromise(val)) {
          return val.then((v) =>
            FlowBox.isFlowBox(v) ? (v.value as any) : (v as any)
          );
        }
        return val as any;
      } catch (err) {
        return err;
      }
    }) as any;
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

  distribute(): FlowBox<MaybePromise<FlowBox<Unbox<T>>[]>> {
    return this._thunkWithConfig<MaybePromise<FlowBox<Unbox<T>>[]>>(() => {
      try {
        const val = this.value;
        if (this._isBadValue(val)) return val as any;
        if (isPromise(val)) {
          return val.then((res) =>
            this._isBadValue(res)
              ? res
              : toArray(res).map((v) =>
                  FlowBox.isFlowBox(v) ? v : this._ofWithConfig(v)
                )
          ) as MaybePromise<FlowBox<Unbox<T>>[]>;
        }
        return toArray(val).map((v) =>
          FlowBox.isFlowBox(v) ? v : this._ofWithConfig(v)
        ) as MaybePromise<FlowBox<Unbox<T>>[]>;
      } catch (err) {
        return err;
      }
    });
  }

  // RUNNERS

  run(): MaybePromise<T> {
    try {
      return this.value;
    } catch (err) {
      return err;
    }
  }

  collect(): FlowBox<MaybePromise<T>> {
    try {
      return this._ofWithConfig<MaybePromise<T>>(this.value);
    } catch (err) {
      return this._ofWithConfig(err);
    }
  }

  fold<U>(
    onError: (err: unknown) => U,
    onNothing: (val: T) => U,
    onOk: (val: T) => U,
    onFinally?: () => void
  ): MaybePromise<U> {
    let val: MaybePromise<T>;
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
              onFinally?.()
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
      ].every(invoke) && onFinally?.();
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

  inspect(tag = ''): FlowBox<T> {
    return this._thunkWithConfig<T>(() => {
      const label = `FlowBox - ${tag ? `${tag} - ` : ''}'Value - '`;
      console.log(label, this);
      return this.value;
    });
  }

  tap(fn: (fb: FlowBox<T>) => void): FlowBox<T> {
    return this._thunkWithConfig<T>(() => {
      const val = this.value;
      try {
        fn(this);
      } catch (err) {}
      return val;
    });
  }

  peak(fn: (val: T, config: FlowBoxConfig) => void): FlowBox<T> {
    return this._thunkWithConfig<T>(() => {
      const val = this.value;
      try {
        fn(val, this.config);
        return val;
      } catch (err) {}
      return val;
    });
  }
}

export default FlowBox;
