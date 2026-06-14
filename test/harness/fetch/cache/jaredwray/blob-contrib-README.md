# Contrib

Contrib is a site that enabled auctions for memorabilia. In 2023 the team decided to shut the service down and open source the code. 

*This code is provided as is and is not supported by the team*

If you would like to contribute to the project please read the [Contributing](CONTRIBUTING.md) document. Contrib was built with the following features:

* Can easily scale to 1000s of auctions, customers, and influencers
* Non-profits have the ability to setup their own account and transaction fees are donated to the non-profit via stripe
* Influencers have their own profile and can upload and manage their auctions
* Influencers can post via the social networks with a short code url provided by contrib
* Auctions can be uploaded by the admin, or by the influencers
* Easy logon for all mobile users as the base profile is bound to the mobile number
* Because of the above, the user can easily change their profile picture and name
* Support for social logons via `passport.js` for twitter, facebook, and google
* Cloud Native by default using cloud services such as mongo atlas, stripe, sendgrid, and firebase, cloudflare (streaming), google cloud storage.

![tests](https://github.com/jaredwray/contrib/workflows/tests/badge.svg)
[![codecov](https://codecov.io/gh/jaredwray/contrib/branch/main/graph/badge.svg?token=2LIYGRVN4F)](https://codecov.io/gh/jaredwray/contrib)

* [Getting Started](#getting-started)
* [How to Deploy the App](#deploying-the-api)
* [How to Deploy the API](#deploying-the-api)
* [How to Set Up Cloud Services](#setting-up-cloud-services)
* [How to Contribute](CONTRIBUTING.md)
* [Code of Conduct](CODE_OF_CONDUCT.md)
* [License](LICENSE.md)

## Getting Started

When using a mono repo you will want to install the dependencies for the entire repo. To do this you will want to run the following command: `yarn` This will install all dependencies for the entire repo. This will also install the dependencies for the `app` and `api` as well.

Once you have installed the dependencies you can run the following commands: `yarn start` This will start the `app` on port 3000 and `api` on 3001 in development mode. You can also run the following commands: `yarn start:app` This will start the `app` on port 3000 in development mode. `yarn start:api` This will start the `api` on port 3001 in development mode.

### Building Contrib

To build contrib for production you will want to run the following commands:

Install all dependencies: `yarn`

Build the app and api: `yarn build`

This will build the `app` and place the static files in the `packages/app/dist` directory. It will also build the `api` and place it in the `packages/api/dist` directory.

Build the Docker Container for API: `yarn docker:build`

At this point you can deploy the `app` to any static cloud host and then deploy the `api` to any cloud host that supports docker.

### Development in the Mono Repo

The mono repo is built using `yarn` and there are easy scripts in the base `package.json` to help with development and build.

* `yarn test` - this will test the `app` and `api`
* `yarn build` - this will build the `app` and `api`
* `yarn docker:build` - this will build the `api` in a docker container
* `yarn docker:run` - this will run the `api` in a docker container
* `yarn start` - this will start the `app` on port 3000 and `api` on 3001 in development mode
* `yarn start:app` - this will start the `app` on port 3000 in development mode
* `yarn start:api` - this will start the `api` on port 3001 in development mode

## Deploying the API

The API is the brains in this system and all major business logic is handled here. The API is a standard nodejs application and can be built and served with the following ENV variables:
```

```

- Build: `docker build --rm --pull -f "./Dockerfile" -t "contrib:latest" "./"`
- Run: `docker run --rm -d -p 3000:3000/tcp contrib:latest`

## Deploying the App

The app is a standard react application and can be built and served statically with only one `ENV` variable provided which is `REACT_APP_API_URL={YOUR_API_URL}`.

Commands to build:
`yarn && yarn build`

This will build the `app` and place the static files in the `packages/app/dist` directory. It will also build the `api` and place it in the `packages/api/dist` directory.

You can do this on any static hosting service such as `Netlify`, `Vercel`, `AWS S3`, `Firebase`, `Cloudflare`, etc.

## Setting Up Cloud Services

### UPS delivery:

To deliver auction winnings, we use UPS service.

You can find all the necessary information about UPS for development here: `https://www.ups.com/upsdeveloperkit?loc=en_US`.

### Authentication logic:

To authenticate users, we use the PassportJs library. We use 3 authentication strategies: Google, Facebook, Twitter.

To configure each of them to work correctly, you need to take the following steps:

#### Auth with Google by passport.js:

1. Log in to the Google Cloud Platform.
2. Select the your project.
3. Add the following links to the Authorized JavaScript origins field: `https://{YOUR_APP_URL}`, 
4. Add the following links to the Authorized Redirect URIs field: `https://{YOUR_APP_URL}/api/v1/auth/google/callback`.
5. Get Client ID and Client secret for GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET envs.
6. Register Google Strategy as indicated on this page: `http://www.passportjs.org/packages/passport-google-oauth20/`

#### Auth with Facebook by passport.js:

1. Log in to the Facebook Developers.
2. Go to Facebook Login => Setting
3. Add the following links to the Valid OAuth Redirect URI: `https://{YOUR_APP_URL}/api/v1/auth/facebook/callback`.
4. Get App ID and App Secret for FACEBOOK_APP_ID and FACEBOOK_APP_ID envs on the Settings => Basic.
5. Register Facebook Strategy as indicated on this page: `http://www.passportjs.org/packages/passport-facebook/`

#### Auth with Twitter by passport.js: 

1. Log in to the Twittet Application Management.
2. Go to the Setting tab.
3. Add the following links to the Callback URL: `https://{YOUR_APP_URL}/api/v1/auth/twitter/callback`.
4. Go to the API Keys tab, there you will find your Consumer key and Consumer secret keys for TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET envs.
5. Register Twitter Strategy as indicated on this page: `http://www.passportjs.org/packages/passport-twitter/`


#### Setup webhook to notify application when an event happens in an account

1. Sign in to Stripe `https://stripe.com/`
2. Go to `Developers/Webhooks` section
3. If needs to receive events from customer's accounts connected to the Contrib's account - press `Add endpoint` in `Endpoints receiving events from Connect applications` section
4. If needs to receive event from personal account - press `Add endpoint` in `Endpoints receiving events from your account`
5. In the appeared window enter the URL which will receive Stripe events on the server
6. Enter description
7. Select several events in `Events to send` section or press button `receive all events`
8. Press `Add endpoint`
9. Check the secret key in `Sign in secret` section

Now webhook added and registered on Stripe side. On server side add new evn var with value from `Sign in secret` section.
This value will be used to check webhook signature when event will be received.

Every webhook will have personal sign in secret, so for every new webhook will require personal env var with defined secret value

#### Configuring scheduled jobs for the auctions:

Go to Google Cloud Scheduler: https://console.cloud.google.com/cloudscheduler and create follow jobs:

|Name|Description|Frequency|Timezone|Target type|URL|HTTP method|HTTP headers|Body|
|---|---|---|---|---|---|---|---|---|
| contrib-auction-settle     | end auctions (change status to SETTLED)  | * * * * * | America/Los_Angeles | HTTP        | https://`{YOUR_API_URL}`/api/v1/auctions-settle      | POST        | Content-Type: application/json | { "key": "OUR_SECRET_KEY" } |
| contrib-notify-auction-end | send notifications                       | * * * * * | America/Los_Angeles | HTTP        | https://`{YOUR_API_URL}`/api/v1/auctions-ends-notify | POST        | Content-Type: application/json | { "key": "OUR_SECRET_KEY" } |