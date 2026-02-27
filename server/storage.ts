export interface IStorage {
  // Empty for now as run data is stored in localStorage
}

export class DatabaseStorage implements IStorage {
  // Empty implementation
}

export const storage = new DatabaseStorage();
