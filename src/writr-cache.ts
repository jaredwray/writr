import {Cacheable, CacheableMemory} from 'cacheable';
import type {KeyvStoreAdapter} from 'keyv';
import {type RenderOptions} from './writr.js';

export class WritrCache {
	private _markdownStore: Cacheable = new Cacheable();
	private readonly _markdownStoreSync: CacheableMemory = new CacheableMemory();
	private readonly _hashStore: CacheableMemory = new CacheableMemory();

	public get markdownStore(): Cacheable {
		return this._markdownStore;
	}

	public get markdownStoreSync(): CacheableMemory {
		return this._markdownStoreSync;
	}

	public get hashStore(): CacheableMemory {
		return this._hashStore;
	}

	public async getMarkdown(markdown: string, options?: RenderOptions): Promise<string | undefined> {
		const key = this.hash(markdown, options);
		return this.get(key);
	}

	public getMarkdownSync(markdown: string, options?: RenderOptions): string | undefined {
		const key = this.hash(markdown, options);
		return this.getSync(key);
	}

	public async setMarkdown(markdown: string, value: string, options?: RenderOptions): Promise<boolean> {
		const key = this.hash(markdown, options);
		return this.set(key, value);
	}

	public setMarkdownSync(markdown: string, value: string, options?: RenderOptions): boolean {
		const key = this.hash(markdown, options);
		this.setSync(key, value);
		return true;
	}

	public async get(key: string): Promise<string | undefined> {
		return this._markdownStore.get(key);
	}

	public getSync(key: string): string | undefined {
		return this._markdownStoreSync.get(key);
	}

	public async set(key: string, value: string): Promise<boolean> {
		return this._markdownStore.set(key, value);
	}

	public setSync(key: string, value: string): boolean {
		this._markdownStoreSync.set(key, value);
		return true;
	}

	public async clear(): Promise<void> {
		await this._markdownStore.clear();
		this._markdownStoreSync.clear();
		this._hashStore.clear();
	}

	public setStorageAdapter(adapter: KeyvStoreAdapter): void {
		this._markdownStore = new Cacheable({primary: adapter});
	}

	public hash(markdown: string, options?: RenderOptions): string {
		const key = JSON.stringify({markdown, options});
		let result = this._hashStore.get<string>(key);
		if (result) {
			return result;
		}

		result = this._hashStore.hash(key);
		this._hashStore.set(key, result);

		return result;
	}
}
