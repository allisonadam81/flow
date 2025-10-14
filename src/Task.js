class Task {
  constructor(work) {
    this.work = work;
  }

  static of = (fn) => new Task(fn);

  map = (fn) => Task.of(async () => fn(this.work()));

  flatMap = (fn) => async () => fn(this.work());

  catch = (fn) =>
    Task.of(async () => {
      try {
        return this.work();
      } catch (e) {
        return fn(e);
      }
    });

  run = async () => this.work();
}

export default Task;
