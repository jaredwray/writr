import * as yaml from 'js-yaml';

export class WritrFrontMatter {
	private readonly _ref: {content: string};

	constructor(content: string | {content: string}) {
		this._ref = typeof content === 'string' ? {content} : content;
	}

	get content(): string {
		return this._ref.content;
	}

	get frontMatterRaw(): string {
		return (/---\n[\s\S]*\n---\n/.exec(this._ref.content))?.[0] ?? '';
	}

	get body(): string {
		return this._ref.content.replace(/---\n[\s\S]*\n---\n/, '');
	}

	get metaData(): Record<string, any> {
		const frontMatter = this.frontMatterRaw;
		const match = /^---\s*([\s\S]*?)\s*---\s*/.exec(frontMatter);
		if (match) {
			return yaml.load(match[1].trim()) as Record<string, any>;
		}

		return {};
	}

	set metaData(data: Record<string, any>) {
		const frontMatter = this.frontMatterRaw;
		const yamlString = yaml.dump(data);
		const newFrontMatter = `---\n${yamlString}---\n`;
		this._ref.content = this._ref.content.replace(frontMatter, newFrontMatter);
	}

	public getValue<T>(key: string): T {
		return this.metaData[key] as T;
	}
}
