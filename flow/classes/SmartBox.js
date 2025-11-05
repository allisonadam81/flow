export const toArray = (collection) => {
  if (collection?.values) return [...collection.values()];
  if (collection?.[Symbol.iterator]) return [...collection];
  if (!collection) return [];
  if (collection?.constructor === Object) return Object.values(collection);
  return [collection];
};

class FlowBox {
  constructor(value, isError = false) {
    this._value = value;
    this._isError = isError;
  }
  static of(val) {
    return new FlowBox(val);
  }
  static error(err) {
    return new FlowBox(err, true);
  }

  get isError() {
    return !!this._isError;
  }
  get isNothing() {
    return this._value === null || this._value === undefined;
  }

  get value() {
    return typeof this._value === 'function' ? this._value() : this._value;
  }

  get isFlowBox() {
    return this._value instanceof FlowBox;
  }

  run() {
    return this.value;
  }

  inspect(tag = '') {
    const label = `FlowBox - ${tag ? `${tag} - ` : ''}${this.isError ? 'Error - ' : 'Value - '}`;
    console.log(label, this._value);
    return this;
  }

  tap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      fn(val);
      return FlowBox.of(val);
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  map(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return FlowBox.of(val.then(fn));
      }
      return FlowBox.of(fn(val));
    } catch (err) {
      return FlowBox.error(err);
    }
  }
  flatMap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return FlowBox.of(
          val.then(fn).then((res) => (res instanceof FlowBox ? res.value : res))
        );
      }
      return fn(val);
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  filter(predicate) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return FlowBox.of(val.then((res) => (predicate(res) ? res : null)));
      }
      return predicate(val) ? FlowBox.of(val) : FlowBox.of(null);
    } catch (err) {
      return FlowBox.error(err);
    }
  }
  chain(fn) {
    return this.flatMap(fn);
  }

  sequence() {
    if (this.isError || this.isNothing) return this;
    try {
      return FlowBox.of(
        toArray(this.value).map((v) => (v instanceof FlowBox ? v.run() : v))
      );
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  distribute() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      return FlowBox.of(
        val.map((v) => (v instanceof FlowBox ? v : FlowBox.of(v)))
      );
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  flat() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.value;
      if (val instanceof FlowBox) return val;
      if (val instanceof Promise) {
        return FlowBox.of(
          val.then((v) => (v instanceof FlowBox ? v.value : v))
        );
      }
      return FlowBox.of(val);
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  fold(onError, onNothing, onOk) {
    try {
      const val = this.value;
      if (val instanceof Promise) {
        return val
          .then((v) => {
            if (this.isError) return onError(v);
            if (this.isNothing) return onNothing(v);
            return onOk(v);
          })
          .catch(onError);
      } else {
        if (this.isError) return onError(val);
        if (this.isNothing) return onNothing(val);
        return onOk(val);
      }
    } catch (err) {
      onError(err);
    }
  }
}

export default FlowBox;
