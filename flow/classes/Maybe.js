class Maybe {
  constructor(val) {
    this.val = val;
  }

  static of = (v) => new Maybe(v);
  static nothing = () => Maybe.of(null);

  get isNothing() {
    return this.val === null || this.val === undefined;
  }

  map = (fn) => {
    return this.isNothing ? Maybe.of(this.val) : Maybe.of(fn(this.val));
  };

  filter = (predicate) => {
    if (this.isNothing) return this;
    return predicate(this.val) ? this : Maybe.nothing();
  };

  sequence = () => {
    if (this.isNothing) return this;
    return this.val.map((item) => {
      if (item instanceof Maybe) return item;
      return Maybe.of(item);
    });
  };

  flatMap = (fn) => {
    return this.isNothing ? this : fn(this.val);
  };

  tap = (fn) => {
    if (!this.isNothing) fn(this.val);
    return this;
  };

  getOrElse = (fallback) => {
    return this.isNothing ? fallback : this.val;
  };

  fold = (onNothing, onSome) => {
    return this.isNothing ? onNothing(this.val) : onSome(this.val);
  };

  inspect = (label) => {
    const lbl = label ?? 'Maybe log --> ';
    console.log(lbl, this.val);
    return this;
  };
}

export default Maybe;
