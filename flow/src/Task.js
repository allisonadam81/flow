class Task {
  constructor(work) {
    this.work = work;
  }

  static of = (fn) => {
    if (typeof fn === 'function') return new Task(fn);
    return new Task(async () => fn);
  };

  map = (fn) => Task.of(async () => fn(await this.work()));

  flatMap = (fn) =>
    Task.of(async () => {
      const nextTask = fn(await this.work());
      return nextTask.run();
    });

  catch = (fn) =>
    Task.of(async () => {
      try {
        return await this.work();
      } catch (e) {
        return fn(e);
      }
    });

  run = async () => this.work();
}

export default Task;
