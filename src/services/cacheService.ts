import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AppDB extends DBSchema {
  posts: {
    key: string;
    value: any;
  };
  profiles: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'app-cache-db';
const DB_VERSION = 1;

class CacheService {
  private dbPromise: Promise<IDBPDatabase<AppDB>>;

  constructor() {
    this.dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('posts')) {
          db.createObjectStore('posts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
      },
    });
  }

  async savePost(post: any) {
    const db = await this.dbPromise;
    await db.put('posts', post);
  }

  async savePosts(posts: any[]) {
    const db = await this.dbPromise;
    const tx = db.transaction('posts', 'readwrite');
    await Promise.all(posts.map(post => tx.store.put(post)));
    await tx.done;
  }

  async getPosts(): Promise<any[]> {
    const db = await this.dbPromise;
    return db.getAll('posts');
  }

  async saveProfile(profile: any) {
    const db = await this.dbPromise;
    await db.put('profiles', profile);
  }

  async getProfile(id: string): Promise<any | undefined> {
    const db = await this.dbPromise;
    return db.get('profiles', id);
  }

  async clearCache() {
    const db = await this.dbPromise;
    await db.clear('posts');
    await db.clear('profiles');
  }
}

export const cacheService = new CacheService();
