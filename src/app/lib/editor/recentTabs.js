export class RecentTabs {
  constructor() {
    this.list = [];
  }

  record(path) {
    this.list = [path, ...this.list.filter((entry) => entry !== path)];
  }

  forget(path) {
    this.list = this.list.filter((entry) => entry !== path);
  }

  next(currentPath, openPaths) {
    const open = new Set(openPaths);
    return (
      this.list.find((path) => path !== currentPath && open.has(path)) || null
    );
  }
}