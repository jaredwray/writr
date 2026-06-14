# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `yarn build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Privacy And Terms logic

Account model has field with last accepted terms version (accpetedTers) and date when the user accepted it (acceptedTermsAt). The user will see terms confirmation dialog until he accepts last terms.

### How add new terms

1. Create new html file with terms in client/public/content/terms folder. File name template: `${version}.html`.

Example: `1.1.html`

2. Define new version.

Add new version in TermsText component (client/src/components/TermsText/index.tsx) in VERSION const.

Example: `const VERSION = '1.1';`

3. Define new version on server-side.

Add new version in TermsService (server/app/TermsService.ts) in VERSION const.

Example: `const VERSION = '1.1';`

# Required data specified in the .env file:


## For STRIPE

We using STRIPE for monetary transactions. Required data examples:

#### examples

```
REACT_APP_STRIPE_PUBLISHABLE_KEY="stripePublishableKey"
```

## For Intercom

We using Intercom to connect with our customers. Required data examples:

#### examples

```
REACT_APP_INTERCOM_APP_ID="intercomAppId"
```

## For Firebase

We using Firebase for assets storage. Required data examples:

#### examples

```
REACT_APP_FIREBASE_CONFIG='{"apiKey": "apiKey", "authDomain": "contrib-dev.firebaseapp.com", "projectId": "contrib-dev", "storageBucket": "content-dev.contrib.org", "messagingSenderId": "messagingSenderId", "appId": "appId"}'
```

## For Platform in general

#### examples

```
REACT_APP_PLATFORM_URL="http://localhost:3000"
REACT_APP_API_URL="http://localhost:3001/graphql"
REACT_APP_API_AUDIENCE="http://localhost:3001/"
REACT_APP_MAX_SIZE_VIDEO_GB="1"
```
