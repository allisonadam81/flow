import {
  identity,
  invoke,
  isError,
  isFunction,
  isPromise,
  map,
  toValues,
} from '../utils';

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

  private static _unpack(v: any) {
    if (FlowBox.isFlowBox(v)) return v.value;
    if (isPromise(v)) return v.then(FlowBox._unpack);
    return v;
  }

  private static _unpackDeep(v: any) {
    if (FlowBox.isFlowBox(v)) return FlowBox._unpackDeep(v.value);
    if (isPromise(v)) return v.then(FlowBox._unpackDeep);
    return v;
  }

  static resolve(val, onOk, isBadValue, onError = identity, onBad = identity) {
    try {
      if (isBadValue(val)) return onBad(val);
      if (isPromise(val))
        return val.then((res) => (isBadValue(res) ? onBad(res) : onOk(res)));
      return onOk(val);
    } catch (err) {
      return onError(err);
    }
  }

  // Constructor and instance config.
  constructor(_thunk: Thunk<T>, _config = FlowBox._defaultConfig) {
    this._thunk = _thunk;
    this._config = _config;
  }

  private _thunkWithConfig<U>(thunk: Thunk<U>): FlowBox<U> {
    return FlowBox.thunk<U>(thunk, this.config);
  }

  private _ofWithConfig<U>(value: U): FlowBox<U> {
    return FlowBox.of<U>(value, this.config);
  }

  private get value(): T {
    return this._thunk();
  }

  get config(): FlowBoxConfig {
    return this._config;
  }

  _isBadValue(v: any) {
    return FlowBox.isBadValue(v, this.config.badValues);
  }

  _resolve(val, onOk, onError = identity, onBad = identity) {
    return FlowBox.resolve(
      val,
      onOk,
      this._isBadValue.bind(this),
      onError,
      onBad
    );
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

  /**
   * Applies a function to the value inside the FlowBox.
   *
   * Automatically resolves promises and propagates errors or "bad values" according
   * to the FlowBox configuration. If the function returns a promise, the resulting
   * FlowBox will contain that promise.
   *
   * @template U The type of the value returned by the callback.
   * @param {(val: T) => U | Promise<U>} fn - A function to transform the value.
   * @returns {FlowBox<U | Promise<U>>} A new FlowBox containing the transformed value.
   *
   * @example
   * const box = FlowBox.of(5);
   * const result = box.map(x => x + 1).run(); // 6
   *
   * const asyncBox = FlowBox.thunk(async () => 5); // Promise resolving to 5
   * const result = await asyncBox.map(async x => x + 1).run(); // Promise resolving to 6
   */
  map<U>(fn: (val: T) => MaybePromise<U>): FlowBox<MaybePromise<U>> {
    return this._thunkWithConfig<MaybePromise<U>>(() => {
      return this._resolve(this.value, fn);
    });
  }

  /**
   * Filters the contained value according to a predicate function.
   *
   * If the predicate returns false (or resolves to false in case of a promise),
   * the FlowBox will contain `null`. Promises returned by the predicate are supported.
   *
   * @param {(val: T) => boolean | Promise<boolean>} predicate - A function that returns a boolean (or a promise of boolean) indicating whether to keep the value.
   * @returns {FlowBox<T | Promise<T> | null>} A new FlowBox containing the value if the predicate passes, otherwise `null`.
   *
   * @example
   * const box = FlowBox.of(5);
   * const filtered = box.filter(x => x > 3).run(); // 5
   * const filteredFail = box.filter(x => x > 10).run(); // null
   *
   * // Works with async predicates
   * const asyncBox = FlowBox.thunk(async () => 5);
   * const filtered = await asyncBox.filter(async x => x > 3).run(); // Promise resolving to 5
   */
  filter(
    predicate: (val: T) => MaybePromise<boolean>
  ): FlowBox<MaybePromise<T | null>> {
    return this._thunkWithConfig<MaybePromise<T | null>>(() => {
      return this._resolve(this.value, (v) => {
        const bool = predicate(v);
        if (isPromise(bool)) {
          return bool.then((res) => (!!res ? v : null));
        }
        return !!bool ? v : null;
      });
    });
  }

  /**
   * Passes the value to a function that can return a FlowBox, and unpacks the result. Unpacks only one layer deep.
   * If your function does not return a FlowBox, it will return the value instead.
   *
   * It allows chaining multiple FlowBox-producing operations in a single pipeline while propagating errors,
   * promises, and bad values automatically.
   *
   * @template U The type of the value contained in the returned FlowBox.
   * @param {(val: T) => FlowBox<U | Promise<U>> | Promise<U> | U} fn - A function that returns a FlowBox or a value/promise.
   * @returns {FlowBox<U | Promise<U>>} A new FlowBox containing the flattened result.
   *
   * @example
   * const box = FlowBox.of(5);
   * const result = box.flatMap(x => FlowBox.of(x + 1)).run(); // 6
   *
   * // Works with async FlowBoxes
   * const asyncBox = FlowBox.thunk(async () => 5);
   * const result = await asyncBox.flatMap(x => FlowBox.thunk(async () => x + 1)).run(); // Promise resolving to 6
   */
  flatMap<U>(
    fn: (val: T) => FlowBox<MaybePromise<U>> | MaybePromise<U>
  ): FlowBox<MaybePromise<U>> {
    return this._thunkWithConfig<MaybePromise<U>>(() => {
      return this._resolve(this.value, (v) =>
        this._resolve(fn(v), FlowBox._unpack)
      );
    });
  }

  /**
   * Flattens a nested FlowBox or a promise of FlowBox.
   *
   * If the FlowBox contains another FlowBox (or a promise resolving to a FlowBox),
   * `flat` unwraps it so that the resulting FlowBox contains the inner value directly.
   *
   * @returns {FlowBox<Unbox<T>>} A new FlowBox with the inner value flattened.
   *
   * @example
   * const box = FlowBox.of(FlowBox.of(5));
   * const flatBox = box.flat().run(); // 5
   *
   * // Works with async FlowBoxes
   * const asyncBox = FlowBox.thunk(async () => FlowBox.of(5));
   * const flatBox = await asyncBox.flat().run(); // Promise resolving to 5
   */
  flat(): FlowBox<Unbox<T>> {
    return this._thunkWithConfig<Unbox<T>>(() => {
      return this._resolve(this.value, FlowBox._unpack);
    }) as any;
  }

  /**
   * Applies a function contained in a FlowBox to a value contained in another FlowBox (or a plain value).
   *
   * This is the applicative functor pattern. The first FlowBox should contain a function, which
   * will be applied to the value of the second FlowBox. Promises and bad values are handled automatically in either box.
   * If either value is "bad", that value will be returned. If the first box does not contained a function, that value will be returned.
   *
   * @param {MaybePromise<FlowBox<any> | any>} fb - A FlowBox or value containing the argument to apply the function to.
   * @returns {FlowBox<MaybePromise<any>>} A new FlowBox containing the result of the function application.
   *
   * @example
   * const fnBox = FlowBox.of((x: number) => x + 1);
   * const valBox = FlowBox.of(2);
   * const result = fnBox.ap(valBox).run(); // 3
   *
   * // Works with promises
   * const asyncFnBox = FlowBox.thunk(async () => (x: number) => x + 1);
   * const asyncValBox = FlowBox.thunk(async () => 2);
   * const result = await asyncFnBox.ap(asyncValBox).run(); // Promise resolving to 3
   */
  ap(fb) {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, (faResolved) => {
        if (!isFunction(faResolved)) return faResolved;
        return this._resolve(FlowBox._unpack(fb), faResolved);
      });
    });
  }
  /**
   * Turns a FlowBox value into an array through toValues and traverses the collection applying a function to each element.
   *
   * The function can return a FlowBox, a promise, or a plain value. Each element is deeply
   * unpacked, so nested FlowBoxes or promises are resolved automatically. The resulting
   * FlowBox will contain an array of the transformed values.
   *
   * @template U The type of values returned by the callback function.
   * @param {(val: any) => FlowBox<U> | Promise<U> | U} fn - A function to apply to each element of the collection.
   * @returns {FlowBox<MaybePromise<U[]>>} A FlowBox containing the collection of results.
   * @note If your results is now an array of promises, and you want them to resolve together, consider calling toPromiseAll or toPromiseAllSettled
   *
   * @example
   * const box = FlowBox.of([1, 2, 3]);
   * const result = box.traverse(x => FlowBox.of(x + 1)).run(); // [2, 3, 4]
   *
   * // Works with async callbacks
   * const asyncBox = FlowBox.of([1, 2, 3]);
   * const result = await asyncBox.traverse(async x => x + 1).run(); // An array of promises that will resolve to [2, 3, 4]
   *
   * // Deeply unpacks nested FlowBoxes
   * const nestedBox = FlowBox.of([FlowBox.of(1), FlowBox.of(2)]);
   * const result = await nestedBox.traverse(x => x).run(); // [1, 2]
   *
   */
  traverse(fn) {
    return this._thunkWithConfig(() => {
      return [
        toValues,
        map((el) => this._resolve(el, fn)),
        map((el) => FlowBox._unpackDeep(el)),
      ].reduce((v, func) => {
        return this._resolve(v, func);
      }, this.value);
    });
  }
  /**
   *
   * alias for flatMap
   */
  chain(fn) {
    return this.flatMap(fn);
  }

  sequence() {
    return this._thunkWithConfig(() => {
      return [toValues, map((el) => FlowBox._unpackDeep(el))].reduce(
        (v, fn) => {
          return this._resolve(v, fn);
        },
        this.value
      );
    });
  }

  distribute(): FlowBox<MaybePromise<FlowBox<Unbox<T>>[]>> {
    return this._thunkWithConfig<MaybePromise<FlowBox<Unbox<T>>[]>>(() => {
      return this._resolve(this.value, (v) =>
        toValues(v).map((el) =>
          FlowBox.isFlowBox(el) ? el : this._ofWithConfig(el)
        )
      );
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

  unwrap() {
    const val = this.value;
    if (isError(val)) {
      throw val;
    }
    return val;
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
          return val.then((v) => (isError(v) ? fn(v) : v)).catch(fn);
        }
        return isError(val) ? fn(val) : val;
      } catch (err) {
        return fn(err);
      }
    });
  }

  recover(fn) {
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

  toPromiseAll() {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, (v) => Promise.all(toValues(v)));
    });
  }

  toPromiseAllSettled() {
    return this._thunkWithConfig(() => {
      return this._resolve(this.value, (v) => Promise.allSettled(toValues(v)));
    });
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
