import {CacheableMemory} from 'cacheable';
import {type RenderOptions} from './writr.js';

export class WritrCache {
	private readonly _store: CacheableMemory = new CacheableMemory();
	private readonly _hashStore: CacheableMemory = new CacheableMemory();

	public get store(): CacheableMemory {
		return this._store;
	}

	public get hashStore(): CacheableMemory {
		return this._hashStore;
	}

	public get(markdown: string, options?: RenderOptions): string | undefined {
		const key = this.hash(markdown, options);
		return this._store.get<string>(key);
	}

	public set(markdown: string, value: string, options?: RenderOptions) {
		const key = this.hash(markdown, options);
		this._store.set(key, value);
	}

	public clear() {
		this._store.clear();
		this._hashStore.clear();
	}

	public hash(markdown: string, options?: RenderOptions): string {
		const content = {markdown, options};
		const key = JSON.stringify(content);
		let result = this._hashStore.get<string>(key);
		if (result) {
			return result;
		}

		result = this._hashStore.hash(content);
		this._hashStore.set(key, result);

		return result;
	}
}
