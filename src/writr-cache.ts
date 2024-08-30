import {createHash} from 'node:crypto';
import {Keyv, type KeyvStoreAdapter} from 'keyv';
import {type RenderOptions} from './writr.js';

export class WritrCache {
	private _markdownStore: Keyv;
	private _markdownStoreSync: Map<string, string>;
	private _hashStore: Map<string, string>;

	constructor() {
		this._markdownStore = new Keyv();
		this._markdownStoreSync = new Map();
		this._hashStore = new Map();
	}

	public get markdownStore(): Keyv {
		return this._markdownStore;
	}

	public get markdownStoreSync(): Map<string, string> {
		return this._markdownStoreSync;
	}

	public get hashStore(): Map<string, string> {
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
		this._markdownStoreSync = new Map();
		this._hashStore = new Map();
	}

	public setStorageAdapter(adapter: KeyvStoreAdapter): void {
		this._markdownStore = new Keyv({store: adapter});
	}

	public hash(markdown: string, options?: RenderOptions): string {
		const key = JSON.stringify({markdown, options});
		let result = this._hashStore.get(key);
		if (result) {
			return result;
		}

		result = createHash('sha256').update(key).digest('hex');
		this._hashStore.set(key, result);

		return result;
	}
}
