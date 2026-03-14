import { CacheableMemory } from "cacheable";
import { Hashery } from "hashery";

export class WritrAICache {
	private readonly _store: CacheableMemory = new CacheableMemory();
	private readonly _hashStore: CacheableMemory = new CacheableMemory();
	private readonly _hash: Hashery = new Hashery();

	public get store(): CacheableMemory {
		return this._store;
	}

	public get hashStore(): CacheableMemory {
		return this._hashStore;
	}

	public get<T>(key: string, context: string): T | undefined {
		const hash = this.hash(key, context);
		return this._store.get<T>(hash);
	}

	public set<T>(key: string, context: string, value: T): void {
		const hash = this.hash(key, context);
		this._store.set(hash, value);
	}

	public hash(key: string, context: string): string {
		const content = { key, context };
		const cacheKey = JSON.stringify(content);
		const result = this._hashStore.get<string>(cacheKey);
		if (result) {
			return result;
		}

		const hash = this._hash.toHashSync(content);
		this._hashStore.set(cacheKey, hash);
		return hash;
	}

	public clear(): void {
		this._store.clear();
		this._hashStore.clear();
	}
}
