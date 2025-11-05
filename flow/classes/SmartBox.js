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
  static isFlowBox(v) {
    return v instanceof FlowBox;
  }

  get isError() {
    return !!this._isError;
  }
  get isNothing() {
    return this._value === null || this._value === undefined;
  }

  getValue() {
    return typeof this._value === 'function' ? this._value() : this._value;
  }

  get value() {
    return typeof this._value === 'function' ? this._value() : this._value;
  }

  run() {
    return this.getValue();
  }

  inspect(tag = '') {
    const label = `FlowBox - ${tag ? `${tag} - ` : ''}${this.isError ? 'Error - ' : 'Value - '}`;
    console.log(label, this._value);
    return this;
  }

  tap(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.getValue();
      fn(val);
      return FlowBox.of(val);
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  map(fn) {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.getValue();
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
      const val = this.getValue();
      if (val instanceof Promise) {
        return FlowBox.of(
          val
            .then(fn)
            .then((res) => (FlowBox.isFlowBox(res) ? res.getValue() : res))
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
      const val = this.getValue();
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
  // box.of([box.of(1), box.of(2), box.of(3)]).sequence() => box.of([1,2,3])
  sequence() {
    if (this.isError || this.isNothing) return this;
    try {
      return FlowBox.of(
        toArray(this.getValue()).map((v) =>
          FlowBox.isFlowBox(v) ? v.run() : v
        )
      );
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  distribute() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.getValue();
      return FlowBox.of(
        toArray(val).map((v) => (FlowBox.isFlowBox(v) ? v : FlowBox.of(v)))
      );
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  flat() {
    if (this.isError || this.isNothing) return this;
    try {
      const val = this.getValue();
      if (FlowBox.isFlowBox(val)) return val;
      if (val instanceof Promise) {
        return FlowBox.of(
          val.then((v) => (FlowBox.isFlowBox(v) ? v.getValue() : v))
        );
      }
      return FlowBox.of(val);
    } catch (err) {
      return FlowBox.error(err);
    }
  }

  fold(onError, onNothing, onOk) {
    try {
      const val = this.getValue();
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
