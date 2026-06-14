# Contrib server package

## Running locally

1. Install dependencies: `$ yarn`
2. Copy `.env` file from 1password or create `.env` file similar to `.env_example` and fill in the required variables.
3. Run server in dev setup: `$ yarn start`

# Required data specified in the .env file:

## For UPS service:

We using UPS service for deliver auction winnings. Description of fields of the required data:

### UPS_DELIVERY_CONTRIB_DATA

required sender data, further in more detail about some of these data fields:

#### example

```
UPS_DELIVERY_CONTRIB_DATA='{"address":"524 9th Ave", "city":"Kirkland", "state":"WA", "zipCode":"98033", "shipperNumber":"3W090X"}'
```

##### shipperNumber

Shipper’s six digit alphanumeric account number. Must be associated with the UserId specified in the AccessRequest. The account must be a valid UPS account number that is active.

## UPS_DELIVERY_REQUEST_HEADER

data required to form a request to UPS, further in more detail about some of these data fields:

#### example

```
UPS_DELIVERY_REQUEST_HEADER='{"AccessLicenseNumber": "number", "Password": "password", "Username": "username"}'
```

#### AccessLicenseNumber

Authorization: Access Key obtained through on-boarding process. Contact your UPS representative for additional information.

#### Password

The customers MyUPS password.

#### Username

The customers MyUPS username.

## For AUTH service:

We using Passport.js to authenticate users on our platform. We using 3 strategies: Google, Twitter, Facebook. Required data examples:

#### examples

```
AUTH_API_URL=http://localhost:3001/
GOOGLE_CLIENT_ID=googleClientId
GOOGLE_CLIENT_SECRET=googleClientSecret
FACEBOOK_APP_ID=facebookAppId
FACEBOOK_APP_SECRET=facebookAppSecret
TWITTER_CONSUMER_KEY=twitterConsumerKey
TWITTER_CONSUMER_SECRET=twitterConsumerSecret
COOKIE_KEY_SECRET=secretKey
COOKIE_LIFE_TIVE=86400000
```

## For Cloud Storage:

We using Cloud Storage for storing entity assets. Required data examples:

#### examples

```
CONTENT_STORAGE_NAME=content-dev.contrib.org
CONTENT_STORAGE_KEY='{"type": "serviceType","project_id": "someId","private_key_id": "privatKeyID","private_key": "privateKey","client_email": "someEmail","client_id": "clientId","auth_uri": "authUri","token_uri": "tokenUri","auth_provider_x509_cert_url": "authProviderX509CertUrl","client_x509_cert_url": "clientX509CertUrl"}'
```

## For TWILIO

We using TWILIO to obtain secret codes used for authorization. Required data examples:

#### examples

```
TWILIO_ACCOUNT_SID=accountSid
TWILIO_AUTH_TOKEN=authToken
TWILIO_VERIFICATION_SERVICE_SID=verificationServiceSid
TWILIO_SENDER_NUMBER=+17432294736
```

## For CloudFlare

We using CloudFlare for live streaming. Required data examples:

#### examples

```
CLOUDFLARE_STREAMING_KEY=streamingKey
CLOUDFLARE_USER_ID=userId
```

## For STRIPE

We using STRIPE for monetary transactions. Required data examples:

#### examples

```
STRIPE_SECRET_KEY=stripeSecretKey
STRIPE_WEBHOOK_SECRET_KEY="stripeWebhookSecretKey
STRIPE_CONTRIB_SHARE_PERCENTAGE=numberValue
```

## For Cloud Tasks

We useing Cloud Tasks to manage the execution, dispatch, and delivery of a large number of distributed tasks.

#### examples

```
GOOGLE_CLOUD_PROJECT=contrib-dev
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_TASK_QUEUE=bids-notification
GOOGLE_CLOUD_TASK_API_TOKEN=12345678987654321
```

## For MONGODB

We useing MONGODB for data storage.

#### examples

```
MONGODB_URI=mongodbUri
```

## For Platform in general

#### examples

```
PORT=3001
APP_URL=http://localhost:3000/
FACEBOOK_APP_ID=123
MAX_SIZE_VIDEO_GB=1
NOTIFICATION_TASK_TARGET_URL=api/v1/notification
```
