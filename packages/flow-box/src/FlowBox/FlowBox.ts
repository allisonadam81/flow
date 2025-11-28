import {
  identity,
  invoke,
  isError,
  isFunction,
  isPromise,
  map,
  toArray,
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

  private _resolve(getValue, onOk, onError = identity) {
    try {
      const val = getValue();
      if (this._isBadValue(val)) return val;
      if (isPromise(val))
        return val.then((res) => (this._isBadValue(res) ? res : onOk(res)));
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
      return this._resolve(() => this.value, fn);
    });
  }

  filter(
    predicate: (val: T) => MaybePromise<boolean>
  ): FlowBox<MaybePromise<T | null>> {
    return this._thunkWithConfig<MaybePromise<T | null>>(() => {
      return this._resolve(
        () => this.value,
        (v) => {
          const bool = predicate(v);
          if (isPromise(bool)) {
            return bool.then((res) => (!!res ? v : null));
          }
          return !!bool ? v : null;
        }
      );
    });
  }

  flatMap<U>(
    fn: (val: T) => FlowBox<MaybePromise<U>> | MaybePromise<U>
  ): FlowBox<MaybePromise<U>> {
    return this._thunkWithConfig<MaybePromise<U>>(() => {
      return this._resolve(
        () => this.value,
        (v) => this._resolve(() => fn(v), FlowBox._unpack)
      );
    });
  }

  flat(): FlowBox<Unbox<T>> {
    return this._thunkWithConfig<Unbox<T>>(() => {
      return this._resolve(() => this.value, FlowBox._unpack);
    }) as any;
  }

  ap(fb) {
    return this._thunkWithConfig(() => {
      return this._resolve(
        () => this.value,
        (faResolved) => {
          if (!isFunction(faResolved)) return faResolved;
          return this._resolve(() => FlowBox._unpack(fb), faResolved);
        }
      );
    });
  }

  traverse(fn) {
    return this._thunkWithConfig(() => {
      return [
        toArray,
        map((el) => FlowBox._unpackDeep(el)),
        map((el) => this._resolve(() => el, fn)),
        map((el) => FlowBox._unpackDeep(el)),
      ].reduce((v, func) => {
        return this._resolve(() => v, func);
      }, this.value);
    });
  }

  chain(fn) {
    return this.flatMap(fn);
  }

  sequence() {
    return this._thunkWithConfig(() => {
      return [toArray, map((el) => FlowBox._unpackDeep(el))].reduce((v, fn) => {
        return this._resolve(() => v, fn);
      }, this.value);
    });
  }

  distribute(): FlowBox<MaybePromise<FlowBox<Unbox<T>>[]>> {
    return this._thunkWithConfig<MaybePromise<FlowBox<Unbox<T>>[]>>(() => {
      return this._resolve(
        () => this.value,
        (v) =>
          toArray(v).map((el) =>
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
    return this.value;
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
    return this._thunkWithConfig(() => {
      return this._resolve(
        () => this.value,
        (v) => Promise.all(toArray(v))
      );
    });
  }

  toPromiseAllSettled() {
    return this._thunkWithConfig(() => {
      return this._resolve(
        () => this.value,
        (v) => Promise.allSettled(toArray(v))
      );
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
