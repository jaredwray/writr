![Writr](logo.png)

> Enabling the world to write better via Markdown

[![Build](https://github.com/jaredwray/writr/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/tests.yml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg?token=1YdMesM07X)](https://codecov.io/gh/jaredwray/writr)
[![npm](https://img.shields.io/npm/dm/writr)](https://npmjs.com/package/writr)

# How to Use the Writr Mono Repo

Writr provides readme information for each of its packages. In addtion we have a couple of other documents for review:

* [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Our code of conduct
* [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to this project
* [SECURITY.md](SECURITY.md) - Security guidelines and supported versions

## Getting Started

Writr is designed to make it easier to write with Markdown. You can export from many different sources to markdown, and then use Writr to write your content. Writr is designed to be a simple, distraction-free writing environment.

## Open a Pull Request

You can contribute changes to this repo by opening a pull request:

1) After forking this repository to your Git account, make the proposed changes on your forked branch.
2) Run tests and linting locally using `yarn test`
3) Commit your changes and push them to your forked repository.
4) Navigate to the main `writr` repository and select the *Pull Requests* tab.
5) Click the *New pull request* button, then select the option "Compare across forks"
6) Leave the base branch set to main. Set the compare branch to your forked branch, and open the pull request.
7) Once your pull request is created, ensure that all checks have passed and that your branch has no conflicts with the base branch. If there are any issues, resolve these changes in your local repository, and then commit and push them to git.
8) Similarly, respond to any reviewer comments or requests for changes by making edits to your local repository and pushing them to Git.
9) Once the pull request has been reviewed, those with write access to the branch will be able to merge your changes into the `writr` repository.

If you need more information on the steps to create a pull request, you can find a detailed walkthrough in the [Github documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

## Post an Issue

To post an issue, navigate to the "Issues" tab in the main repository, and then select "New Issue." Enter a clear title describing the issue, as well as a description containing additional relevant information. Also select the label that best describes your issue type. For a bug report, for example, create an issue with the label "bug." In the description field, Be sure to include replication steps, as well as any relevant error messages.

If you're reporting a security violation, be sure to check out the project's [security policy](https://github.com/jaredwray/writr/blob/main/SECURITY.md).

Please also refer to our [Code of Conduct](https://github.com/jaredwray/writr/blob/main/CODE_OF_CONDUCT.md) for more information on how to report issues.

## Ask a Question

To ask a question, create an issue with the label "question." In the issue description, include the related code and any context that can help us answer your question.

## Packages in this Repository

* [writr-cli](https://github.com/jaredwray/keyv/tree/main/packages/writr-cli): command line interface for exports, rendering, and more with markdown files

## License

MIT © Jared Wray
