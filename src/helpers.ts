import fs from 'fs-extra';
import yaml from 'js-yaml';

export class WritrHelpers {
	createDoc(source: string, destination: string, frontMatter?: Record<string, unknown>, contentFn?: () => void[]): void {
		console.log('createDoc', source, destination, frontMatter, contentFn);
	}

	getFrontMatter(source: string): Record<string, unknown> {
		const content = fs.readFileSync(source, 'utf8');

		// Use regular expressions to extract the FrontMatter
		const match = /^---\r?\n([\s\S]+?)\r?\n---/.exec(content);
		if (match) {
			// Parse the YAML string to an object
			const frontMatter = yaml.load(match[1]);
			return frontMatter as Record<string, unknown>;
		}

		// Return null or some default value if no FrontMatter is found
		return {};
	}

	setFrontMatter(source: string, frontMatter: Record<string, unknown>): void {
		const content = fs.readFileSync(source, 'utf8');

		const match = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)/.exec(content);

		if (match) {
			// Parse the existing FrontMatter
			let oldFrontMatter = yaml.load(match[1]);

			// Set or replace values
			oldFrontMatter = {
				...oldFrontMatter as Record<string, unknown>,
				...frontMatter,
			};

			// Serialize the FrontMatter back to a YAML string
			const newYaml = yaml.dump(oldFrontMatter);

			// Replace the old FrontMatter with the new string
			const newContent = `---\n${newYaml}---\n${match[2]}`;

			// Write the result back to the file
			fs.writeFileSync(source, newContent, 'utf8');
		} else {
			// No FrontMatter found, add it
			const newYaml = yaml.dump(frontMatter);
			const newContent = `---\n${newYaml}---\n${content}`;
			fs.writeFileSync(source, newContent, 'utf8');
		}
	}
}

