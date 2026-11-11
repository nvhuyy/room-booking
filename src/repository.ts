// A box with a label: one repository for any type that has an id (generics).
// The data is private: outside code can only use add / getAll / findById.
export class Repository<T extends { id: string }> {
  private items: T[];

  constructor(items: T[] = []) {
    this.items = [...items];
  }

  add(item: T): void {
    this.items.push(item);
  }

  getAll(): T[] {
    return [...this.items]; // a copy, so nobody can change the original list
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  update(id: string, changes: Partial<Omit<T, "id">>): T | undefined {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    const updated = { ...this.items[index], ...changes } as T;
    this.items[index] = updated;
    return updated;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }
}
