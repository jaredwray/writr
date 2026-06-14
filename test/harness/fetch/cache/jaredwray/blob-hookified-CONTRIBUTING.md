# Contributing
When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

Please note we have a [Code of Conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project.

We release new versions of this project (maintenance/features) on a monthly cadence so please be aware that some items will not get released right away.

# Pull Request Process
You can contribute changes to this repo by opening a pull request:

1) After forking this repository to your Git account, make the proposed changes on your forked branch.
2) Run tests and linting locally.
	- Run `pnpm install`.
	- Run `pnpm test`.
3) Commit your changes and push them to your forked repository.
4) Navigate to the main `Hookified` repository and select the *Pull Requests* tab.
5) Click the *New pull request* button, then select the option "Compare across forks"
6) Leave the base branch set to main. Set the compare branch to your forked branch, and open the pull request.
7) Once your pull request is created, ensure that all checks have passed and that your branch has no conflicts with the base branch. If there are any issues, resolve these changes in your local repository, and then commit and push them to git.
8) Similarly, respond to any reviewer comments or requests for changes by making edits to your local repository and pushing them to Git.
9) Once the pull request has been reviewed, those with write access to the branch will be able to merge your changes into the `Hookified` repository.

If you need more information on the steps to create a pull request, you can find a detailed walkthrough in the [Github documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

# Test / Verify Exports

Hookified supports multiple module formats (ESM, CommonJS, and Browser) and it's important to verify that all export configurations work correctly. We have comprehensive export verification tests to ensure compatibility across all environments.

## Running Export Tests

To run the export verification tests:

```bash
pnpm vitest run test/exports.test.ts
```

Or run all tests including export verification:

```bash
pnpm test
```

## What Gets Tested

Our export verification tests cover:

### 1. **ESM Imports (Node.js)**
- Verifies that `import { Hookified, Eventified } from 'hookified'` works correctly
- Tests that all exported types and classes are accessible
- Validates basic functionality in ESM environment

### 2. **CommonJS Require**
- Verifies that `require('hookified')` works correctly
- Tests both Hookified and Eventified classes via CommonJS
- Runs in a separate `.cjs` file to ensure true CommonJS compatibility

### 3. **Browser Exports**
- Tests the `hookified/browser` subpath export
- Verifies both ESM (`dist/browser/index.js`) and IIFE (`dist/browser/index.global.js`) bundles exist
- Confirms source maps are generated

### 4. **TypeScript Definitions**
- Validates ESM type definitions (`.d.ts`)
- Validates CommonJS type definitions (`.d.cts`)
- Ensures all types (`HookFn`, `IHook`, `HookifiedOptions`, etc.) are exported

### 5. **Build Output**
- Confirms all distribution files are built correctly
- Verifies bundle contents include expected exports

## Testing CommonJS Separately

The CommonJS test runs in isolation to ensure true compatibility. You can run it independently:

```bash
node test/helpers/cjs-test.cjs
```

This executes a standalone CommonJS file that uses `require()` to import and test the package.

## Before Submitting Changes

If you modify the build configuration, export structure, or public API:

1. **Run the build**: `pnpm build`
2. **Run export tests**: `pnpm vitest run test/exports.test.ts`
3. **Run all tests**: `pnpm test`

This ensures your changes don't break compatibility with any supported module format.

# Code of Conduct
Please refer to our [Code of Conduct](CODE_OF_CONDUCT.md) readme for how to contribute to this open source project and work within the community. 
